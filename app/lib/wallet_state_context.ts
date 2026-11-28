/**
 * wallet_state_context — public API for the active wallet context store.
 *
 * Loader helpers live in `wallet_loader.ts`.
 * Console-warning and tx-tracking helpers live in `wallet_log.ts`.
 * This module re-exports both so existing imports keep working, and owns
 * the multi-signature assembly helpers and the signing-timeout that
 * WalletContext.tsx relies on.
 */

import { TransactionBuilder } from "@stellar/stellar-sdk";

// ── Re-exports from wallet_loader ─────────────────────────────────────────────
export {
  isWalletLoading,
  subscribeToWalletLoading,
  startWalletOperation,
  endWalletOperation,
  withWalletLoader,
} from "./wallet_loader";

// ── Re-exports from wallet_log ────────────────────────────────────────────────
export {
  type WalletTxPhase,
  type WalletTxTrackEntry,
  type WalletConsoleWarningBlock,
  formatStackTrace,
  formatConsoleWarningBlock,
  logWalletWarning,
  WalletTransactionTracker,
} from "./wallet_log";

// =============================================================
// Multi-signature transaction assembly helpers (#119)
// =============================================================

/** Default minimum signature count required for a multi-sig assembly. */
export const DEFAULT_MULTISIG_MIN_SIGNATURES = 2;

/** Stable error codes carried on {@link WalletMultiSigStructureError}. */
export type WalletMultiSigErrorCode =
  | "empty_xdr"
  | "invalid_base64"
  | "malformed_envelope"
  | "missing_signatures"
  | "decorator_mismatch"
  | "insufficient_signatures"
  | "duplicate_signer"
  | "envelope_parse_failure";

/**
 * Raised whenever a multi-signature assembly or envelope fails one of the
 * structural checks. Carries a stable {@link code} so callers can branch on
 * the failure mode without parsing strings.
 */
export class WalletMultiSigStructureError extends Error {
  readonly code: WalletMultiSigErrorCode;
  constructor(code: WalletMultiSigErrorCode, message: string) {
    super(message);
    this.name = "WalletMultiSigStructureError";
    this.code = code;
  }
}

/** One signer slot in a multi-sig envelope. */
export interface WalletMultiSigSigner {
  publicKey: string;
  hint: string;
}

/** Parsed structural view of a multi-sig transaction envelope. */
export interface WalletMultiSigEnvelopeShape {
  baseXdr: string;
  signatures: number;
  sourceAccount: string | null;
  signatureSlotIndices: number[];
}

/**
 * Shape returned by an XDR-aware envelope parser injected via
 * {@link WalletMultiSigParseOptions.parseEnvelopeXdr}.
 */
export interface WalletMultiSigEnvelopeParsed {
  signatures: number;
  sourceAccount: string | null;
}

/** Optional hooks for {@link parseMultiSigEnvelope}. */
export interface WalletMultiSigParseOptions {
  parseEnvelopeXdr?: (baseXdr: string) => WalletMultiSigEnvelopeParsed;
  countSignatures?: (bytes: Uint8Array) => number;
  sourceAccount?: string | null;
  expectedSignatures?: number;
}

/** Options for {@link validateMultiSigAssembly}. */
export interface WalletMultiSigAssemblyOptions {
  minRequired?: number;
  parseOptions?: WalletMultiSigParseOptions;
}

/** One signed slice of a multi-sig flow belonging to a single signer. */
export interface WalletMultiSigSplit {
  baseXdr: string;
  signer: WalletMultiSigSigner;
  signedXdr: string;
}

/** Summary returned by {@link validateMultiSigAssembly} on success. */
export interface WalletMultiSigAssemblyResult {
  uniqueSigners: number;
  splitsValidated: number;
}

function decodeBase64Envelope(input: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(input, "base64"));
  }
  try {
    const binary = atob(input);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch (err) {
    throw new WalletMultiSigStructureError(
      "invalid_base64",
      err instanceof Error
        ? `Multi-sig envelope XDR is not valid base64: ${err.message}`
        : "Multi-sig envelope XDR is not valid base64."
    );
  }
}

function encodeBase64Envelope(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function normalizeBase64(value: string): string {
  return value.replace(/=+$/, "").replace(/\s+/g, "");
}

const DEFAULT_SIGNATURE_SLOT_EXTRACTOR = (bytes: Uint8Array): number => {
  if (bytes.length === 0) return 0;
  return Math.max(1, Math.floor(bytes.length / 80));
};

export function parseMultiSigEnvelope(
  baseXdr: string,
  options: WalletMultiSigParseOptions = {}
): WalletMultiSigEnvelopeShape {
  if (typeof baseXdr !== "string") {
    throw new WalletMultiSigStructureError("empty_xdr", "Multi-sig envelope XDR must be a string.");
  }
  const trimmed = baseXdr.trim();
  if (trimmed.length === 0) {
    throw new WalletMultiSigStructureError("empty_xdr", "Multi-sig envelope XDR is empty.");
  }
  const bytes = decodeBase64Envelope(trimmed);
  if (bytes.length === 0) {
    throw new WalletMultiSigStructureError(
      "malformed_envelope",
      "Multi-sig envelope XDR decodes to an empty byte payload."
    );
  }
  const original = normalizeBase64(trimmed);
  const reEncoded = normalizeBase64(encodeBase64Envelope(bytes));
  if (original !== reEncoded) {
    throw new WalletMultiSigStructureError(
      "invalid_base64",
      "Multi-sig envelope XDR round-trip mismatch — input is not valid base64."
    );
  }
  let signatures: number | undefined;
  let parsedSourceAccount: string | null | undefined;
  if (options.parseEnvelopeXdr) {
    let parsed: WalletMultiSigEnvelopeParsed;
    try {
      parsed = options.parseEnvelopeXdr(trimmed);
    } catch (err) {
      if (err instanceof WalletMultiSigStructureError) throw err;
      throw new WalletMultiSigStructureError(
        "envelope_parse_failure",
        err instanceof Error
          ? `Multi-sig envelope XDR could not be parsed: ${err.message}`
          : "Multi-sig envelope XDR could not be parsed."
      );
    }
    if (!parsed || typeof parsed.signatures !== "number" || !Number.isFinite(parsed.signatures)) {
      throw new WalletMultiSigStructureError(
        "envelope_parse_failure",
        "Multi-sig envelope parser returned an invalid shape — `signatures` must be a finite number."
      );
    }
    signatures = parsed.signatures;
    parsedSourceAccount = parsed.sourceAccount ?? null;
  }
  if (typeof signatures !== "number") {
    signatures = (options.countSignatures ?? DEFAULT_SIGNATURE_SLOT_EXTRACTOR)(bytes);
    if (signatures < 1) {
      throw new WalletMultiSigStructureError(
        "missing_signatures",
        "Multi-sig envelope contains zero signature slots."
      );
    }
  }
  if (typeof options.expectedSignatures === "number" && signatures !== options.expectedSignatures) {
    throw new WalletMultiSigStructureError(
      "decorator_mismatch",
      `Multi-sig envelope has ${signatures} signature slot(s); expected ${options.expectedSignatures}.`
    );
  }
  const sourceAccount =
    parsedSourceAccount && parsedSourceAccount.length > 0
      ? parsedSourceAccount
      : Object.hasOwn(options, "sourceAccount")
        ? (options.sourceAccount ?? null)
        : null;
  return {
    baseXdr: trimmed,
    signatures,
    sourceAccount,
    signatureSlotIndices: Array.from({ length: signatures }, (_, i) => i + 1),
  };
}

export function createMultiSigSplit(
  baseXdr: string,
  signer: WalletMultiSigSigner
): WalletMultiSigSplit {
  if (typeof baseXdr !== "string" || baseXdr.trim().length === 0) {
    throw new WalletMultiSigStructureError(
      "empty_xdr",
      "Multi-sig split cannot be created from an empty XDR."
    );
  }
  if (
    !signer ||
    typeof signer.publicKey !== "string" ||
    signer.publicKey.length === 0 ||
    typeof signer.hint !== "string" ||
    signer.hint.length === 0
  ) {
    throw new WalletMultiSigStructureError(
      "malformed_envelope",
      "Multi-sig split requires both a non-empty publicKey and a non-empty hint."
    );
  }
  return {
    baseXdr: baseXdr.trim(),
    signer: { publicKey: signer.publicKey, hint: signer.hint },
    signedXdr: baseXdr.trim(),
  };
}

export function applyMultiSigSignature(
  split: WalletMultiSigSplit,
  signedXdr: string
): WalletMultiSigSplit {
  if (typeof signedXdr !== "string" || signedXdr.trim().length === 0) {
    throw new WalletMultiSigStructureError("empty_xdr", "Multi-sig split signed XDR is empty.");
  }
  split.signedXdr = signedXdr.trim();
  return split;
}

function signerKey(signer: WalletMultiSigSigner): string {
  return `${signer.publicKey}:${signer.hint ?? ""}`;
}

export function simulateMultiSigAssembly(splits: WalletMultiSigSplit[]): {
  uniqueSigners: number;
  duplicates: WalletMultiSigSigner[];
} {
  const seen = new Set<string>();
  const duplicates: WalletMultiSigSigner[] = [];
  for (const split of splits ?? []) {
    if (!split?.signer?.publicKey) continue;
    const key = signerKey(split.signer);
    if (seen.has(key)) {
      duplicates.push({
        publicKey: split.signer.publicKey,
        hint: split.signer.hint ?? "",
      });
    } else {
      seen.add(key);
    }
  }
  return { uniqueSigners: seen.size, duplicates };
}

export function validateMultiSigAssembly(
  splits: WalletMultiSigSplit[],
  options: WalletMultiSigAssemblyOptions = {}
): WalletMultiSigAssemblyResult {
  const min = options.minRequired ?? DEFAULT_MULTISIG_MIN_SIGNATURES;
  const safeSplits = Array.isArray(splits) ? splits : [];
  for (const split of safeSplits) {
    parseMultiSigEnvelope(split.baseXdr, options.parseOptions ?? {});
  }
  const sim = simulateMultiSigAssembly(safeSplits);
  if (sim.duplicates.length > 0) {
    throw new WalletMultiSigStructureError(
      "duplicate_signer",
      `Multi-sig assembly contains duplicate signer(s): ${sim.duplicates
        .map((s) => s.publicKey)
        .join(", ")}.`
    );
  }
  if (sim.uniqueSigners < min) {
    throw new WalletMultiSigStructureError(
      "insufficient_signatures",
      `Multi-sig assembly has ${sim.uniqueSigners} unique signature(s); minimum required is ${min}.`
    );
  }
  return {
    uniqueSigners: sim.uniqueSigners,
    splitsValidated: safeSplits.length,
  };
}

function extractSourceAccount(env: unknown): string | null {
  if (!env || typeof env !== "object") return null;
  const record = env as Record<string, unknown>;
  const source = record["source"];
  if (source) {
    const stringified = stringifyStellarAccount(source);
    if (stringified) return stringified;
  }
  const feeSource = record["feeSource"] ?? record["feeAccount"];
  if (feeSource) {
    const stringified = stringifyStellarAccount(feeSource);
    if (stringified) return stringified;
  }
  return null;
}

function stringifyStellarAccount(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const accountId = candidate["accountId"];
  if (typeof accountId === "function") {
    try {
      const result = (accountId as () => unknown).call(value);
      if (typeof result === "string" && result.length > 0) return result;
    } catch {
      // Swallow — accountId() extraction failure is non-fatal.
    }
  }
  return null;
}

export function createStellarEnvelopeParser(
  networkPassphrase: string
): (baseXdr: string) => WalletMultiSigEnvelopeParsed {
  if (typeof networkPassphrase !== "string" || networkPassphrase.trim().length === 0) {
    throw new Error("createStellarEnvelopeParser requires a non-empty network passphrase.");
  }
  const passphrase = networkPassphrase;
  return (baseXdr: string): WalletMultiSigEnvelopeParsed => {
    const env = TransactionBuilder.fromXDR(baseXdr, passphrase);
    if (!Array.isArray(env?.signatures)) {
      throw new Error(
        "createStellarEnvelopeParser: TransactionBuilder.fromXDR returned a shape without a signatures array."
      );
    }
    return {
      signatures: env.signatures.length,
      sourceAccount: extractSourceAccount(env),
    };
  };
}

// =============================================================
// Transaction signature time limit bounds (#114)
// =============================================================

/** Default bound for active wallet context signature requests. */
export const DEFAULT_WALLET_SIGNATURE_TIMEOUT_MS = 60_000;

export interface WalletSignRequest {
  xdr: string;
  /** Sensitive buffer cleared on timeout / completion. */
  payload?: Uint8Array | null;
}

export class WalletSignatureTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Wallet signature timed out after ${timeoutMs}ms`);
    this.name = "WalletSignatureTimeoutError";
  }
}

/** Zeroes and drops a sensitive buffer so it cannot be retained after abort. */
export function clearWalletSensitiveMemory(request: WalletSignRequest): WalletSignRequest {
  if (request.payload) {
    request.payload.fill(0);
  }
  request.payload = null;
  return request;
}

/**
 * Races an active wallet context signature operation against a timeout clock.
 * On timeout the operation is aborted and any sensitive payload memory is
 * cleared. This is the single signing-timeout implementation for the wallet
 * context; `submitContractTransaction` relies on it via WalletContext (#628).
 */
export async function signWalletWithTimeout<T>(
  request: WalletSignRequest,
  signFn: (xdr: string) => Promise<T>,
  timeoutMs: number = DEFAULT_WALLET_SIGNATURE_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      clearWalletSensitiveMemory(request);
      reject(new WalletSignatureTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([signFn(request.xdr), timeoutPromise]);
    clearWalletSensitiveMemory(request);
    return result;
  } catch (err) {
    if (timedOut || err instanceof WalletSignatureTimeoutError) {
      clearWalletSensitiveMemory(request);
    }
    throw err;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Seconds left before the transaction's `timeBounds.maxTime` (#628), read
 * from a base64 envelope XDR. Returns `null` when the envelope cannot be
 * parsed, has no upper bound, or has already expired.
 */
export function readTransactionMaxTimeSecs(xdr: string, nowMs: number = Date.now()): number | null {
  if (typeof xdr !== "string" || xdr.length === 0) return null;

  try {
    const parsed = TransactionBuilder.fromXDR(xdr, "Test SDF Network ; September 2015");
    const tx = "innerTransaction" in parsed ? parsed.innerTransaction : parsed;
    const maxTime = Number(tx.timeBounds?.maxTime ?? 0);
    if (!Number.isFinite(maxTime) || maxTime <= 0) return null;
    const remaining = Math.floor(maxTime - nowMs / 1000);
    return remaining > 0 ? remaining : null;
  } catch {
    return null;
  }
}
