/**
 * Rabe wallet helper interface — formats console warnings, tracks transaction
 * lifecycle for debug visibility, and checks wallet extension availability.
 */

import type { ToastType } from "@/app/context/ToastContext";

export type RabeTxPhase =
  | "idle"
  | "building"
  | "signing"
  | "submitting"
  | "success"
  | "error";

export interface RabeTxTrackEntry {
  txId: string;
  phase: RabeTxPhase;
  message: string;
  timestamp: number;
  stack?: string;
}

export interface RabeConsoleWarningBlock {
  title: string;
  body: string;
  stack: string;
  txId?: string;
  phase?: RabeTxPhase;
}

/** Chains the Rabe wallet can be pointed at. */
export type RabeNetwork = "mainnet" | "testnet";

export interface RabeNetworkMismatchState {
  mismatched: boolean;
  walletNetwork: RabeNetwork;
  appNetwork: RabeNetwork;
  warningMessage: string | null;
}

const WARN_PREFIX = "[rabe_connector]";

/** Captures a normalized stack string from an error or the current call site. */
export function formatStackTrace(err?: unknown): string {
  if (err instanceof Error && err.stack) {
    return err.stack;
  }

  if (typeof err === "string" && err.includes("\n")) {
    return err;
  }

  const synthetic = new Error(
    typeof err === "string" ? err : "Rabe connector trace"
  );
  return synthetic.stack ?? "Error: Rabe connector trace";
}

/** Builds a multi-line console warning block for transaction debug tracking. */
export function formatConsoleWarningBlock(
  block: RabeConsoleWarningBlock
): string {
  const lines = [
    `${WARN_PREFIX} ╔══════════════════════════════════════╗`,
    `${WARN_PREFIX} ║ ${block.title.padEnd(36).slice(0, 36)} ║`,
    `${WARN_PREFIX} ╚══════════════════════════════════════╝`,
    `${WARN_PREFIX} ${block.body}`,
  ];

  if (block.txId) {
    lines.push(`${WARN_PREFIX} txId: ${block.txId}`);
  }
  if (block.phase) {
    lines.push(`${WARN_PREFIX} phase: ${block.phase}`);
  }

  lines.push(`${WARN_PREFIX} --- stack trace ---`);
  for (const frame of block.stack.split("\n")) {
    lines.push(`${WARN_PREFIX} ${frame}`);
  }
  lines.push(`${WARN_PREFIX} --- end stack ---`);

  return lines.join("\n");
}

/** Logs a formatted warning block (including stack) to the console. */
export function logRabeWarning(
  title: string,
  body: string,
  options?: { err?: unknown; txId?: string; phase?: RabeTxPhase }
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

export class RabeNetworkMismatchError extends Error {
  constructor(
    public readonly walletNetwork: RabeNetwork,
    public readonly appNetwork: RabeNetwork
  ) {
    super(
      `Network mismatch: Rabe wallet is on ${walletNetwork}, app expects ${appNetwork}`
    );
    this.name = "RabeNetworkMismatchError";
  }
}

function capitalizeNetwork(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Compares the network the Rabe wallet is pointed at against the network the
 * app expects and produces a user-facing warning message when they diverge.
 */
export function checkRabeNetworkMatch(
  walletNetwork: RabeNetwork,
  appNetwork: RabeNetwork
): RabeNetworkMismatchState {
  const mismatched = walletNetwork !== appNetwork;
  return {
    mismatched,
    walletNetwork,
    appNetwork,
    warningMessage: mismatched
      ? `Network mismatch: your Rabe wallet is on ${capitalizeNetwork(walletNetwork)} but this app uses ${capitalizeNetwork(appNetwork)}. Switch networks in Rabe to continue.`
      : null,
  };
}

/**
 * Runs a network match check and, on mismatch, emits a formatted console
 * warning block (with stack) via the shared rabe_connector debug machinery.
 */
export function warnOnRabeNetworkMismatch(
  walletNetwork: RabeNetwork,
  appNetwork: RabeNetwork
): RabeNetworkMismatchState {
  const state = checkRabeNetworkMatch(walletNetwork, appNetwork);
  if (state.mismatched && state.warningMessage) {
    logRabeWarning("NETWORK MISMATCH", state.warningMessage, {
      err: new RabeNetworkMismatchError(walletNetwork, appNetwork),
    });
  }
  return state;
}

export class RabeTransactionTracker {
  private entries: RabeTxTrackEntry[] = [];

  track(
    txId: string,
    phase: RabeTxPhase,
    message: string,
    err?: unknown
  ): RabeTxTrackEntry {
    const entry: RabeTxTrackEntry = {
      txId,
      phase,
      message,
      timestamp: Date.now(),
      stack: formatStackTrace(err),
    };
    this.entries.push(entry);

    logRabeWarning(`TX ${phase.toUpperCase()}`, message, {
      err,
      txId,
      phase,
    });

    return entry;
  }

  getHistory(txId?: string): RabeTxTrackEntry[] {
    if (!txId) return [...this.entries];
    return this.entries.filter((e) => e.txId === txId);
  }

  clear(): void {
    this.entries = [];
  }
}

export const rabeTracker = new RabeTransactionTracker();

export const RABE_INSTALL_URL = "https://rabe.app/";

/** Fallback copy shown when the Rabe extension is missing. */
export const RABE_SETUP_INSTRUCTION =
  "Rabe wallet extension not detected. Install Rabe and refresh this page to continue.";

export type RabeAvailabilityStatus = "available" | "unavailable" | "error";

export interface RabeAvailabilityState {
  available: boolean;
  status: RabeAvailabilityStatus;
  /** User-facing setup instructions when the extension is missing. */
  setupInstruction: string | null;
  warningMessage: string | null;
}

export type RabeToastHandler = (message: string, type: ToastType) => void;

/**
 * Detects whether the Rabe browser extension is present. Accepts an optional
 * detector override for tests / non-browser runtimes.
 */
export function detectRabeExtension(detector?: () => boolean): boolean {
  if (detector) {
    return detector();
  }
  if (typeof window === "undefined") {
    return false;
  }
  const w = window as unknown as Record<string, unknown>;
  return !!(w["rabeApi"] || w["rabe"]);
}

/**
 * Checks Rabe extension availability and returns fallback setup instructions
 * when the extension is missing or the check itself throws.
 */
export function checkRabeAvailability(
  detector?: () => boolean
): RabeAvailabilityState {
  try {
    const available = detectRabeExtension(detector);
    if (available) {
      return {
        available: true,
        status: "available",
        setupInstruction: null,
        warningMessage: null,
      };
    }
    return {
      available: false,
      status: "unavailable",
      setupInstruction: RABE_SETUP_INSTRUCTION,
      warningMessage: RABE_SETUP_INSTRUCTION,
    };
  } catch (err) {
    logRabeWarning("WALLET UNAVAILABLE", "wallet availability check failed", {
      err,
    });
    return {
      available: false,
      status: "error",
      setupInstruction: RABE_SETUP_INSTRUCTION,
      warningMessage: `Unable to verify wallet availability. ${RABE_SETUP_INSTRUCTION}`,
    };
  }
}

/**
 * Runs a Rabe availability check and surfaces a warning toast when the
 * extension is missing or the check errors.
 */
export function warnOnMissingRabe(
  showToast: RabeToastHandler,
  detector?: () => boolean
): RabeAvailabilityState {
  const state = checkRabeAvailability(detector);
  if (!state.available && state.warningMessage) {
    showToast(state.warningMessage, "warning");
  }
  return state;
}

// ---------------------------------------------------------------------------
// Transaction signature time limit bounds (#134)
// ---------------------------------------------------------------------------

/** Default bound for Rabe signature requests (milliseconds). */
export const DEFAULT_RABE_SIGNATURE_TIMEOUT_MS = 60_000;

export interface RabeSignRequest {
  xdr: string;
  /** Sensitive buffer cleared on timeout / completion. */
  payload?: Uint8Array | null;
}

export class RabeSignatureTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Rabe signature timed out after ${timeoutMs}ms`);
    this.name = "RabeSignatureTimeoutError";
  }
}

/**
 * Zeroes and drops a sensitive buffer so it cannot be retained after the
 * operation is aborted or completes.
 */
export function clearRabeSensitiveMemory(
  request: RabeSignRequest
): RabeSignRequest {
  if (request.payload) {
    request.payload.fill(0);
  }
  request.payload = null;
  return request;
}

/**
 * Races a Rabe signature operation against a timeout clock. On timeout the
 * operation is aborted and any sensitive payload memory is cleared.
 */
export async function signRabeWithTimeout<T>(
  request: RabeSignRequest,
  signFn: (xdr: string) => Promise<T>,
  timeoutMs: number = DEFAULT_RABE_SIGNATURE_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      clearRabeSensitiveMemory(request);
      reject(new RabeSignatureTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([signFn(request.xdr), timeoutPromise]);
    clearRabeSensitiveMemory(request);
    return result;
  } catch (err) {
    if (timedOut || err instanceof RabeSignatureTimeoutError) {
      clearRabeSensitiveMemory(request);
    }
    throw err;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// User signature rejection handling (#135)
// ---------------------------------------------------------------------------

export class RabeUserRejectedError extends Error {
  constructor(message = "user rejected transaction") {
    super(message);
    this.name = "RabeUserRejectedError";
  }
}

/**
 * Returns true when the thrown value represents a deliberate user refusal to
 * sign — either a first-class RabeUserRejectedError or an Error whose message
 * matches common wallet rejection phrases.
 */
export function isRabeUserRejected(err: unknown): boolean {
  if (err instanceof RabeUserRejectedError) return true;
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    message.includes("user rejected") ||
    message.includes("user declined") ||
    message.includes("request rejected") ||
    message.includes("denied by the user")
  );
}

/**
 * Runs a Rabe signature step. Catches "user rejected transaction" exceptions,
 * logs them via the structured rabe_connector warning machinery, and shows a
 * warning toast instead of surfacing a raw error to the caller.
 *
 * Non-rejection errors are re-thrown unchanged so callers can handle them.
 */
export async function runRabeSign<T>(
  signFn: () => Promise<T>,
  showToast: RabeToastHandler
): Promise<T | null> {
  try {
    return await signFn();
  } catch (err) {
    if (isRabeUserRejected(err)) {
      logRabeWarning("SIGNATURE REJECTED", "signature rejected by user", {
        err,
        phase: "signing",
      });
      showToast(
        "Signature cancelled — you rejected the request in your wallet.",
        "warning"
      );
      return null;
    }
    throw err;
  }
}


// ---------------------------------------------------------------------------
// Secure persistent caching for active Rabe wallet addresses
// ---------------------------------------------------------------------------

/** localStorage key under which the serialized address cache is stored. */
export const RABE_CACHE_KEY = "rabe_active_address_cache";

/**
 * Shape of the cache entry persisted to localStorage.
 * Using a versioned envelope makes future migrations explicit.
 */
export interface RabeActiveAddressCache {
  /** Schema version — increment when the shape changes. */
  version: 1;
  /** The Stellar public key of the connected wallet (G… address). */
  address: string;
  /** Unix-ms timestamp of when the entry was last written. */
  savedAt: number;
  /** Network the wallet was connected to when the address was cached. */
  network: RabeNetwork;
}

// ---- Validation helpers ---------------------------------------------------

/**
 * Returns true when `value` looks like a valid Stellar public key.
 * Public keys are 56 characters, start with "G", and are Base32 (A-Z 2-7).
 */
function isValidStellarAddress(value: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(value);
}

/**
 * Returns true when `value` is one of the known {@link RabeNetwork} literals.
 */
function isValidNetwork(value: unknown): value is RabeNetwork {
  return value === "mainnet" || value === "testnet";
}

// ---- Public cache API -----------------------------------------------------

/**
 * Validates that `raw` conforms to the {@link RabeActiveAddressCache} shape.
 * Returns `true` when every required field passes its type and value check.
 */
export function validateRabeAddressCache(
  raw: unknown
): raw is RabeActiveAddressCache {
  if (!raw || typeof raw !== "object") return false;

  const candidate = raw as Record<string, unknown>;

  if (candidate.version !== 1) return false;
  if (typeof candidate.address !== "string") return false;
  if (!isValidStellarAddress(candidate.address)) return false;
  if (typeof candidate.savedAt !== "number") return false;
  if (!Number.isFinite(candidate.savedAt) || candidate.savedAt <= 0)
    return false;
  if (!isValidNetwork(candidate.network)) return false;

  return true;
}

/**
 * Serializes an {@link RabeActiveAddressCache} entry to a JSON string.
 * Exposed for testing; normal callers should use {@link saveRabeAddressCache}.
 */
export function serializeRabeAddressCache(
  cache: RabeActiveAddressCache
): string {
  return JSON.stringify(cache);
}

/**
 * Parses a JSON string and validates it as an {@link RabeActiveAddressCache}.
 * Returns `null` when parsing fails or the data does not pass validation.
 */
export function deserializeRabeAddressCache(
  raw: string
): RabeActiveAddressCache | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return validateRabeAddressCache(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Writes the active-address cache to localStorage.
 *
 * Safe to call in SSR contexts — the write is skipped when `window` is
 * unavailable so Next.js server renders do not throw.
 */
export function saveRabeAddressCache(
  address: string,
  network: RabeNetwork
): void {
  if (typeof window === "undefined") return;

  const cache: RabeActiveAddressCache = {
    version: 1,
    address,
    savedAt: Date.now(),
    network,
  };

  try {
    localStorage.setItem(RABE_CACHE_KEY, serializeRabeAddressCache(cache));
  } catch (err) {
    // localStorage may be unavailable (private mode quota exceeded, etc.)
    logRabeWarning(
      "CACHE WRITE FAILED",
      "Could not persist active address cache to localStorage.",
      { err }
    );
  }
}

/**
 * Reads and validates the active-address cache from localStorage.
 *
 * Returns `null` when:
 * - the code is running server-side,
 * - the key is absent,
 * - the stored value is corrupt or fails validation.
 */
export function loadRabeAddressCache(): RabeActiveAddressCache | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(RABE_CACHE_KEY);
    if (raw === null) return null;
    return deserializeRabeAddressCache(raw);
  } catch {
    // Gracefully handle any unexpected storage errors.
    return null;
  }
}

/**
 * Removes the active-address cache entry from localStorage.
 *
 * Call this on wallet disconnect or when the cached address can no longer
 * be verified as active.
 */
export function clearRabeAddressCache(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(RABE_CACHE_KEY);
  } catch {
    // Ignore — if we can't remove it, there is nothing more to do.
  }
}
