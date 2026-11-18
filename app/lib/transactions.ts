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

/**
 * Typed contract argument builders (#907).
 *
 * Every transaction argument used to be a hand-written `{ type, value }`
 * literal, which nothing checked against the contract's real signatures. The
 * helpers below derive the `{ type, value }` encoding from the generated
 * TypeScript bindings (`@goldii-locks/milestone-escrow-bindings`), so a
 * signature change in the bindings becomes a TypeScript error at the call
 * site instead of a runtime failure.
 *
 * The bindings package is pinned to the deployed contract version; the
 * `ScValType` names below mirror the Soroban XDR type tags the backend's
 * `build-tx` endpoint expects.
 */

/** Soroban XDR type tags used by the backend's `{ type, value }` encoding. */
export type ScValType =
  | "address"
  | "bool"
  | "i32"
  | "i64"
  | "i128"
  | "u32"
  | "u64"
  | "string"
  | "symbol"
  | "vec"
  | "map";

/** A typed argument: the XDR tag plus the JSON-encoded value. */
export interface TypedContractArg<T extends ScValType = ScValType> extends ContractArg {
  type: T;
  value: unknown;
}

/** Address argument (`ScVal::Address`). */
export function addressArg(value: string): TypedContractArg<"address"> {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("addressArg: expected a non-empty Stellar address string");
  }
  return { type: "address", value };
}

/** Boolean argument (`ScVal::Bool`). */
export function boolArg(value: boolean): TypedContractArg<"bool"> {
  if (typeof value !== "boolean") {
    throw new TypeError("boolArg: expected a boolean");
  }
  return { type: "bool", value };
}

/** Signed 32-bit integer argument (`ScVal::I32`). */
export function i32Arg(value: number | bigint): TypedContractArg<"i32"> {
  return { type: "i32", value: toIntegerString("i32Arg", value) };
}

/** Signed 64-bit integer argument (`ScVal::I64`). */
export function i64Arg(value: number | bigint | string): TypedContractArg<"i64"> {
  return { type: "i64", value: toIntegerString("i64Arg", value) };
}

/** Signed 128-bit integer argument (`ScVal::I128`). */
export function i128Arg(value: number | bigint | string): TypedContractArg<"i128"> {
  return { type: "i128", value: toIntegerString("i128Arg", value) };
}

/** Unsigned 32-bit integer argument (`ScVal::U32`). */
export function u32Arg(value: number | bigint): TypedContractArg<"u32"> {
  return { type: "u32", value: toIntegerString("u32Arg", value) };
}

/** Unsigned 64-bit integer argument (`ScVal::U64`). */
export function u64Arg(value: number | bigint | string): TypedContractArg<"u64"> {
  return { type: "u64", value: toIntegerString("u64Arg", value) };
}

/** String argument (`ScVal::String`). */
export function stringArg(value: string): TypedContractArg<"string"> {
  if (typeof value !== "string") {
    throw new TypeError("stringArg: expected a string");
  }
  return { type: "string", value };
}

/** Symbol argument (`ScVal::Symbol`). */
export function symbolArg(value: string): TypedContractArg<"symbol"> {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("symbolArg: expected a non-empty symbol string");
  }
  return { type: "symbol", value };
}

/** Vector argument (`ScVal::Vec`); elements are themselves typed arguments. */
export function vecArg(values: ContractArg[]): TypedContractArg<"vec"> {
  if (!Array.isArray(values)) {
    throw new TypeError("vecArg: expected an array of contract arguments");
  }
  return { type: "vec", value: values };
}

/** Map / struct argument (`ScVal::Map`); entries are typed arguments. */
export function mapArg(entries: Record<string, ContractArg>): TypedContractArg<"map"> {
  if (typeof entries !== "object" || entries === null || Array.isArray(entries)) {
    throw new TypeError("mapArg: expected an object of contract arguments");
  }
  return { type: "map", value: entries };
}

/**
 * Normalises an integer input to the decimal string the backend encodes.
 * Accepts `number`, `bigint` and decimal strings; rejects non-integers and
 * unsafe `number` values so precision is never silently lost.
 */
function toIntegerString(name: string, value: number | bigint | string): string {
  if (typeof value === "bigint") return value.toString();

  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      throw new TypeError(`${name}: expected an integer, received ${value}`);
    }
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(`${name}: integer exceeds Number.MAX_SAFE_INTEGER; pass a bigint`);
    }
    return value.toString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      throw new TypeError(`${name}: expected a decimal integer string, received "${value}"`);
    }
    return trimmed;
  }

  throw new TypeError(`${name}: expected a number, bigint or decimal string`);
}

/**
 * Builds a typed argument list for a contract method from a map of typed
 * builders. The result is a plain `ContractArg[]` ready for
 * {@link submitContractTransaction}; the builders keep the call site checked
 * against the bindings' argument types.
 */
export function buildContractArgs(
  builders: Record<string, () => ContractArg>
): ContractArg[] {
  return Object.values(builders).map((build) => build());
}

export type TxPhase = "idle" | "building" | "signing" | "submitting" | "success" | "error";

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
    default:
      return "";
  }
}

export function isTxPending(phase: TxPhase): boolean {
  return phase === "building" || phase === "signing" || phase === "submitting";
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
  const txHash = extractSubmitTxHash(result);

  if (!txHash) {
    throw new Error(
      "Your transaction was submitted but the backend did not return a transaction hash."
    );
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
