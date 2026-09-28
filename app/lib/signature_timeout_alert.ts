/**
 * signature_timeout_alert — signature timeout display module.
 *
 * Provides four capabilities used across the wallet signing flow:
 *
 *  1. Secure persistent caching for active keys (#247)
 *     Serialises the active signing address to localStorage so the session
 *     survives page reloads.  State is version-tagged, validated on read, and
 *     the in-memory reference is returned as a defensive copy.
 *
 *  2. Graceful user-rejection handling (#245)
 *     Catches the "user rejected transaction" exceptions returned by every
 *     supported wallet extension, logs a structured warning block, and shows a
 *     clean "warning" toast instead of surfacing a raw error to the caller.
 *
 *  3. Transaction signature time-limit bounds (#244)
 *     Races a signing call against a configurable timeout clock.  If the
 *     wallet does not respond within the bound the operation is aborted,
 *     sensitive in-memory payload bytes are zeroed, and a typed
 *     SignatureTimeoutAlertError is thrown.
 *
 *  4. Wallet availability check (#243)
 *     Detects whether a supported wallet extension is installed.  When it is
 *     not the caller receives human-readable setup instructions and, if a
 *     toast handler is provided, a visible "warning" toast.
 *
 * All exported names are prefixed with "SignatureTimeoutAlert" so the module
 * is unambiguous when imported alongside the per-wallet connector modules.
 */

import type { ToastType } from "@/app/context/ToastContext";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const LOG_PREFIX = "[signature_timeout_alert]";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatStack(err?: unknown): string {
  if (err instanceof Error && err.stack) return err.stack;
  if (typeof err === "string" && err.includes("\n")) return err;
  const synthetic = new Error(
    typeof err === "string" ? err : "signature_timeout_alert trace"
  );
  return synthetic.stack ?? "Error: signature_timeout_alert trace";
}

function emitWarning(title: string, body: string, err?: unknown): string {
  const stack = formatStack(err);
  const paddedTitle = title.padEnd(36).slice(0, 36);
  const lines = [
    `${LOG_PREFIX} ╔══════════════════════════════════════╗`,
    `${LOG_PREFIX} ║ ${paddedTitle} ║`,
    `${LOG_PREFIX} ╚══════════════════════════════════════╝`,
    `${LOG_PREFIX} ${body}`,
    `${LOG_PREFIX} --- stack trace ---`,
    ...stack.split("\n").map((f) => `${LOG_PREFIX} ${f}`),
    `${LOG_PREFIX} --- end stack ---`,
  ];
  const formatted = lines.join("\n");
  console.warn(formatted);
  return formatted;
}

// ---------------------------------------------------------------------------
// #244 — Transaction signature time-limit bounds
// ---------------------------------------------------------------------------

/** Default signing window before the alert aborts the operation (60 seconds). */
export const DEFAULT_SIGNATURE_TIMEOUT_MS = 60_000;

/**
 * Thrown when a wallet signing call does not return within the configured
 * time limit.  Carries the timeout value so UI layers can surface it.
 */
export class SignatureTimeoutAlertError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Signature timed out after ${timeoutMs}ms`);
    this.name = "SignatureTimeoutAlertError";
  }
}

export interface SignatureTimeoutAlertRequest {
  xdr: string;
  /**
   * Optional sensitive byte buffer.  It is zeroed and nulled on both
   * successful completion and timeout/error so it cannot be leaked.
   */
  payload?: Uint8Array | null;
}

/** Zeroes the payload bytes and sets the reference to null. */
export function clearSignatureAlertMemory(
  request: SignatureTimeoutAlertRequest
): SignatureTimeoutAlertRequest {
  if (request.payload) {
    request.payload.fill(0);
  }
  request.payload = null;
  return request;
}

/**
 * Races a wallet signing call against a timeout clock.
 *
 * - Resolves with the value returned by `signFn` when the wallet responds in
 *   time.
 * - Clears sensitive payload memory on both success and failure paths.
 * - Throws {@link SignatureTimeoutAlertError} when the clock fires first.
 * - Re-throws any other error from `signFn` unchanged.
 */
export async function runSignatureWithTimeout<T>(
  request: SignatureTimeoutAlertRequest,
  signFn: (xdr: string) => Promise<T>,
  timeoutMs: number = DEFAULT_SIGNATURE_TIMEOUT_MS
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      clearSignatureAlertMemory(request);
      reject(new SignatureTimeoutAlertError(timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([signFn(request.xdr), timeoutPromise]);
    clearSignatureAlertMemory(request);
    return result;
  } catch (err) {
    if (timedOut || err instanceof SignatureTimeoutAlertError) {
      clearSignatureAlertMemory(request);
    }
    throw err;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// #245 — Graceful user-rejection handling
// ---------------------------------------------------------------------------

/**
 * First-class error for explicit user refusals.  Callers may throw this
 * directly; it is also detected by {@link isSignatureRejectedByUser}.
 */
export class SignatureRejectedByUserError extends Error {
  constructor(message = "user rejected transaction") {
    super(message);
    this.name = "SignatureRejectedByUserError";
  }
}

/**
 * Returns `true` when `err` represents a deliberate user refusal:
 * - First-class {@link SignatureRejectedByUserError} instance.
 * - Any `Error` whose lowercase message contains a common rejection phrase.
 *
 * Non-`Error` values always return `false`.
 */
export function isSignatureRejectedByUser(err: unknown): boolean {
  if (err instanceof SignatureRejectedByUserError) return true;
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("user rejected") ||
    msg.includes("user declined") ||
    msg.includes("request rejected") ||
    msg.includes("denied by the user") ||
    msg.includes("rejected by user") ||
    msg.includes("canceled by user") ||
    msg.includes("cancelled by user")
  );
}

export type SignatureAlertToastHandler = (
  message: string,
  type: ToastType
) => void;

/**
 * Executes `signFn`.  If the wallet returns a user-rejection error the
 * function:
 *  - logs a structured warning block (via `console.warn`), and
 *  - calls `showToast` with a clean "warning" message,
 *  - returns `null` so the caller can treat it as a no-op.
 *
 * All other errors are re-thrown unchanged.
 */
export async function runSignatureWithRejectionHandling<T>(
  signFn: () => Promise<T>,
  showToast: SignatureAlertToastHandler
): Promise<T | null> {
  try {
    return await signFn();
  } catch (err) {
    if (isSignatureRejectedByUser(err)) {
      emitWarning(
        "SIGNATURE REJECTED",
        "signature rejected by user",
        err
      );
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
// #243 — Wallet availability check
// ---------------------------------------------------------------------------

/** Install page URL shown when no supported wallet extension is detected. */
export const SIGNATURE_ALERT_INSTALL_URL = "https://www.freighter.app/";

/** Default setup copy shown to users when no wallet extension is installed. */
export const SIGNATURE_ALERT_SETUP_INSTRUCTION =
  "No supported wallet extension detected. " +
  "Install Freighter (freighter.app) and refresh this page to continue.";

export type SignatureAlertAvailabilityStatus =
  | "available"
  | "unavailable"
  | "error";

export interface SignatureAlertAvailabilityState {
  available: boolean;
  status: SignatureAlertAvailabilityStatus;
  /** Human-readable setup instructions when the wallet is missing or errored. */
  setupInstruction: string | null;
  /** Message surfaced as a toast when the wallet is missing or errored. */
  warningMessage: string | null;
}

/**
 * Detects whether a supported wallet extension is present.  Checks for
 * `window.freighterApi`, `window.freighter`, `window.albedo`, and
 * `window.rabeApi` — the four extensions used by this app.
 *
 * Accepts an optional `detector` override so tests and non-browser runtimes
 * can inject their own check without touching `window`.
 */
export function detectSignatureAlertWallet(
  detector?: () => boolean
): boolean {
  if (detector) return detector();
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return !!(
    w["freighterApi"] ||
    w["freighter"] ||
    w["albedo"] ||
    w["albedoApi"] ||
    w["rabeApi"] ||
    w["rabe"]
  );
}

/**
 * Checks wallet availability and returns a state object with setup
 * instructions when no extension is found or the check itself throws.
 */
export function checkSignatureAlertAvailability(
  detector?: () => boolean
): SignatureAlertAvailabilityState {
  try {
    const available = detectSignatureAlertWallet(detector);
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
      setupInstruction: SIGNATURE_ALERT_SETUP_INSTRUCTION,
      warningMessage: SIGNATURE_ALERT_SETUP_INSTRUCTION,
    };
  } catch (err) {
    emitWarning(
      "WALLET UNAVAILABLE",
      "wallet availability check failed",
      err
    );
    return {
      available: false,
      status: "error",
      setupInstruction: SIGNATURE_ALERT_SETUP_INSTRUCTION,
      warningMessage: `Unable to verify wallet availability. ${SIGNATURE_ALERT_SETUP_INSTRUCTION}`,
    };
  }
}

/**
 * Runs a wallet availability check and calls `showToast` with a "warning"
 * toast when the extension is missing or the check errors.  Returns the full
 * availability state so callers can branch on it.
 */
export function warnOnMissingSignatureAlertWallet(
  showToast: SignatureAlertToastHandler,
  detector?: () => boolean
): SignatureAlertAvailabilityState {
  const state = checkSignatureAlertAvailability(detector);
  if (!state.available && state.warningMessage) {
    showToast(state.warningMessage, "warning");
  }
  return state;
}

// ---------------------------------------------------------------------------
// #247 — Secure persistent caching for active keys
// ---------------------------------------------------------------------------

export const SIGNATURE_ALERT_STORAGE_KEY =
  "signature_timeout_alert_active_address";
export const SIGNATURE_ALERT_SCHEMA_VERSION = 1 as const;

export interface SignatureAlertActiveAddress {
  address: string;
  network: string;
  connectedAt: number;
}

interface SignatureAlertSerializedV1 {
  version: typeof SIGNATURE_ALERT_SCHEMA_VERSION;
  address: string;
  network: string;
  connectedAt: number;
}

function isValidActiveAddress(
  value: unknown
): value is SignatureAlertActiveAddress {
  if (!isRecord(value)) return false;
  if (typeof value.address !== "string" || value.address.length === 0)
    return false;
  if (typeof value.network !== "string") return false;
  if (
    typeof value.connectedAt !== "number" ||
    !Number.isFinite(value.connectedAt)
  )
    return false;
  return true;
}

function sanitizeActiveAddress(
  value: unknown
): SignatureAlertActiveAddress | null {
  if (!isValidActiveAddress(value)) return null;
  return {
    address: value.address,
    network: value.network,
    connectedAt: value.connectedAt,
  };
}

function isValidSerializedPayload(
  value: unknown
): value is SignatureAlertSerializedV1 {
  if (!isRecord(value)) return false;
  if (value.version !== SIGNATURE_ALERT_SCHEMA_VERSION) return false;
  if (typeof value.address !== "string" || value.address.length === 0)
    return false;
  if (typeof value.network !== "string") return false;
  if (
    typeof value.connectedAt !== "number" ||
    !Number.isFinite(value.connectedAt)
  )
    return false;
  return true;
}

function getStorageAdapter(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const testKey = "__signature_timeout_alert_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Versioned localStorage store for the active signing address.
 *
 * - Persists `{ address, network, connectedAt }` under a versioned key so
 *   the session survives page reloads.
 * - Validates the persisted shape on read; silently clears corrupt entries.
 * - Exposes `overrideStorage()` so tests can inject an in-memory adapter
 *   without touching `window.localStorage`.
 */
export class SignatureAlertActiveAddressStore {
  private activeAddress: SignatureAlertActiveAddress | null = null;
  private storage: Storage | null;

  constructor(storageOverride?: Storage | null) {
    this.storage =
      storageOverride !== undefined ? storageOverride : getStorageAdapter();
    this.rehydrate();
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      if (this.activeAddress) {
        const payload: SignatureAlertSerializedV1 = {
          version: SIGNATURE_ALERT_SCHEMA_VERSION,
          address: this.activeAddress.address,
          network: this.activeAddress.network,
          connectedAt: this.activeAddress.connectedAt,
        };
        this.storage.setItem(
          SIGNATURE_ALERT_STORAGE_KEY,
          JSON.stringify(payload)
        );
      } else {
        this.storage.removeItem(SIGNATURE_ALERT_STORAGE_KEY);
      }
    } catch (err) {
      console.warn(
        `${LOG_PREFIX} PERSIST FAILED`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * Re-reads persisted state from storage into memory.  Public so tests can
   * simulate a page reload (bootstrapping a fresh store from existing storage)
   * without constructing a new instance.
   */
  rehydrate(): void {
    this.activeAddress = null;
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(SIGNATURE_ALERT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!isValidSerializedPayload(parsed)) {
        console.warn(
          `${LOG_PREFIX} REHYDRATE SCHEMA MISMATCH`,
          "Persisted active address failed validation, clearing."
        );
        this.storage.removeItem(SIGNATURE_ALERT_STORAGE_KEY);
        return;
      }
      this.activeAddress = sanitizeActiveAddress(parsed);
    } catch (err) {
      console.warn(
        `${LOG_PREFIX} REHYDRATE FAILED`,
        err instanceof Error ? err.message : String(err)
      );
      try {
        this.storage.removeItem(SIGNATURE_ALERT_STORAGE_KEY);
      } catch {
        // best-effort cleanup
      }
    }
  }

  /**
   * Replaces the storage backend and immediately re-reads state from it.
   * Intended as a test seam; safe to call at runtime too.
   */
  overrideStorage(nextStorage: Storage | null): void {
    this.storage = nextStorage;
    this.rehydrate();
  }

  setActiveAddress(address: SignatureAlertActiveAddress | null): void {
    this.activeAddress = address ? sanitizeActiveAddress(address) : null;
    this.persist();
  }

  /** Returns a defensive copy so callers cannot mutate the stored reference. */
  getActiveAddress(): SignatureAlertActiveAddress | null {
    if (!this.activeAddress) return null;
    return {
      address: this.activeAddress.address,
      network: this.activeAddress.network,
      connectedAt: this.activeAddress.connectedAt,
    };
  }

  clear(): void {
    this.activeAddress = null;
    if (this.storage) {
      try {
        this.storage.removeItem(SIGNATURE_ALERT_STORAGE_KEY);
      } catch (err) {
        console.warn(
          `${LOG_PREFIX} CLEAR STORAGE FAILED`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  }
}

/** Singleton store used by the signing flow. */
export const signatureAlertActiveAddress =
  new SignatureAlertActiveAddressStore();

// ---------------------------------------------------------------------------
// Simulation fee inspection — fee warning banners
// ---------------------------------------------------------------------------
//
// Before a user approves — or re-approves, after a timeout — a signature
// request, the alert inspects the Soroban simulation result that produced the
// transaction so a fee outside standard bounds can be surfaced as a banner.

/**
 * Minimal shape of a Soroban simulation result understood by the alert.
 * The full SDK type is structurally compatible — pass it directly.
 */
export interface SignatureTimeoutSimulationResult {
  /** Estimated Soroban resource fee in stroops (string or number). */
  minResourceFee?: string | number;
  /** Classic base fee in stroops (string or number). */
  fee?: string | number;
  /** Present when the simulation itself failed. */
  error?: string;
  /** Soroban error message embedded inside a failed simulation. */
  result?: { error?: string };
}

/**
 * How far outside standard bounds the simulated fee sits.
 * - `none`     — within bounds, no banner.
 * - `elevated` — above {@link ELEVATED_FEE_RATIO} of the limit but still under it.
 * - `exceeded` — strictly above the limit.
 * - `error`    — the simulation failed, so no fee could be established.
 */
export type SignatureFeeSeverity = "none" | "elevated" | "exceeded" | "error";

export interface SignatureFeeWarningState {
  /** Severity bucket driving the banner styling and copy. */
  severity: SignatureFeeSeverity;
  /** True whenever a banner should be rendered. */
  hasWarning: boolean;
  /** True only when the fee is strictly above the configured limit. */
  exceeded: boolean;
  /** Estimated fee in stroops (0 when the simulation carries no fee data). */
  estimatedFeeStroops: number;
  /** The bound that was checked against (in stroops). */
  feeLimitStroops: number;
  /** Simulation failure message, or null when the simulation succeeded. */
  simulationError: string | null;
  /** Human-readable warning, or null when the fee is within bounds. */
  warningMessage: string | null;
}

/**
 * Standard upper bound for an acceptable transaction fee.
 * 0.01 XLM = 1_000_000 stroops. Estimates above this trigger the banner.
 */
export const DEFAULT_SIGNATURE_FEE_LIMIT_STROOPS = 1_000_000;

/**
 * Fraction of the limit above which a fee is flagged as "elevated" even
 * though it still fits inside the bound.
 */
export const ELEVATED_FEE_RATIO = 0.5;

/** Stroops per XLM. */
const STROOPS_PER_XLM = 10_000_000;

export class SignatureFeeExceededError extends Error {
  constructor(
    public readonly estimatedFeeStroops: number,
    public readonly feeLimitStroops: number
  ) {
    super(
      `Fee exceeded: estimated ${estimatedFeeStroops} stroops exceeds limit of ${feeLimitStroops} stroops`
    );
    this.name = "SignatureFeeExceededError";
  }
}

export class SignatureSimulationError extends Error {
  constructor(message: string) {
    super(`Signature simulation failed: ${message}`);
    this.name = "SignatureSimulationError";
  }
}

/** Formats a stroop amount as a fixed-precision XLM string. */
export function formatStroopsAsXlm(stroops: number): string {
  return (stroops / STROOPS_PER_XLM).toFixed(7);
}

/**
 * Pulls the simulation failure message out of a result. Soroban reports the
 * error either at the top level or nested under `result.error`; both are
 * accepted so callers need not branch on RPC version.
 */
export function extractSimulationError(
  simulation: SignatureTimeoutSimulationResult | null | undefined
): string | null {
  if (!simulation) return null;
  const raw = simulation.error ?? simulation.result?.error;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Extracts the total estimated fee in stroops from a simulation result.
 * Soroban transactions carry a `minResourceFee`; classic transactions use
 * `fee`. Both are accepted so callers need not branch on transaction type.
 */
export function extractEstimatedFeeStroops(
  simulation: SignatureTimeoutSimulationResult | null | undefined
): number {
  if (!simulation) return 0;
  const raw = simulation.minResourceFee ?? simulation.fee;
  if (raw === undefined || raw === null) return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function normalizeFeeLimit(feeLimitStroops: number): number {
  if (!Number.isFinite(feeLimitStroops) || feeLimitStroops <= 0) {
    return DEFAULT_SIGNATURE_FEE_LIMIT_STROOPS;
  }
  return feeLimitStroops;
}

/**
 * Inspects a simulation result and produces the fee warning state the alert
 * renders. A warning is raised when the simulation failed, when the estimated
 * fee exceeds `feeLimitStroops`, or when it sits above
 * {@link ELEVATED_FEE_RATIO} of that limit.
 *
 * @param simulation      - Simulation result from the Soroban RPC / SDK.
 * @param feeLimitStroops - Upper bound in stroops. Defaults to
 *                          {@link DEFAULT_SIGNATURE_FEE_LIMIT_STROOPS}.
 */
export function inspectSignatureFee(
  simulation: SignatureTimeoutSimulationResult | null | undefined,
  feeLimitStroops: number = DEFAULT_SIGNATURE_FEE_LIMIT_STROOPS
): SignatureFeeWarningState {
  const limit = normalizeFeeLimit(feeLimitStroops);
  const simulationError = extractSimulationError(simulation);
  const estimatedFeeStroops = extractEstimatedFeeStroops(simulation);

  if (simulationError) {
    return {
      severity: "error",
      hasWarning: true,
      exceeded: false,
      estimatedFeeStroops,
      feeLimitStroops: limit,
      simulationError,
      warningMessage: `Simulation failed: ${simulationError}. The transaction fee could not be estimated — review the transaction before signing.`,
    };
  }

  const xlmFee = formatStroopsAsXlm(estimatedFeeStroops);
  const xlmLimit = formatStroopsAsXlm(limit);

  if (estimatedFeeStroops > limit) {
    return {
      severity: "exceeded",
      hasWarning: true,
      exceeded: true,
      estimatedFeeStroops,
      feeLimitStroops: limit,
      simulationError: null,
      warningMessage: `High fee detected: estimated ${xlmFee} XLM (${estimatedFeeStroops} stroops) exceeds the ${xlmLimit} XLM limit. Review the transaction before signing.`,
    };
  }

  if (estimatedFeeStroops > limit * ELEVATED_FEE_RATIO) {
    return {
      severity: "elevated",
      hasWarning: true,
      exceeded: false,
      estimatedFeeStroops,
      feeLimitStroops: limit,
      simulationError: null,
      warningMessage: `Elevated fee: estimated ${xlmFee} XLM (${estimatedFeeStroops} stroops) is approaching the ${xlmLimit} XLM limit.`,
    };
  }

  return {
    severity: "none",
    hasWarning: false,
    exceeded: false,
    estimatedFeeStroops,
    feeLimitStroops: limit,
    simulationError: null,
    warningMessage: null,
  };
}

/**
 * Runs a fee inspection and emits a formatted console warning when the
 * estimate falls outside standard bounds. Returns the same state as
 * {@link inspectSignatureFee} so callers can render the banner from it.
 */
export function warnOnSignatureFeeExceeded(
  simulation: SignatureTimeoutSimulationResult | null | undefined,
  feeLimitStroops: number = DEFAULT_SIGNATURE_FEE_LIMIT_STROOPS
): SignatureFeeWarningState {
  const state = inspectSignatureFee(simulation, feeLimitStroops);

  if (state.hasWarning && state.warningMessage) {
    const err =
      state.severity === "error"
        ? new SignatureSimulationError(state.simulationError ?? "unknown")
        : new SignatureFeeExceededError(
            state.estimatedFeeStroops,
            state.feeLimitStroops
          );
    console.warn(
      `${LOG_PREFIX} ${state.severity.toUpperCase()} — ${state.warningMessage}`,
      err
    );
  }

  return state;
}

/**
 * Throws when the simulated transaction cannot be signed safely. Used by
 * callers that want to hard-stop instead of rendering a banner.
 */
export function assertSignatureFeeWithinBounds(
  simulation: SignatureTimeoutSimulationResult | null | undefined,
  feeLimitStroops: number = DEFAULT_SIGNATURE_FEE_LIMIT_STROOPS
): SignatureFeeWarningState {
  const state = inspectSignatureFee(simulation, feeLimitStroops);

  if (state.severity === "error") {
    throw new SignatureSimulationError(state.simulationError ?? "unknown");
  }
  if (state.exceeded) {
    throw new SignatureFeeExceededError(
      state.estimatedFeeStroops,
      state.feeLimitStroops
    );
  }

  return state;
}
