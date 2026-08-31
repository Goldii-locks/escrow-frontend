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
    console.warn(
      `${LOG_PREFIX} AVAILABILITY CHECK FAILED for ${walletId}:`,
      err instanceof Error ? err.message : String(err),
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
 * @param walletId - The wallet provider ID.
 * @param disconnectFn - The actual disconnect function (e.g. StellarWalletsKit.disconnect()).
 * @param detector - Optional availability-detector override for tests.
 */
export async function disconnectWalletWithCheck(
  walletId: string,
  disconnectFn: () => Promise<void>,
  detector?: () => boolean,
): Promise<WalletDisconnectResult> {
  return withWalletDisconnectLoader(async () => {
    const availability = checkWalletAvailabilityById(walletId, detector);

    if (!availability.available) {
      console.warn(
        `${LOG_PREFIX} Wallet "${walletId}" is not installed — skipping disconnect.`,
      );
      return {
        success: false,
        error: null,
        fallbackInstructions: availability.setupInstruction,
        installUrl: availability.installUrl,
      };
    }

    try {
      await disconnectFn();
      return {
        success: true,
        error: null,
        fallbackInstructions: null,
        installUrl: null,
      };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unknown error during wallet disconnect.";

      console.warn(`${LOG_PREFIX} DISCONNECT FAILED for ${walletId}:`, message);

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
