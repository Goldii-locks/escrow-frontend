import { BACKEND_URL, CONTRACT_ID, FACTORY_CONTRACT_ID } from "@/app/lib/config";
import { formatTxError, WalletRejectedError } from "@/app/lib/errors";
import type { WalletSimulationResult } from "@/app/lib/wallet_session";

/**
 * `BACKEND_URL`, `CONTRACT_ID` and `FACTORY_CONTRACT_ID` are deployment
 * settings and live in `app/lib/config.ts`; they are re-exported here because
 * every caller already imports this module and tests mock it.
 */
export { BACKEND_URL, CONTRACT_ID, FACTORY_CONTRACT_ID };

export type ContractArg = { type: string; value: unknown };

export type TxPhase =
  "idle" | "building" | "signing" | "submitting" | "confirming" | "success" | "error";

/** Default bound used by {@link signTxWithTimeout}. */
export const DEFAULT_SIGNING_TIMEOUT_MS = 60_000;

/** Default bound used when polling Soroban `getTransaction` after submit (#570). */
export const DEFAULT_CONFIRMATION_TIMEOUT_MS = 30_000;

/** Default interval between Soroban `getTransaction` polls (#570). */
export const DEFAULT_CONFIRMATION_POLL_INTERVAL_MS = 1_500;

/** Minimal Soroban RPC client shape required for confirmation polling (#570). */
export interface TxConfirmationRpc {
  getTransaction: (hash: string) => Promise<{ status: string }>;
}

/**
 * Thrown when a submitted transaction remains `NOT_FOUND` past the configured
 * confirmation polling deadline (#570).
 */
export class TxConfirmationTimeoutError extends Error {
  readonly txHash: string;

  constructor(txHash: string, timeoutMs: number) {
    super(`Transaction confirmation timed out after ${timeoutMs}ms`);
    this.name = "TxConfirmationTimeoutError";
    this.txHash = txHash;
  }
}

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
      return "Confirming…";
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

/**
 * Extracts the normalized `sendTransaction` status (`PENDING`, `SUCCESS`,
 * `ERROR`, `TRY_AGAIN_LATER`, `DUPLICATE`, …) from a `/api/jobs/submit` body,
 * or `null` when no status field is present (#570).
 */
export function extractSubmitTxStatus(body: unknown): string | null {
  if (!isRecord(body)) return null;

  const data = isRecord(body.data) ? body.data : undefined;
  const raw = firstString(data?.status, body.status);
  return raw ? raw.toUpperCase() : null;
}

function unwrapField(obj: unknown, key: string): unknown {
  if (!isRecord(obj)) return undefined;
  const val = obj[key];
  return typeof val === "function" ? (val as () => unknown).call(obj) : val;
}

function getUnionType(obj: unknown): string | null {
  if (!isRecord(obj)) return null;
  if (typeof obj.type === "string") return obj.type;
  if (typeof obj.switch === "function") {
    const sw = (obj.switch as () => unknown).call(obj);
    if (isRecord(sw) && typeof sw.name === "string") return sw.name;
  }
  return null;
}

function findContractCodeInScVal(scVal: unknown): number | null {
  const kind = getUnionType(scVal);
  if (!kind) return null;

  if (kind === "scvError") {
    const err = unwrapField(scVal, "error");
    if (getUnionType(err) === "sceContract") {
      const code = unwrapField(err, "contractCode");
      if (typeof code === "number" && Number.isFinite(code)) return code;
    }
    return null;
  }

  if (kind === "scvVec") {
    const items = unwrapField(scVal, "vec");
    if (Array.isArray(items)) {
      for (const item of items) {
        const found = findContractCodeInScVal(item);
        if (found !== null) return found;
      }
    }
  }

  if (kind === "scvMap") {
    const entries = unwrapField(scVal, "map");
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        const found =
          findContractCodeInScVal(unwrapField(entry, "key")) ??
          findContractCodeInScVal(unwrapField(entry, "val"));
        if (found !== null) return found;
      }
    }
  }

  return null;
}

function findContractCodeInDiagnosticEvent(diagEvent: unknown): number | null {
  if (!isRecord(diagEvent)) return null;

  try {
    const contractEvent = unwrapField(diagEvent, "event");
    const body = unwrapField(contractEvent, "body");
    const v0 = unwrapField(body, "v0");
    const topics = unwrapField(v0, "topics");
    if (Array.isArray(topics)) {
      for (const topic of topics) {
        const code = findContractCodeInScVal(topic);
        if (code !== null) return code;
      }
    }
    return findContractCodeInScVal(unwrapField(v0, "data"));
  } catch {
    return null;
  }
}

function decodeTxResultCode(txResult: unknown): string | null {
  if (!isRecord(txResult)) return null;

  try {
    const inner = unwrapField(txResult, "result");
    const outerName = getUnionType(inner);

    if (outerName === "txFailed") {
      const opResults = unwrapField(inner, "results");
      if (Array.isArray(opResults)) {
        for (const opRes of opResults) {
          const tr = unwrapField(opRes, "tr");
          if (isRecord(tr)) {
            const innerResult =
              typeof tr.value === "function"
                ? (tr.value as () => unknown).call(tr)
                : Object.entries(tr).find(([k]) => k !== "type")?.[1];
            const opDetail = getUnionType(innerResult) ?? getUnionType(tr);
            if (opDetail) return opDetail;
          }
        }
      }
    }

    return outerName;
  } catch {
    return null;
  }
}

/**
 * Produces a descriptive failure message from a failed `sendTransaction` or
 * `getTransaction` payload (#570).
 *
 * When a Soroban contract revert code is present (either explicitly or inside
 * `diagnosticEventsXdr` / `resultMetaXdr`), the message is formatted as
 * `"Contract execution reverted (error code N)"` so `formatTxError` maps `N`
 * to the human-readable `ERROR_MESSAGES[N]` copy. Otherwise the decoded XDR
 * transaction / operation result code is surfaced.
 */
export async function decodeTxFailureMessage(payload: unknown, fallback: string): Promise<string> {
  if (!isRecord(payload)) return fallback;

  const data = isRecord(payload.data) ? payload.data : undefined;
  const merged: Record<string, unknown> = data ? { ...payload, ...data } : payload;

  const numericCode =
    typeof merged.contractErrorCode === "number"
      ? merged.contractErrorCode
      : typeof merged.errorCode === "number"
        ? merged.errorCode
        : null;
  if (numericCode !== null && Number.isFinite(numericCode)) {
    return `Contract execution reverted (error code ${numericCode})`;
  }

  const explicitMessage = firstString(merged.error, merged.message);
  if (explicitMessage) {
    return explicitMessage;
  }

  const hasXdrFields =
    merged.diagnosticEventsXdr !== undefined ||
    merged.resultMetaXdr !== undefined ||
    merged.resultXdr !== undefined ||
    merged.errorResultXdr !== undefined;

  if (hasXdrFields) {
    try {
      const { xdr } = await import("@stellar/stellar-sdk");

      if (Array.isArray(merged.diagnosticEventsXdr)) {
        for (const rawEvent of merged.diagnosticEventsXdr) {
          const parsed =
            typeof rawEvent === "string"
              ? xdr.DiagnosticEvent.fromXDR(rawEvent, "base64")
              : rawEvent;
          const code = findContractCodeInDiagnosticEvent(parsed);
          if (code !== null) {
            return `Contract execution reverted (error code ${code})`;
          }
        }
      }

      if (merged.resultMetaXdr !== undefined && merged.resultMetaXdr !== null) {
        const rawMeta =
          typeof merged.resultMetaXdr === "string"
            ? xdr.TransactionMeta.fromXDR(merged.resultMetaXdr, "base64")
            : merged.resultMetaXdr;
        const metaInner = unwrapField(rawMeta, "v4") ?? unwrapField(rawMeta, "v3");
        const sorobanMeta = unwrapField(metaInner, "sorobanMeta");
        const diagEvents =
          unwrapField(sorobanMeta, "diagnosticEvents") ??
          unwrapField(metaInner, "diagnosticEvents");
        if (Array.isArray(diagEvents)) {
          for (const ev of diagEvents) {
            const code = findContractCodeInDiagnosticEvent(ev);
            if (code !== null) {
              return `Contract execution reverted (error code ${code})`;
            }
          }
        }
      }

      const rawTxResult = merged.resultXdr ?? merged.errorResultXdr;
      if (rawTxResult !== undefined && rawTxResult !== null) {
        const txResult =
          typeof rawTxResult === "string"
            ? xdr.TransactionResult.fromXDR(rawTxResult, "base64")
            : rawTxResult;
        const resultCode = decodeTxResultCode(txResult);
        if (resultCode) {
          return `Transaction failed on-chain (${resultCode}).`;
        }
      }
    } catch {
      // Fall through to string resultCode / fallback if XDR payload is malformed.
    }
  }

  const resultCode = firstString(merged.resultCode);
  if (resultCode) {
    return `Transaction failed on-chain (${resultCode}).`;
  }

  return fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Polls Soroban `getTransaction(txHash)` until the network reports `SUCCESS`
 * or `FAILED`, bounded by `confirmationTimeoutMs` (#570).
 */
export async function confirmTransactionOnNetwork(
  txHash: string,
  options?: {
    rpcServer?: TxConfirmationRpc;
    pollIntervalMs?: number;
    confirmationTimeoutMs?: number;
  }
): Promise<string> {
  const timeoutMs = options?.confirmationTimeoutMs ?? DEFAULT_CONFIRMATION_TIMEOUT_MS;
  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_CONFIRMATION_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  const server: TxConfirmationRpc =
    options?.rpcServer ?? (await (await import("@/app/lib/config")).createRpcServer());

  while (true) {
    const txResponse = await server.getTransaction(txHash);
    const status = typeof txResponse.status === "string" ? txResponse.status.toUpperCase() : "";

    if (status === "SUCCESS") {
      return txHash;
    }

    if (status === "FAILED") {
      const message = await decodeTxFailureMessage(txResponse, "Transaction failed on-chain.");
      throw new Error(message);
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new TxConfirmationTimeoutError(txHash, timeoutMs);
    }

    await sleep(Math.min(pollIntervalMs, remainingMs));
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
  rpcServer,
  pollIntervalMs,
  confirmationTimeoutMs,
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
  /** Optional Soroban RPC client override for confirmation polling (#570). */
  rpcServer?: TxConfirmationRpc;
  /** Optional polling interval override in milliseconds (#570). */
  pollIntervalMs?: number;
  /** Optional confirmation timeout override in milliseconds (#570). */
  confirmationTimeoutMs?: number;
}): Promise<string> {
  onPhase?.("building");

  const buildTxRes = await fetch(`${BACKEND_URL}/api/jobs/build-tx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contractId,
      method,
      args,
      sourceAddress,
    }),
  });

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

  const submitRes = await fetch(`${BACKEND_URL}/api/jobs/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signedXdr }),
  });

  if (!submitRes.ok) {
    const message = await parseErrorResponse(
      submitRes,
      "Your transaction could not be submitted. Please try again."
    );
    throw new Error(message);
  }

  const result: unknown = await submitRes.json();
  const submitStatus = extractSubmitTxStatus(result);

  if (submitStatus === "TRY_AGAIN_LATER") {
    const message = await decodeTxFailureMessage(
      result,
      "The network is busy (TRY_AGAIN_LATER). Please try again in a moment."
    );
    throw new Error(message);
  }

  if (submitStatus === "ERROR" || submitStatus === "FAILED") {
    const message = await decodeTxFailureMessage(
      result,
      "Your transaction was rejected by the network."
    );
    throw new Error(message);
  }

  const txHash = extractSubmitTxHash(result);

  if (!txHash) {
    throw new Error(
      "Your transaction was submitted but the backend did not return a transaction hash."
    );
  }

  if (submitStatus === "PENDING" || submitStatus === "DUPLICATE") {
    onPhase?.("confirming");
    return confirmTransactionOnNetwork(txHash, {
      rpcServer,
      pollIntervalMs,
      confirmationTimeoutMs,
    });
  }

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
