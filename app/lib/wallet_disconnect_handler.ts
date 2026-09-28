/**
 * wallet_disconnect_handler — Helpers for safe wallet disconnection with
 * wallet-extension availability checks.
 *
 * Before attempting to disconnect, the handler checks whether the wallet
 * extension is actually installed.  If the extension is missing (e.g. the
 * user uninstalled it while connected), a helpful setup instruction is
 * displayed instead of a cryptic runtime error.
 *
 * Mirrors the conventions established by `app/lib/freighter_connector.ts`
 * and `app/lib/wallet_state_context.ts`.
 */

const LOG_PREFIX = "[wallet_disconnect_handler]";

export const DEFAULT_WALLET_DISCONNECT_TIMEOUT_MS = 60_000;

export interface WalletDisconnectRequest {
  payload?: Uint8Array | null;
}

export class WalletDisconnectTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Wallet disconnect timed out after ${timeoutMs}ms`);
    this.name = "WalletDisconnectTimeoutError";
  }
}

export function clearWalletDisconnectMemory(
  request: WalletDisconnectRequest,
): WalletDisconnectRequest {
  if (request.payload) request.payload.fill(0);
  request.payload = null;
  return request;
}

export interface WalletDisconnectTimeoutOptions {
  timeoutMs?: number;
  request?: WalletDisconnectRequest;
  cleanup?: () => void;
}

export function runWalletDisconnectWithTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: WalletDisconnectTimeoutOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_WALLET_DISCONNECT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new RangeError("timeoutMs must be a positive number"));
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new WalletDisconnectTimeoutError(timeoutMs));
    }, timeoutMs);
  });
  const operationPromise = Promise.resolve().then(() => operation(controller.signal));

  const resultPromise = (async () => {
    try {
      return await Promise.race([operationPromise, timeoutPromise]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (options.request) clearWalletDisconnectMemory(options.request);
      options.cleanup?.();
    }
  })();

  resultPromise.catch(() => {});
  return resultPromise;
}

// =============================================================
// Wallet availability detection
// =============================================================

/** Global window keys injected by each wallet extension. */
const WALLET_GLOBALS: Record<string, string[]> = {
  freighter: ["freighterApi", "freighter"],
  albedo: ["albedo", "albedoApi"],
  xbull: ["xBullSDK", "x bull"],
  hana: ["hanaWallet", "hana"],
};

export interface WalletAvailabilityResult {
  /** `true` when at least one of the extension's globals is present. */
  available: boolean;
  /** Human-readable setup instruction shown when the wallet is missing. */
  setupInstruction: string | null;
  /** Install URL for the missing wallet, if known. */
  installUrl: string | null;
}

const SETUP_INSTRUCTIONS: Record<string, string> = {
  freighter:
    "Freighter wallet extension not found. " +
    "Install Freighter from freighter.app and refresh this page to continue.",
  albedo:
    "Albedo wallet extension not found. " +
    "Install Albedo from albedo.link and refresh this page to continue.",
  xbull:
    "xBull wallet extension not found. " +
    "Install xBull and refresh this page to continue.",
  hana:
    "Hana wallet extension not found. " +
    "Install Hana Wallet and refresh this page to continue.",
};

const INSTALL_URLS: Record<string, string> = {
  freighter: "https://www.freighter.app/",
  albedo: "https://albedo.link/",
  xbull: "https://xbull.app/",
  hana: "https://www.hanawallet.io/",
};

const FALLBACK_SETUP_INSTRUCTION =
  "Wallet extension not found. " +
  "Install the wallet extension for your provider and refresh this page to continue.";

/**
 * Detects whether a wallet extension is installed by checking for the
 * window globals it injects.
 *
 * @param walletId - The wallet provider ID (freighter, albedo, xbull, hana).
 * @param detector - Optional override for testing (receives the global check).
 */
export function detectWalletExtensionById(
  walletId: string,
  detector?: () => boolean,
): boolean {
  if (detector) {
    return detector();
  }

  if (typeof window === "undefined") return false;

  const globals = WALLET_GLOBALS[walletId] ?? [];
  const w = window as unknown as Record<string, unknown>;

  for (const key of globals) {
    try {
      if (w[key]) return true;
    } catch {
      // SSR or restricted environment — skip
    }
  }

  return false;
}

/**
 * Checks wallet availability and returns setup instructions if missing.
 */
export function checkWalletAvailabilityById(
  walletId: string,
  detector?: () => boolean,
): WalletAvailabilityResult {
  try {
    const available = detectWalletExtensionById(walletId, detector);

    if (available) {
      return { available: true, setupInstruction: null, installUrl: null };
    }

    return {
      available: false,
      setupInstruction:
        SETUP_INSTRUCTIONS[walletId] ?? FALLBACK_SETUP_INSTRUCTION,
      installUrl: INSTALL_URLS[walletId] ?? null,
    };
  } catch (err) {
    console.error(
      `${LOG_PREFIX} AVAILABILITY CHECK FAILED for "${walletId}":`,
      err,
    );

    return {
      available: false,
      setupInstruction:
        SETUP_INSTRUCTIONS[walletId] ?? FALLBACK_SETUP_INSTRUCTION,
      installUrl: INSTALL_URLS[walletId] ?? null,
    };
  }
}

// =============================================================
// Active wallet session state persistence (#237)
// =============================================================

export const WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY = "wallet_disconnect_active_keys";
export const WALLET_DISCONNECT_SCHEMA_VERSION = 1;

export interface WalletActiveKey {
  walletId: string;
  address: string;
  connectedAt: number;
}

interface WalletActiveKeysSerializedV1 {
  version: 1;
  activeKeys: WalletActiveKey[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidWalletActiveKey(value: unknown): value is WalletActiveKey {
  if (!isRecord(value)) return false;
  if (typeof value.walletId !== "string" || value.walletId.length === 0) return false;
  if (typeof value.address !== "string" || value.address.length === 0) return false;
  if (typeof value.connectedAt !== "number" || !Number.isFinite(value.connectedAt)) return false;
  return true;
}

function sanitizeWalletActiveKey(value: unknown): WalletActiveKey | null {
  if (!isValidWalletActiveKey(value)) return null;
  return {
    walletId: value.walletId,
    address: value.address,
    connectedAt: value.connectedAt,
  };
}

/**
 * Validates the persisted *envelope* only - that it is a record carrying a
 * recognised schema version and an activeKeys array.
 *
 * Individual entries are deliberately not checked here: rehydrate() maps them
 * through sanitizeWalletActiveKey and drops the ones that fail, so one corrupt
 * entry costs the user only that entry rather than the whole store. Rejecting
 * the payload here on a single bad entry would make that filtering
 * unreachable.
 */
function isValidSerializedPayload(
  value: unknown
): value is WalletActiveKeysSerializedV1 {
  if (!isRecord(value)) return false;
  if (value.version !== WALLET_DISCONNECT_SCHEMA_VERSION) return false;
  if (!Array.isArray(value.activeKeys)) return false;
  return true;
}

function getStorageAdapter(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const testKey = "__wallet_disconnect_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

export class WalletActiveKeysStore {
  private activeKeys: WalletActiveKey[] = [];
  private storage: Storage | null;

  constructor(storageOverride?: Storage | null) {
    this.storage =
      storageOverride !== undefined ? storageOverride : getStorageAdapter();
    this.rehydrate();
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      if (this.activeKeys.length > 0) {
        const payload: WalletActiveKeysSerializedV1 = {
          version: WALLET_DISCONNECT_SCHEMA_VERSION,
          activeKeys: this.activeKeys,
        };
        this.storage.setItem(
          WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY,
          JSON.stringify(payload)
        );
      } else {
        this.storage.removeItem(WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY);
      }
    } catch (err) {
      console.warn(
        `${LOG_PREFIX} PERSIST FAILED`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * Re-reads persisted state from storage into memory. Public because
   * simulating a reload (which triggers rehydration) is a legitimate
   * externally-verifiable behavior: consumers and tests both need to
   * confirm that a freshly-bootstrapped store correctly restores its
   * state from whatever is in storage right now.
   */
  rehydrate(): void {
    this.activeKeys = [];
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!isValidSerializedPayload(parsed)) {
        console.warn(
          `${LOG_PREFIX} REHYDRATE SCHEMA MISMATCH`,
          "Persisted active keys data failed validation, falling back to clean state."
        );
        this.storage.removeItem(WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY);
        return;
      }
      const sanitized = parsed.activeKeys
        .map(sanitizeWalletActiveKey)
        .filter((k): k is WalletActiveKey => k !== null);

      // Surface partial corruption: the good entries are still restored, but
      // silently dropping the bad ones would hide a real storage problem.
      const dropped = parsed.activeKeys.length - sanitized.length;
      if (dropped > 0) {
        console.warn(
          `${LOG_PREFIX} REHYDRATE DROPPED ENTRIES`,
          `Discarded ${dropped} malformed active key entr${
            dropped === 1 ? "y" : "ies"
          }; restored ${sanitized.length}.`
        );
      }

      this.activeKeys = sanitized;
    } catch (err) {
      console.warn(
        `${LOG_PREFIX} REHYDRATE FAILED`,
        err instanceof Error ? err.message : String(err)
      );
      try {
        this.storage.removeItem(WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY);
      } catch {
        // no-op — best effort cleanup
      }
    }
  }

  /**
   * Replaces the storage backend used by this store instance and
   * immediately re-reads state from the new backend. Intended as a
   * narrow test-support seam so tests can supply an in-memory Storage
   * mock without reaching into the private `storage` field. Safe to
   * call at runtime as well (e.g. to swap to sessionStorage in a
   * security-sensitive mode).
   */
  overrideStorage(nextStorage: Storage | null): void {
    this.storage = nextStorage;
    this.rehydrate();
  }

  addActiveKey(key: WalletActiveKey): void {
    const sanitized = sanitizeWalletActiveKey(key);
    if (!sanitized) return;
    
    // Remove existing entry for the same wallet IDs to avoid duplicates
    this.activeKeys = this.activeKeys.filter(k => k.walletId !== sanitized.walletId);
    this.activeKeys.push(sanitized);
    this.persist();
  }

  removeActiveKey(walletId: string): void {
    this.activeKeys = this.activeKeys.filter(k => k.walletId !== walletId);
    this.persist();
  }

  getActiveKeys(): WalletActiveKey[] {
    return this.activeKeys.map(k => ({
      walletId: k.walletId,
      address: k.address,
      connectedAt: k.connectedAt,
    }));
  }

  hasActiveKey(walletId: string): boolean {
    return this.activeKeys.some(k => k.walletId === walletId);
  }

  clear(): void {
    this.activeKeys = [];
    if (this.storage) {
      try {
        this.storage.removeItem(WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY);
      } catch (err) {
        console.warn(
          `${LOG_PREFIX} CLEAR STORAGE FAILED`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  }
}

export const walletActiveKeysStore = new WalletActiveKeysStore();

/**
 * Registers an active wallet key in the persistent store. This should be
 * called when a wallet successfully connects so the disconnect handler can
 * track which wallets are currently active across reload cycles.
 *
 * @param walletId - The wallet provider ID.
 * @param address - The wallet address.
 */
export function registerActiveWalletKey(
  walletId: string,
  address: string
): void {
  walletActiveKeysStore.addActiveKey({
    walletId,
    address,
    connectedAt: Date.now(),
  });
}

// =============================================================
// Disconnect with availability pre-check
// =============================================================

export interface WalletDisconnectResult {
  /** `true` when the disconnect operation succeeded. */
  success: boolean;
  /** Error message when the disconnect failed. `null` on success. */
  error: string | null;
  /**
   * Human-readable fallback instructions shown when the wallet is not
   * installed.  `null` when no fallback is needed.
   */
  fallbackInstructions: string | null;
  /** Install URL for the missing wallet, if known. */
  installUrl: string | null;
}

/**
 * Snapshot of an in-flight transaction at the moment a disconnect is
 * triggered.  All fields are optional so callers can supply whatever
 * identifying info they have without fabricating values.
 */
export interface PendingTxSnapshot {
  /** Transaction hash / id (XDR hash, ledger hash, or any stable identifier). */
  txId?: string;
  /** Human-readable status label (e.g. "signing", "submitted", "pending"). */
  status?: string;
  /** Additional freeform context string (e.g. operation type). */
  context?: string;
}

/**
 * Attempts to disconnect a wallet, performing an availability check first.
 *
 * If the wallet extension is not installed, the disconnect is skipped and
 * the returned result carries `fallbackInstructions` instead of throwing.
 * This prevents a confusing "wallet not found" error from appearing when
 * the user has already uninstalled the extension.
 *
 * The whole call — availability pre-check included — runs inside the loader
 * lifecycle, so the spinner overlay is visible for the entire operation and
 * is cleared again on every exit path (success, missing wallet, or error).
 *
 * On every exit path the active key is removed from the persistent store, so
 * the wallet is not remembered across reload cycles.
 *
 * If a transaction is in flight at the time of the disconnect call, pass it
 * via `pendingTx` so it is logged as a console.warn for post-mortem
 * debugging — the handler does not change control flow based on it.
 *
 * User signature rejections are caught gracefully: a warning toast is shown
 * and the function returns success (since the user intentionally cancelled).
 *
 * @param walletId - The wallet provider ID.
 * @param disconnectFn - The actual disconnect function (e.g. StellarWalletsKit.disconnect()).
 * @param detector - Optional availability-detector override for tests.
 * @param options - Optional timeout and cleanup options.
 * @param pendingTx - Optional snapshot of an in-flight transaction at disconnect time.
 * @param showToast - Optional toast handler for user rejection warnings.
 */
export async function disconnectWalletWithCheck(
  walletId: string,
  disconnectFn: (signal?: AbortSignal) => Promise<void>,
  detector?: () => boolean,
  options?: WalletDisconnectTimeoutOptions,
  pendingTx?: PendingTxSnapshot,
  showToast?: (message: string, type: "warning" | "error" | "info" | "success") => void,
): Promise<WalletDisconnectResult> {
  // Warn immediately if a transaction was in flight when disconnect was called.
  if (pendingTx && (pendingTx.txId ?? pendingTx.status ?? pendingTx.context)) {
    console.warn(
      `${LOG_PREFIX} DISCONNECT WITH PENDING TRANSACTION for "${walletId}":`,
      {
        txId: pendingTx.txId ?? null,
        status: pendingTx.status ?? null,
        context: pendingTx.context ?? null,
      },
    );
  }

  return withWalletDisconnectLoader(async () => {
    const availability = checkWalletAvailabilityById(walletId, detector);

    if (!availability.available) {
      console.warn(
        `${LOG_PREFIX} Wallet "${walletId}" is not installed — skipping disconnect.`,
      );
      // Remove from active keys store even if wallet is not installed
      walletActiveKeysStore.removeActiveKey(walletId);
      return {
        success: false,
        error: null,
        fallbackInstructions: availability.setupInstruction,
        installUrl: availability.installUrl,
      };
    }

    try {
      await runWalletDisconnectWithTimeout(
        (signal) => disconnectFn(signal),
        options,
      );
      // Remove from active keys store on successful disconnect
      walletActiveKeysStore.removeActiveKey(walletId);
      console.info(
        `${LOG_PREFIX} Wallet "${walletId}" disconnected successfully.`,
      );
      return {
        success: true,
        error: null,
        fallbackInstructions: null,
        installUrl: null,
      };
    } catch (err) {
      // Handle user rejection gracefully - show warning toast and return success
      if (isWalletDisconnectUserRejected(err)) {
        console.warn(
          `${LOG_PREFIX} DISCONNECT REJECTED by user for "${walletId}":`,
          err,
        );
        // Remove from active keys store even on user rejection
        walletActiveKeysStore.removeActiveKey(walletId);
        if (showToast) {
          showToast(
            "Disconnect cancelled — you rejected the request in your wallet.",
            "warning",
          );
        }
        return {
          success: true,
          error: null,
          fallbackInstructions: null,
          installUrl: null,
        };
      }

      const message =
        err instanceof Error
          ? err.message
          : "Unknown error during wallet disconnect.";

      console.error(`${LOG_PREFIX} DISCONNECT FAILED for "${walletId}":`, err);

      return {
        success: false,
        error: message,
        fallbackInstructions: null,
        installUrl: null,
      };
    }
  });
}

// =============================================================
// Loader overlay lifecycle (#238)
// =============================================================

/**
 * Number of `wallet_disconnect_handler` operations currently in flight.
 * Kept as a counter (rather than a boolean) so overlapping disconnects do
 * not hide the overlay while a sibling operation is still running.
 */
let activeDisconnectOperations = 0;

const disconnectLoaderListeners = new Set<(isLoading: boolean) => void>();

/** `true` while at least one disconnect operation is in flight. */
export function isWalletDisconnectLoading(): boolean {
  return activeDisconnectOperations > 0;
}

function notifyDisconnectLoaderListeners(): void {
  const loading = activeDisconnectOperations > 0;
  disconnectLoaderListeners.forEach((listener) => listener(loading));
}

/**
 * Subscribes to disconnect loading-state changes.  The listener is invoked
 * immediately with the current state so a subscriber mounted mid-operation
 * still renders the overlay.  Returns an unsubscribe function.
 */
export function subscribeToWalletDisconnectLoading(
  listener: (isLoading: boolean) => void,
): () => void {
  disconnectLoaderListeners.add(listener);
  listener(activeDisconnectOperations > 0);
  return () => {
    disconnectLoaderListeners.delete(listener);
  };
}

/** Marks a disconnect operation as started and shows the loader overlay. */
export function startWalletDisconnectOperation(): void {
  activeDisconnectOperations++;
  notifyDisconnectLoaderListeners();
}

/**
 * Marks a disconnect operation as finished.  Clamped at zero so an
 * unbalanced `end` call can never drive the counter negative and wedge the
 * overlay permanently open.
 */
export function endWalletDisconnectOperation(): void {
  activeDisconnectOperations = Math.max(0, activeDisconnectOperations - 1);
  notifyDisconnectLoaderListeners();
}

/** Force-clears all in-flight operations (test teardown / hard reset). */
export function resetWalletDisconnectOperations(): void {
  activeDisconnectOperations = 0;
  notifyDisconnectLoaderListeners();
}

/**
 * Executes an async disconnect operation wrapped in the loader lifecycle.
 * The `finally` block guarantees the spinner is hidden again even when the
 * wrapped operation rejects.
 */
export async function withWalletDisconnectLoader<T>(
  fn: () => Promise<T>,
): Promise<T> {
  startWalletDisconnectOperation();
  try {
    return await fn();
  } finally {
    endWalletDisconnectOperation();
  }
}

// =============================================================
// Network mismatch detection (#236)
// =============================================================

export type WalletDisconnectNetwork = "mainnet" | "testnet";

/** Stellar network passphrases mapped to the network labels used in the UI. */
export const DISCONNECT_NETWORK_PASSPHRASES: Record<
  WalletDisconnectNetwork,
  string
> = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
};

/**
 * Normalizes a network identifier into a `WalletDisconnectNetwork` label.
 *
 * Accepts either a bare label ("mainnet", "TESTNET") or a full Stellar
 * network passphrase, because wallet extensions report the two
 * interchangeably.  Returns `null` when the value is empty or unrecognized.
 */
export function normalizeDisconnectNetwork(
  value: string | null | undefined,
): WalletDisconnectNetwork | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed === "") return null;

  const lowered = trimmed.toLowerCase();
  if (lowered === "mainnet" || lowered === "public") return "mainnet";
  if (lowered === "testnet" || lowered === "test") return "testnet";

  for (const [network, passphrase] of Object.entries(
    DISCONNECT_NETWORK_PASSPHRASES,
  )) {
    if (passphrase.toLowerCase() === lowered) {
      return network as WalletDisconnectNetwork;
    }
  }

  return null;
}

export interface WalletDisconnectNetworkMismatchState {
  /** `true` when the wallet network differs from the app network. */
  mismatched: boolean;
  /** Normalized wallet network, or `null` when unrecognized. */
  walletNetwork: WalletDisconnectNetwork | null;
  /** Normalized app network, or `null` when unrecognized. */
  appNetwork: WalletDisconnectNetwork | null;
  /** `true` when either side could not be normalized. */
  unknownNetwork: boolean;
  /** User-facing warning copy, or `null` when the networks match. */
  warningMessage: string | null;
}

function capitalizeNetwork(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Compares the connected wallet's chain network against the network this
 * app is configured for and produces the warning bar state.
 *
 * An unrecognized network on either side is surfaced as a mismatch too — a
 * disconnect against an unknown chain is exactly the case the user needs to
 * be told about, rather than one to silently ignore.
 */
export function checkDisconnectNetworkMatch(
  walletNetwork: string | null | undefined,
  appNetwork: string | null | undefined,
): WalletDisconnectNetworkMismatchState {
  const wallet = normalizeDisconnectNetwork(walletNetwork);
  const app = normalizeDisconnectNetwork(appNetwork);

  if (wallet === null || app === null) {
    return {
      mismatched: true,
      walletNetwork: wallet,
      appNetwork: app,
      unknownNetwork: true,
      warningMessage:
        "Unable to determine which network your wallet is on. " +
        "Verify the wallet network before disconnecting.",
    };
  }

  if (wallet !== app) {
    return {
      mismatched: true,
      walletNetwork: wallet,
      appNetwork: app,
      unknownNetwork: false,
      warningMessage:
        `Network mismatch: your wallet is on ${capitalizeNetwork(wallet)} ` +
        `but this app uses ${capitalizeNetwork(app)}. ` +
        "Switch networks to continue.",
    };
  }

  return {
    mismatched: false,
    walletNetwork: wallet,
    appNetwork: app,
    unknownNetwork: false,
    warningMessage: null,
  };
}

/**
 * Runs a network match check and logs a warning when the wallet chain does
 * not line up with the chain this app is configured for.
 */
export function warnOnDisconnectNetworkMismatch(
  walletNetwork: string | null | undefined,
  appNetwork: string | null | undefined,
): WalletDisconnectNetworkMismatchState {
  const state = checkDisconnectNetworkMatch(walletNetwork, appNetwork);

  if (state.mismatched && state.warningMessage) {
    console.warn(`${LOG_PREFIX} NETWORK MISMATCH:`, state.warningMessage);
  }

  return state;
}

// =============================================================
// User signature rejection handling (#235)
// =============================================================

export class WalletDisconnectUserRejectedError extends Error {
  constructor(message = "user rejected transaction") {
    super(message);
    this.name = "WalletDisconnectUserRejectedError";
  }
}

/**
 * Detects "user rejected the signature request" style errors from wallet
 * disconnect operations. Mirrors the pattern used in albedo_connector and
 * freighter_connector for consistency across the codebase.
 */
export function isWalletDisconnectUserRejected(err: unknown): boolean {
  if (err instanceof WalletDisconnectUserRejectedError) return true;
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    message.includes("user rejected") ||
    message.includes("user declined") ||
    message.includes("request rejected") ||
    message.includes("denied by the user") ||
    message.includes("rejected by user") ||
    message.includes("canceled by user") ||
    message.includes("cancelled by user")
  );
}

// =============================================================
// Gas estimation / simulation fee warnings (#240)
// =============================================================

/** Simulation / fee estimation result as returned by Soroban RPC. */
export interface WalletDisconnectSimulationResult {
  /** Estimated fee in stroops (1 XLM = 10_000_000 stroops). */
  fee: number;
  /** Optional error string from the simulation response. */
  error?: string;
  /** Raw simulation error object when the RPC reports a failure. */
  simulationError?: unknown;
}

export interface WalletDisconnectGasWarningState {
  /** `true` when a warning banner should be displayed. */
  hasWarning: boolean;
  /** `true` when the estimated fee exceeds the standard bound. */
  highFee: boolean;
  /** `true` when the simulation itself reported a failure. */
  simulationError: boolean;
  /** User-facing warning copy, or `null` when the fee is within bounds. */
  warningMessage: string | null;
}

/**
 * Fee ceiling above which a high-fee warning is emitted.
 * 1_000_000 stroops = 0.1 XLM.
 */
export const DISCONNECT_HIGH_FEE_THRESHOLD_STROOPS = 1_000_000;

/** Stroops per XLM, used to render the fee in human-readable units. */
const STROOPS_PER_XLM = 10_000_000;

/**
 * Inspects a simulation result and produces a user-facing warning state when
 * fee limits exceed standard bounds or the simulation reported an error.
 *
 * Simulation errors take precedence over the fee check: when the RPC could
 * not simulate the operation, the fee it reports is not trustworthy.
 */
export function checkDisconnectSimulationFeeWarning(
  result: WalletDisconnectSimulationResult | null | undefined,
): WalletDisconnectGasWarningState {
  if (!result) {
    return {
      hasWarning: false,
      highFee: false,
      simulationError: false,
      warningMessage: null,
    };
  }

  if (result.error || result.simulationError) {
    const message =
      typeof result.error === "string" && result.error
        ? `Transaction simulation failed: ${result.error}`
        : "Transaction simulation failed. The contract may have rejected this operation.";

    return {
      hasWarning: true,
      highFee: false,
      simulationError: true,
      warningMessage: message,
    };
  }

  if (typeof result.fee !== "number" || !Number.isFinite(result.fee)) {
    return {
      hasWarning: true,
      highFee: false,
      simulationError: true,
      warningMessage:
        "Transaction simulation returned an invalid fee estimate. " +
        "Review before signing.",
    };
  }

  if (result.fee > DISCONNECT_HIGH_FEE_THRESHOLD_STROOPS) {
    const xlm = (result.fee / STROOPS_PER_XLM).toFixed(7);
    return {
      hasWarning: true,
      highFee: true,
      simulationError: false,
      warningMessage:
        `Estimated fee is unusually high (${result.fee} stroops / ${xlm} XLM). ` +
        "Review before signing.",
    };
  }

  return {
    hasWarning: false,
    highFee: false,
    simulationError: false,
    warningMessage: null,
  };
}

/**
 * Inspects a simulation result and logs a console warning when a fee or
 * simulation warning applies, in addition to returning the banner state.
 */
export function warnOnDisconnectSimulationFee(
  result: WalletDisconnectSimulationResult | null | undefined,
): WalletDisconnectGasWarningState {
  const state = checkDisconnectSimulationFeeWarning(result);

  if (state.hasWarning && state.warningMessage) {
    const title = state.simulationError
      ? "SIMULATION ERROR"
      : "HIGH FEE WARNING";
    console.warn(`${LOG_PREFIX} ${title}:`, state.warningMessage);
  }

  return state;
}
