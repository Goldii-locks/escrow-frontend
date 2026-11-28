import {
  API_REQUEST_TIMEOUT_MS,
  BACKEND_URL,
  CONTRACT_ID,
  createRpcServer,
  FACTORY_CONTRACT_ID,
  SUBMIT_REQUEST_TIMEOUT_MS,
} from "@/app/lib/config";
import {
  formatTxError,
  PreparedTransactionMismatchError,
  TxRequestTimeoutError,
  WalletRejectedError,
} from "@/app/lib/errors";
import { reportClientError } from "@/app/lib/errorReporter";
import { verifyPreparedTransaction } from "@/app/lib/tx_verification";
import type { WalletSimulationResult } from "@/app/lib/wallet_session";
import { NETWORK_PASSPHRASE } from "@/app/lib/network_config";
import { Transaction } from "@stellar/stellar-sdk";

/**
 * `BACKEND_URL`, `CONTRACT_ID` and `FACTORY_CONTRACT_ID` are deployment
 * settings and live in `app/lib/config.ts`; they are re-exported here because
 * every caller already imports this module and tests mock it.
 */
export { BACKEND_URL, CONTRACT_ID, FACTORY_CONTRACT_ID };

export type ContractArg = { type: string; value: unknown };

export type TxPhase =
  "idle" | "building" | "signing" | "submitting" | "confirming" | "success" | "error";

/** How long {@link waitForTransactionConfirmation} polls before giving up (#570). */
const CONFIRMATION_POLL_TIMEOUT_MS = 30_000;
const CONFIRMATION_POLL_INTERVAL_MS = 1_500;

/** Default bound used by {@link signTxWithTimeout}. */
export const DEFAULT_SIGNING_TIMEOUT_MS = 60_000;

/**
 * Holds the XDR string sent to the wallet and an optional sensitive buffer
 * that is zeroed and dropped on timeout or completion.
 */
export interface TxSignRequest {
  xdr: string;
  /** Sensitive buffer cleared on timeout / completion. */
  payload?: Uint8Array | null;
}

/**
 * Thrown by {@link signTxWithTimeout} when no signature is received within
 * the configured time limit. Kept for backwards compatibility with callers
 * that import it directly; the single source of truth for the timeout is
 * `WalletSignatureTimeoutError` in `app/lib/wallet_state_context.ts`.
 */
export class TxSignatureTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Transaction signature timed out after ${timeoutMs}ms`);
    this.name = "TxSignatureTimeoutError";
  }
}

/** Zeroes and drops a sensitive buffer so it cannot be retained after abort. */
export function clearTxSensitiveMemory(request: TxSignRequest): TxSignRequest {
  if (request.payload) {
    request.payload.fill(0);
  }
  request.payload = null;
  return request;
}

/**
 * Races a contract transaction signature operation against a timeout clock.
 * On timeout the operation is aborted and any sensitive payload memory is
 * cleared. Matches the setTimeout + Promise.race pattern used by all other
 * connector helpers in this codebase.
 *
 * Not used on the contract signing path: `submitContractTransaction` relies on
 * the single timeout in `WalletContext.signTransaction` (#628).
 */
export async function signTxWithTimeout<T>(
  request: TxSignRequest,
  signFn: (xdr: string) => Promise<T>,
  timeoutMs: number = DEFAULT_SIGNING_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      clearTxSensitiveMemory(request);
      reject(new TxSignatureTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([signFn(request.xdr), timeoutPromise]);
    clearTxSensitiveMemory(request);
    return result;
  } catch (err) {
    if (timedOut || err instanceof TxSignatureTimeoutError) {
      clearTxSensitiveMemory(request);
    }
    throw err;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export function getPhaseLabel(phase: TxPhase): string {
  switch (phase) {
    case "building":
      return "Preparing...";
    case "signing":
      return "Sign in wallet...";
    case "submitting":
      return "Submitting...";
    case "confirming":
      return "Confirming on-chain...";
    default:
      return "";
  }
}

export function isTxPending(phase: TxPhase): boolean {
  return (
    phase === "building" || phase === "signing" || phase === "submitting" || phase === "confirming"
  );
}

// =============================================================================
// Request timeouts (#825)
// =============================================================================
//
// `AbortSignal.timeout` is not driven by vitest's fake timers, so the timeout
// is built from an explicit `AbortController` + `setTimeout`. The controller's
// `timedOut` flag distinguishes "the request took too long" (raise a
// retryable TxRequestTimeoutError) from a genuine network failure, which
// keeps its own message.

/** Handle returned by {@link createRequestTimeout}. */
export interface RequestTimeout {
  signal: AbortSignal;
  /** True once the configured timeout elapsed (as opposed to a fetch error). */
  readonly timedOut: boolean;
  /** Clears the underlying timer once the request has settled. */
  clear(): void;
}

/**
 * Creates an `AbortSignal` that aborts after `timeoutMs`, driven by a plain
 * `setTimeout` so tests can advance it with fake timers.
 */
export function createRequestTimeout(timeoutMs: number): RequestTimeout {
  const controller = new AbortController();
  const state = { timedOut: false };
  const timer = setTimeout(() => {
    state.timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    get timedOut() {
      return state.timedOut;
    },
    clear() {
      clearTimeout(timer);
    },
  };
}

/**
 * Computes the hash of a signed transaction envelope locally, so a submit
 * timeout (#825) can still tell the user which transaction to look up.
 * Returns null when the XDR can't be decoded; the caller degrades gracefully.
 */
export function computeSignedTxHash(signedXdr: string): string | null {
  try {
    const bytes = new Transaction(signedXdr, NETWORK_PASSPHRASE).hash();
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

/** Builds the submit-phase timeout error, including the local tx hash when available. */
function buildSubmitTimeoutError(signedXdr: string): TxRequestTimeoutError {
  const hash = computeSignedTxHash(signedXdr);
  if (hash) {
    return new TxRequestTimeoutError(
      `We couldn't confirm whether your transaction was submitted. Your signed transaction's hash (computed locally) is ${hash} — check it on a Stellar explorer to see whether it went through before retrying.`
    );
  }
  return new TxRequestTimeoutError(
    "We couldn't confirm whether your transaction was submitted. Please check a Stellar explorer with your recent transactions before retrying."
  );
}

// =============================================================================
// Backend response shapes (#686)
// =============================================================================
//
// Both on-chain endpoints wrap their payload in the backend's `ApiSuccessBody`
// envelope (`{ success: true, data }`), except `POST /api/jobs/build-tx`, which
// returns `{ success: true, xdr }` inline. Failures come back either as
// `sendError`'s `{ success: false, error }` or, for schema rejections, as the
// validate middleware's `ValidationError` body carrying `details` / `fields`.
// The parsing below is deliberately tolerant of the older flat shapes
// (`{ hash }`, `{ txHash }`, …) so a backend that has not yet been redeployed
// still yields a usable hash.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return null;
}

/**
 * Extracts the transaction hash from a `/api/jobs/submit` success body.
 *
 * The current backend answers `{ success: true, data: { status, hash } }`, so
 * `data.hash` is checked first; the flat `hash` / `txHash` / `transactionHash`
 * keys are kept as a fallback for older payloads.
 */
export function extractSubmitTxHash(body: unknown): string {
  if (!isRecord(body)) return "";

  const data = isRecord(body.data) ? body.data : undefined;

  return (
    firstString(
      data?.hash,
      data?.txHash,
      data?.transactionHash,
      body.hash,
      body.txHash,
      body.transactionHash
    ) ?? ""
  );
}

/**
 * Extracts `sendTransaction`'s own status (`PENDING`, `DUPLICATE`, `ERROR`,
 * `TRY_AGAIN_LATER`, ...) from a `/api/jobs/submit` success body, from either
 * the `data` envelope or a flat top-level copy. A 200 response only means the
 * backend queued the transaction with the network — this status (and, later,
 * `getTransaction`) is what actually says whether it was accepted (#570).
 */
export function extractSubmitStatus(body: unknown): string | null {
  if (!isRecord(body)) return null;

  const data = isRecord(body.data) ? body.data : undefined;

  return firstString(data?.status, body.status);
}

/** `sendTransaction` statuses that mean the network never queued the transaction. */
const SUBMIT_FAILURE_STATUSES = new Set(["ERROR", "TRY_AGAIN_LATER"]);

/**
 * Polls `getTransaction` until the network reports the submitted transaction
 * as applied (`SUCCESS`) or rejected (`FAILED`), or until `timeoutMs` elapses.
 *
 * A 200 from `/api/jobs/submit` only acknowledges that `sendTransaction`
 * queued the transaction (`PENDING`); it can still fail once applied, e.g. on
 * a resource fee shortfall, an auth failure, or a contract error (#570). This
 * is the step that turns that queued status into a real outcome.
 */
async function waitForTransactionConfirmation(
  txHash: string,
  { timeoutMs = CONFIRMATION_POLL_TIMEOUT_MS }: { timeoutMs?: number } = {}
): Promise<void> {
  const [server, { Api }] = await Promise.all([
    createRpcServer(),
    import("@stellar/stellar-sdk/rpc"),
  ]);

  const deadline = Date.now() + timeoutMs;

  while (true) {
    const response = await server.getTransaction(txHash);

    if (response.status === Api.GetTransactionStatus.SUCCESS) {
      return;
    }

    if (response.status === Api.GetTransactionStatus.FAILED) {
      const code = extractFailedResultCode(response);
      throw new Error(
        code
          ? `Your transaction was rejected by the network (${code}).`
          : "Your transaction was rejected by the network."
      );
    }

    // Still NOT_FOUND (not yet ingested) — keep polling until the deadline.
    if (Date.now() >= deadline) {
      throw new Error(
        "We could not confirm your transaction in time. It may still succeed; check the explorer before retrying."
      );
    }

    await new Promise((resolve) => setTimeout(resolve, CONFIRMATION_POLL_INTERVAL_MS));
  }
}

/**
 * Best-effort extraction of the ledger-level `TransactionResultCode` name
 * (e.g. `"txFAILED"`, `"txINSUFFICIENT_FEE"`, `"txBAD_AUTH"`) from a FAILED
 * `getTransaction` response's `resultXdr` union, so the error we surface
 * names *why* the network rejected it rather than just that it did. Not the
 * Soroban contract's own error code — that lives in diagnostic events, which
 * `getTransaction` doesn't return — so this stays a coarser, but reliably
 * decodable, signal. Guarded since XDR union shapes vary across SDK minor
 * versions and this is best-effort, not load-bearing.
 */
function extractFailedResultCode(response: { resultXdr?: unknown }): string | null {
  try {
    const result = response.resultXdr as {
      result?: () => { switch?: () => { name?: string } };
    };
    const name = result?.result?.()?.switch?.()?.name;
    return typeof name === "string" ? name : null;
  } catch {
    return null;
  }
}

/**
 * Renders a backend error body as a single user-facing message.
 *
 * `ValidationError` bodies are expanded to `message` plus the per-field
 * messages from `details` (or the `fields` map) so the UI shows the actual
 * reason the request was rejected instead of a generic "ValidationError".
 */
export function extractBackendErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === "string") {
    return firstString(body) ?? fallback;
  }

  if (!isRecord(body)) return fallback;

  const message = firstString(body.message);
  const details = collectValidationDetails(body);

  if (details.length > 0) {
    return [message ?? firstString(body.error) ?? fallback, ...details].join(": ");
  }

  return firstString(body.error, body.message) ?? fallback;
}

/** Flattens `details` / `fields` from a ValidationError body into messages. */
function collectValidationDetails(body: Record<string, unknown>): string[] {
  const details: string[] = [];

  if (Array.isArray(body.details)) {
    for (const entry of body.details) {
      const detail = firstString(isRecord(entry) ? entry.message : entry);
      if (detail && !details.includes(detail)) {
        details.push(detail);
      }
    }
  }

  if (isRecord(body.fields)) {
    for (const value of Object.values(body.fields)) {
      const detail = firstString(value);
      if (detail && !details.includes(detail)) {
        details.push(detail);
      }
    }
  }

  return details;
}

async function parseErrorResponse(res: Response, fallback: string): Promise<string> {
  try {
    return extractBackendErrorMessage(await res.json(), fallback);
  } catch {
    return fallback;
  }
}

export async function submitContractTransaction({
  contractId = CONTRACT_ID,
  method,
  args,
  sourceAddress,
  signTransaction,
  onPhase,
  setSimulationResult,
}: {
  /**
   * Contract to call. Defaults to the configured `CONTRACT_ID`; each escrow
   * created through the factory is its own contract, so job actions pass the
   * job's id, and the create flow passes `FACTORY_CONTRACT_ID`.
   */
  contractId?: string;
  method: string;
  args: ContractArg[];
  sourceAddress: string;
  signTransaction: (xdr: string) => Promise<string>;
  onPhase?: (phase: TxPhase) => void;
  /** Set after a Soroban simulation completes; triggers fee warning evaluation. */
  setSimulationResult?: (result: WalletSimulationResult | null) => void;
}): Promise<string> {
  onPhase?.("building");

  // The build must not hang forever (#825): a stuck backend would leave the
  // action in "Preparing..." with no way to retry without a reload.
  const buildTimeout = createRequestTimeout(API_REQUEST_TIMEOUT_MS);
  let buildTxRes: Response;
  try {
    buildTxRes = await fetch(`${BACKEND_URL}/api/jobs/build-tx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractId,
        method,
        args,
        sourceAddress,
      }),
      signal: buildTimeout.signal,
    });
  } catch (err) {
    if (buildTimeout.timedOut) {
      throw new TxRequestTimeoutError("Preparing the transaction timed out. Please try again.");
    }
    throw err;
  } finally {
    buildTimeout.clear();
  }

  if (!buildTxRes.ok) {
    const message = await parseErrorResponse(
      buildTxRes,
      "We could not prepare your transaction. Please try again."
    );
    throw new Error(message);
  }

  const buildTxBody: unknown = await buildTxRes.json();
  // The standard `data` envelope first, then the deprecated top-level copy.
  const xdr = isRecord(buildTxBody)
    ? firstString(isRecord(buildTxBody.data) ? buildTxBody.data.xdr : undefined, buildTxBody.xdr)
    : null;

  if (!xdr) {
    throw new Error("We could not prepare your transaction. Please try again.");
  }

  // Refuse to sign anything but the call that was requested (#889): the
  // backend, or anything between it and the browser, could otherwise swap in
  // a different transaction for the wallet to approve.
  try {
    verifyPreparedTransaction(xdr, { contractId, method, args, sourceAddress });
  } catch (err) {
    if (err instanceof PreparedTransactionMismatchError) {
      reportClientError({
        source: "tx",
        message: `Prepared transaction mismatch for ${method}: ${err.reason}`,
      });
    }
    throw err;
  }

  // Hand any simulation result to the wallet context so the fee warning
  // banner can evaluate it (#631). Accepts the result at the top level or
  // inside the standard `data` envelope.
  const simulationResult = isRecord(buildTxBody)
    ? (buildTxBody.simulationResult ??
      (isRecord(buildTxBody.data) ? buildTxBody.data.simulationResult : undefined))
    : undefined;
  if (setSimulationResult && isRecord(simulationResult)) {
    setSimulationResult(simulationResult as unknown as WalletSimulationResult);
  }

  onPhase?.("signing");

  // The wallet context owns the signature timeout (#628): it derives the
  // bound from the transaction's maxTime, clears sensitive memory, and sets
  // `signatureTimeoutError` for the SignatureTimeoutAlert. We hand the XDR
  // straight to it and let it raise WalletSignatureTimeoutError on timeout.
  const signRequest: TxSignRequest = { xdr };
  const signedXdr = await signTransaction(signRequest.xdr);
  clearTxSensitiveMemory(signRequest);

  if (!signedXdr) {
    throw new WalletRejectedError();
  }

  onPhase?.("submitting");

  // Longer bound than build-tx (#825): the backend waits for on-chain
  // confirmation before answering. If it still doesn't answer, the signed
  // transaction may already be out, so the error carries the locally
  // computed hash for the user to check.
  const submitTimeout = createRequestTimeout(SUBMIT_REQUEST_TIMEOUT_MS);
  let submitRes: Response;
  try {
    submitRes = await fetch(`${BACKEND_URL}/api/jobs/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedXdr }),
      signal: submitTimeout.signal,
    });
  } catch (err) {
    if (submitTimeout.timedOut) {
      throw buildSubmitTimeoutError(signedXdr);
    }
    throw err;
  } finally {
    submitTimeout.clear();
  }

  if (!submitRes.ok) {
    const message = await parseErrorResponse(
      submitRes,
      "Your transaction could not be submitted. Please try again."
    );
    throw new Error(message);
  }

  const result: unknown = await submitRes.json();
  const txHash = extractSubmitTxHash(result);

  if (!txHash) {
    throw new Error(
      "Your transaction was submitted but the backend did not return a transaction hash."
    );
  }

  // A 200 here is only sendTransaction's acknowledgement that the network
  // *queued* the transaction (PENDING) — ERROR / TRY_AGAIN_LATER mean it
  // never queued at all, and even PENDING can still fail once applied, so
  // neither is a real success yet (#570).
  const submitStatus = extractSubmitStatus(result);
  if (submitStatus && SUBMIT_FAILURE_STATUSES.has(submitStatus.toUpperCase())) {
    throw new Error("Your transaction could not be submitted. Please try again.");
  }

  onPhase?.("confirming");
  await waitForTransactionConfirmation(txHash);

  return txHash;
}

export async function runContractAction(
  key: string,
  txFn: (onPhase: (phase: TxPhase) => void) => Promise<string>,
  handlers: {
    isPending: (key: string) => boolean;
    setPhase: (key: string, phase: TxPhase) => void;
    setError: (key: string, error: string | null) => void;
    setTxHash: (key: string, txHash: string | null) => void;
  }
): Promise<string | null> {
  if (handlers.isPending(key)) return null;

  handlers.setPhase(key, "building");
  handlers.setError(key, null);
  handlers.setTxHash(key, null);

  try {
    const txHash = await txFn((phase) => handlers.setPhase(key, phase));
    handlers.setPhase(key, "success");
    handlers.setTxHash(key, txHash || null);
    return txHash;
  } catch (err) {
    handlers.setPhase(key, "error");
    handlers.setError(key, formatTxError(err));
    return null;
  }
}
