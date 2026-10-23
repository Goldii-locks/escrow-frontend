/**
 * wallet_state_context — helpers backing the active wallet context store
 * (`app/context/WalletContext.tsx`): multi-signature transaction assembly,
 * boxed console warning / transaction-debug tracking, and a loader-overlay
 * listener pair. Mirrors the conventions already established by
 * `app/lib/network_sync_checker.ts` and `app/lib/ledger_usb_bridge.ts`.
 */

import { TransactionBuilder } from "@stellar/stellar-sdk";

const LOG_PREFIX = "[wallet_state_context]";

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
 * structural checks performed by the helper hooks. Carries a stable
 * {@link code} on top of the human-readable message so callers can branch
 * on the failure mode without parsing strings.
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
  /** Round-trippable base64 XDR string. */
  baseXdr: string;
  /** Number of signature slots the envelope was parsed with. */
  signatures: number;
  /** Optional pre-parsed source account attached by the caller. */
  sourceAccount: string | null;
  /**
   * One entry per signature slot, recording the slot index (1..N). These are
   * positional slots within the parsed envelope, not signer descriptors; use
   * {@link WalletMultiSigSplit.signer} to attach a real signer to a slot.
   */
  signatureSlotIndices: number[];
}

/**
 * Shape returned by an XDR-aware envelope parser injected via
 * {@link WalletMultiSigParseOptions.parseEnvelopeXdr}.
 */
export interface WalletMultiSigEnvelopeParsed {
  /** Number of `DecoratedSignature` slots the parsed envelope actually carries. */
  signatures: number;
  /** Source account string when available, otherwise `null`. */
  sourceAccount: string | null;
}

/** Optional hooks for {@link parseMultiSigEnvelope}. */
export interface WalletMultiSigParseOptions {
  /**
   * XDR-aware envelope parser. Receives the trimmed base64 XDR and returns
   * the real `DecoratedSignature` count plus the source account. Production
   * callers should supply this via {@link createStellarEnvelopeParser}; the
   * byte-level {@link countSignatures} hook remains as a fallback and for
   * tests that opt out of the real XDR parse path.
   *
   * When provided, this runs **before** {@link countSignatures}. A throw
   * here is re-thrown as a {@link WalletMultiSigStructureError} with code
   * `envelope_parse_failure` so callers can branch on the failure mode
   * without parsing string messages.
   */
  parseEnvelopeXdr?: (baseXdr: string) => WalletMultiSigEnvelopeParsed;
  /**
   * Override the default structural signature-count heuristic keyed on the
   * decoded byte length. Only consulted when {@link parseEnvelopeXdr} is
   * absent. The default is conservative and not a true XDR parse.
   */
  countSignatures?: (bytes: Uint8Array) => number;
  /** Source account to attach when no parseEnvelopeXdr supplies one. */
  sourceAccount?: string | null;
  /** Required signature slot count — mismatches throw `decorator_mismatch`. */
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
  /** Signed placeholder — callers overwrite once the wallet signs. */
  signedXdr: string;
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

/**
 * Default structural extractor. Yields a conservative signature slot count
 * based on envelope byte length when no real XDR parser has been injected.
 */
const DEFAULT_SIGNATURE_SLOT_EXTRACTOR = (bytes: Uint8Array): number => {
  if (bytes.length === 0) return 0;
  return Math.max(1, Math.floor(bytes.length / 80));
};

/**
 * Parses a multi-sig transaction envelope and returns its structural shape.
 * Validates: the XDR string is non-empty; the XDR string is valid base64
 * (verified by a round-trip); the decoded byte payload carries at least one
 * signature slot.
 */
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
    // Strict only for the byte-heuristic fallback: parseEnvelopeXdr path may
    // legitimately return 0 when the envelope is unsigned-so-far.
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

/**
 * Slices a base multi-sig XDR into a per-signer {@link WalletMultiSigSplit}.
 * The split's `signedXdr` is initialised to the base XDR so callers can pass
 * it directly to a wallet extension for signing, then overwrite once the
 * wallet returns its own signed XDR.
 */
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

/**
 * Records the wallet-signed XDR onto a {@link WalletMultiSigSplit}'s
 * `signedXdr` slot. Mutates the supplied split in place and returns the same
 * reference so call sites can chain further updates.
 */
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

/**
 * Builds a deterministic key for a signer so duplicate detection does not
 * depend on object identity.
 */
function signerKey(signer: WalletMultiSigSigner): string {
  return `${signer.publicKey}:${signer.hint ?? ""}`;
}

/**
 * Tolerant reducer over a list of splits: counts unique signers and surfaces
 * any duplicates (matched on `publicKey` + `hint`). Silently skips splits
 * whose `signer.publicKey` is empty — this is the count-only preview; strict
 * structural checks are performed by {@link validateMultiSigAssembly} which
 * always runs first.
 */
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

/** Summary returned by {@link validateMultiSigAssembly} on success. */
export interface WalletMultiSigAssemblyResult {
  uniqueSigners: number;
  splitsValidated: number;
}

/**
 * Validates a collection of multi-sig splits as a coherent assembly. Every
 * split's baseXDR is parsed, duplicate signers are flagged, and the unique
 * signer count is compared against {@link DEFAULT_MULTISIG_MIN_SIGNATURES}
 * (or the caller-supplied {@link WalletMultiSigAssemblyOptions.minRequired}).
 */
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

/** Pulls the source account off a parsed envelope, handling Transaction and FeeBump shapes. */
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

/**
 * Stringify a Stellar account descriptor (MuxedAccount-like). Prefers the
 * SDK's `accountId()` method, falls back to a plain string when the
 * descriptor is already a G/M address, and warns (instead of guessing) when
 * neither works.
 */
function stringifyStellarAccount(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const accountId = candidate["accountId"];
  if (typeof accountId === "function") {
    try {
      const result = (accountId as () => unknown).call(value);
      if (typeof result === "string" && result.length > 0) return result;
    } catch (err) {
      console.warn(
        `${LOG_PREFIX} stellar accountId() extraction failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }
  return null;
}

/**
 * Returns a {@link WalletMultiSigParseOptions.parseEnvelopeXdr}
 * implementation backed by the Stellar SDK's `TransactionBuilder.fromXDR`.
 * Use this from production paths so the multi-sig helpers see real
 * `DecoratedSignature` counts (and the actual source account) rather than
 * the byte-length heuristic.
 */
export function createStellarEnvelopeParser(
  networkPassphrase: string
): (baseXdr: string) => WalletMultiSigEnvelopeParsed {
  if (typeof networkPassphrase !== "string" || networkPassphrase.trim().length === 0) {
    throw new Error(
      `${LOG_PREFIX} createStellarEnvelopeParser requires a non-empty network passphrase.`
    );
  }
  const passphrase = networkPassphrase;
  return (baseXdr: string): WalletMultiSigEnvelopeParsed => {
    const env = TransactionBuilder.fromXDR(baseXdr, passphrase);
    if (!Array.isArray(env?.signatures)) {
      throw new Error(
        `${LOG_PREFIX} createStellarEnvelopeParser: TransactionBuilder.fromXDR returned a shape without a signatures array.`
      );
    }
    return {
      signatures: env.signatures.length,
      sourceAccount: extractSourceAccount(env),
    };
  };
}

// =============================================================
// Console error formatting + transaction tracking (#121)
// =============================================================

export type WalletTxPhase =
  | "idle"
  | "connecting"
  | "signing"
  | "disconnecting"
  | "success"
  | "error";

export interface WalletTxTrackEntry {
  txId: string;
  phase: WalletTxPhase;
  message: string;
  timestamp: number;
  stack?: string;
}

export interface WalletConsoleWarningBlock {
  title: string;
  body: string;
  stack: string;
  txId?: string;
  phase?: WalletTxPhase;
}

/** Captures a normalized stack string from an error or the current call site. */
export function formatStackTrace(err?: unknown): string {
  if (err instanceof Error && err.stack) {
    return err.stack;
  }

  if (typeof err === "string" && err.includes("\n")) {
    return err;
  }

  const synthetic = new Error(typeof err === "string" ? err : "Wallet state context trace");
  return synthetic.stack ?? "Error: Wallet state context trace";
}

/** Builds a multi-line console warning block for transaction debug tracking. */
export function formatConsoleWarningBlock(block: WalletConsoleWarningBlock): string {
  const lines = [
    `${LOG_PREFIX} ╔══════════════════════════════════════╗`,
    `${LOG_PREFIX} ║ ${block.title.padEnd(36).slice(0, 36)} ║`,
    `${LOG_PREFIX} ╚══════════════════════════════════════╝`,
    `${LOG_PREFIX} ${block.body}`,
  ];

  if (block.txId) {
    lines.push(`${LOG_PREFIX} txId: ${block.txId}`);
  }
  if (block.phase) {
    lines.push(`${LOG_PREFIX} phase: ${block.phase}`);
  }

  lines.push(`${LOG_PREFIX} --- stack trace ---`);
  for (const frame of block.stack.split("\n")) {
    lines.push(`${LOG_PREFIX} ${frame}`);
  }
  lines.push(`${LOG_PREFIX} --- end stack ---`);

  return lines.join("\n");
}

/** Logs a formatted warning block (including stack) to the console. */
export function logWalletWarning(
  title: string,
  body: string,
  options?: { err?: unknown; txId?: string; phase?: WalletTxPhase }
): string {
  const stack = formatStackTrace(options?.err);
  const formatted = formatConsoleWarningBlock({
    title,
    body,
    stack,
    txId: options?.txId,
    phase: options?.phase,
  });
  console.warn(formatted);
  return formatted;
}

export class WalletTransactionTracker {
  private entries: WalletTxTrackEntry[] = [];

  track(txId: string, phase: WalletTxPhase, message: string, err?: unknown): WalletTxTrackEntry {
    const entry: WalletTxTrackEntry = {
      txId,
      phase,
      message,
      timestamp: Date.now(),
      stack: formatStackTrace(err),
    };
    this.entries.push(entry);

    logWalletWarning(`TX ${phase.toUpperCase()}`, message, {
      err,
      txId,
      phase,
    });

    return entry;
  }

  getHistory(txId?: string): WalletTxTrackEntry[] {
    if (!txId) return [...this.entries];
    return this.entries.filter((e) => e.txId === txId);
  }

  clear(): void {
    this.entries = [];
  }
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
 * Races an active wallet context signature operation against a timeout
 * clock. On timeout the operation is aborted and any sensitive payload
 * memory is cleared.
 *
 * The timeout is derived from the transaction's own `maxTime` when one is
 * supplied (#628). A transaction whose envelope advertises no maxTime falls
 * back to `DEFAULT_WALLET_SIGNATURE_TIMEOUT_MS`; an unparseable XDR falls
 * back to the same default rather than hanging indefinitely. This keeps a
 * single timeout implementation — the one in WalletContext — and lets
 * `submitContractTransaction` rely on it.
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
 * Seconds left before the transaction's `timeBounds.maxTime` (#628), read from
 * a base64 envelope XDR. Returns `null` when the envelope can't be parsed, has
 * no upper bound (maxTime 0), or has already expired, so callers fall back to
 * the default bound instead of guessing.
 */
export function readTransactionMaxTimeSecs(xdr: string, nowMs: number = Date.now()): number | null {
  if (typeof xdr !== "string" || xdr.length === 0) return null;

  try {
    // maxTime is network-independent, so any passphrase parses the envelope.
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

// =============================================================
// Loader overlay listener (#118)
// =============================================================

let activeOperationsCount = 0;
const loaderListeners = new Set<(isLoading: boolean) => void>();

export function isWalletLoading(): boolean {
  return activeOperationsCount > 0;
}

export function subscribeToWalletLoading(listener: (isLoading: boolean) => void): () => void {
  loaderListeners.add(listener);
  listener(activeOperationsCount > 0);
  return () => {
    loaderListeners.delete(listener);
  };
}

function notifyWalletLoaderListeners(): void {
  const loading = activeOperationsCount > 0;
  loaderListeners.forEach((l) => l(loading));
}

export function startWalletOperation(): void {
  activeOperationsCount++;
  notifyWalletLoaderListeners();
}

export function endWalletOperation(): void {
  activeOperationsCount = Math.max(0, activeOperationsCount - 1);
  notifyWalletLoaderListeners();
}

/**
 * Executes an async wallet operation wrapped in the loading overlay
 * lifecycle. Uses a try/finally pattern so the loader clears even on error.
 */
export async function withWalletLoader<T>(fn: () => Promise<T>): Promise<T> {
  startWalletOperation();
  try {
    return await fn();
  } finally {
    endWalletOperation();
  }
}
