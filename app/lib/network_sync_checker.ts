/**
 * network_sync_checker — active network status validator:
 * alignment checks, wallet availability detection, signature time limits,
 * and graceful handling of wallet signature rejections during sync probes.
 */

import type { ToastType } from "@/app/context/ToastContext";

export type SyncNetwork = "mainnet" | "testnet";

export type SyncToastHandler = (message: string, type: ToastType) => void;

export type WalletAvailabilityStatus =
  | "available"
  | "unavailable"
  | "error";

export interface WalletAvailabilityState {
  available: boolean;
  status: WalletAvailabilityStatus;
  /** User-facing setup instructions when the wallet extension is missing. */
  setupInstruction: string | null;
  warningMessage: string | null;
}

const LOG_PREFIX = "[network_sync_checker]";

/** Default bound for wallet signature probes during network sync. */
export const DEFAULT_SIGNATURE_TIMEOUT_MS = 60_000;

/** Install URL for Freighter — the primary recommended Stellar extension. */
export const WALLET_INSTALL_URL = "https://www.freighter.app/";

/** Fallback copy shown when no supported wallet extension is detected. */
export const WALLET_SETUP_INSTRUCTION =
  "No wallet extension detected. Install a supported Stellar wallet (Freighter, Albedo, xBull, or Hana) and refresh this page to continue.";

export interface NetworkSyncState {
  synced: boolean;
  walletNetwork: SyncNetwork;
  appNetwork: SyncNetwork;
  warningMessage: string | null;
}

export interface NetworkSyncSignRequest {
  xdr: string;
  /** Sensitive buffer cleared on timeout / completion. */
  payload?: Uint8Array | null;
}

export interface NetworkSyncSignResult {
  signedXdr: string;
}

export class NetworkSyncSignatureTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Network sync signature timed out after ${timeoutMs}ms`);
    this.name = "NetworkSyncSignatureTimeoutError";
  }
}

export class NetworkSyncUserRejectedError extends Error {
  constructor(message = "user rejected transaction") {
    super(message);
    this.name = "NetworkSyncUserRejectedError";
  }
}

export function isNetworkSyncUserRejected(err: unknown): boolean {
  if (err instanceof NetworkSyncUserRejectedError) return true;
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    message.includes("user rejected") ||
    message.includes("user declined") ||
    message.includes("request rejected") ||
    message.includes("denied by the user")
  );
}

/** Zeroes and drops a sensitive buffer so it cannot be retained after abort. */
export function clearSensitiveMemory(
  request: NetworkSyncSignRequest
): NetworkSyncSignRequest {
  if (request.payload) {
    request.payload.fill(0);
  }
  request.payload = null;
  return request;
}

/**
 * Races a signature operation against a timeout clock. On timeout the
 * operation is considered aborted and any sensitive payload memory is cleared.
 */
export async function signWithTimeout(
  request: NetworkSyncSignRequest,
  signFn: (xdr: string) => Promise<NetworkSyncSignResult>,
  timeoutMs: number = DEFAULT_SIGNATURE_TIMEOUT_MS
): Promise<NetworkSyncSignResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      clearSensitiveMemory(request);
      reject(new NetworkSyncSignatureTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([signFn(request.xdr), timeoutPromise]);
    clearSensitiveMemory(request);
    return result;
  } catch (err) {
    if (timedOut || err instanceof NetworkSyncSignatureTimeoutError) {
      clearSensitiveMemory(request);
    }
    throw err;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function capitalizeNetwork(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Compares wallet and app networks for sync readiness. */
export function checkNetworkSync(
  walletNetwork: SyncNetwork,
  appNetwork: SyncNetwork
): NetworkSyncState {
  const synced = walletNetwork === appNetwork;
  return {
    synced,
    walletNetwork,
    appNetwork,
    warningMessage: synced
      ? null
      : `Network out of sync: your wallet is on ${capitalizeNetwork(walletNetwork)} but this app uses ${capitalizeNetwork(appNetwork)}. Switch networks to continue.`,
  };
}

/**
 * Runs a wallet signature step during network sync validation. Catches
 * "user rejected transaction" exceptions, logs them, and shows a warning toast.
 */
export async function runNetworkSyncSign<T>(
  signFn: () => Promise<T>,
  showToast: SyncToastHandler
): Promise<T | null> {
  try {
    return await signFn();
  } catch (err) {
    if (isNetworkSyncUserRejected(err)) {
      console.warn(
        `${LOG_PREFIX} signature rejected during network sync:`,
        err instanceof Error ? err.message : err
      );
      showToast(
        "Network sync cancelled — you rejected the signature in your wallet.",
        "warning"
      );
      return null;
    }
    throw err;
  }
}

/**
 * Validates network alignment before running a sync signature probe. When
 * networks match, delegates to {@link runNetworkSyncSign}.
 */
export async function validateNetworkSyncWithSignature<T>(
  walletNetwork: SyncNetwork,
  appNetwork: SyncNetwork,
  signFn: () => Promise<T>,
  showToast: SyncToastHandler
): Promise<T | null> {
  const state = checkNetworkSync(walletNetwork, appNetwork);
  if (!state.synced && state.warningMessage) {
    showToast(state.warningMessage, "warning");
    return null;
  }
  return runNetworkSyncSign(signFn, showToast);
}

/**
 * Detects whether a supported Stellar wallet extension is present in the
 * browser. Accepts an optional detector for tests / non-browser runtimes.
 */
export function detectWalletExtension(detector?: () => boolean): boolean {
  if (detector) {
    return detector();
  }
  if (typeof window === "undefined") {
    return false;
  }
  const w = window as unknown as Record<string, unknown>;
  return !!(
    w["freighterApi"] ||
    w["freighter"] ||
    w["albedo"] ||
    w["xBullSDK"] ||
    w["hanaWallet"]
  );
}

/**
 * Checks wallet extension availability and returns fallback setup instructions
 * when the extension is missing or the check itself throws.
 */
export function checkWalletAvailability(
  detector?: () => boolean
): WalletAvailabilityState {
  try {
    const available = detectWalletExtension(detector);
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
      setupInstruction: WALLET_SETUP_INSTRUCTION,
      warningMessage: WALLET_SETUP_INSTRUCTION,
    };
  } catch (err) {
    console.warn(
      `${LOG_PREFIX} wallet availability check failed:`,
      err instanceof Error ? err.message : err
    );
    return {
      available: false,
      status: "error",
      setupInstruction: WALLET_SETUP_INSTRUCTION,
      warningMessage: `Unable to verify wallet availability. ${WALLET_SETUP_INSTRUCTION}`,
    };
  }
}

/**
 * Runs a wallet availability check and surfaces a warning toast when the
 * extension is missing or the check errors.
 */
export function warnOnMissingWallet(
  showToast: SyncToastHandler,
  detector?: () => boolean
): WalletAvailabilityState {
  const state = checkWalletAvailability(detector);
  if (!state.available && state.warningMessage) {
    showToast(state.warningMessage, "warning");
  }
  return state;
}
