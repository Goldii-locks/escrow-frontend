/**
 * wallet_session — the small amount of wallet state the app needs on top of
 * @creit.tech/stellar-wallets-kit: a persisted Freighter active address that
 * is re-verified against the extension on reload, and the simulation fee
 * warning shown before signing. Everything else (availability detection,
 * timeouts, rejection parsing, network checks) is handled by the kit.
 */

import {
  getAddress as getFreighterAddress,
  isConnected as isFreighterConnected,
} from "@stellar/freighter-api";
import { withWalletLoader } from "@/app/lib/wallet_state_context";

const LOG_PREFIX = "[wallet_session]";

// Kept identical to the previous freighter_connector key so existing
// sessions survive the upgrade.
export const FREIGHTER_ACTIVE_ADDRESS_STORAGE_KEY = "freighter_connector_active_address";
const SCHEMA_VERSION = 1;

export interface FreighterActiveAddress {
  address: string;
  network: string;
  connectedAt: number;
}

function isActiveAddress(value: unknown): value is FreighterActiveAddress {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.address === "string" &&
    v.address.length > 0 &&
    typeof v.network === "string" &&
    typeof v.connectedAt === "number" &&
    Number.isFinite(v.connectedAt)
  );
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export class FreighterActiveAddressStore {
  private activeAddress: FreighterActiveAddress | null = null;

  constructor(private storage: Storage | null = getStorage()) {
    this.rehydrate();
  }

  rehydrate(): void {
    this.activeAddress = null;
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(FREIGHTER_ACTIVE_ADDRESS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (isActiveAddress(parsed) && (parsed as { version?: unknown }).version === SCHEMA_VERSION) {
        const { address, network, connectedAt } = parsed;
        this.activeAddress = { address, network, connectedAt };
      } else {
        this.storage.removeItem(FREIGHTER_ACTIVE_ADDRESS_STORAGE_KEY);
      }
    } catch (err) {
      console.warn(
        `${LOG_PREFIX} REHYDRATE FAILED`,
        err instanceof Error ? err.message : String(err)
      );
      this.clear();
    }
  }

  setActiveAddress(value: FreighterActiveAddress | null): void {
    if (!value || !isActiveAddress(value)) {
      this.clear();
      return;
    }
    const { address, network, connectedAt } = value;
    this.activeAddress = { address, network, connectedAt };
    try {
      this.storage?.setItem(
        FREIGHTER_ACTIVE_ADDRESS_STORAGE_KEY,
        JSON.stringify({ version: SCHEMA_VERSION, ...this.activeAddress })
      );
    } catch (err) {
      console.warn(
        `${LOG_PREFIX} PERSIST FAILED`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  getActiveAddress(): FreighterActiveAddress | null {
    return this.activeAddress ? { ...this.activeAddress } : null;
  }

  clear(): void {
    this.activeAddress = null;
    try {
      this.storage?.removeItem(FREIGHTER_ACTIVE_ADDRESS_STORAGE_KEY);
    } catch {
      // best effort
    }
  }
}

export const freighterActiveAddress = new FreighterActiveAddressStore();

/**
 * Re-verifies the persisted Freighter address against the extension. Clears
 * the persisted state and returns null if Freighter is locked, disconnected
 * or now on a different account.
 */
export async function verifyAndRehydrateFreighterAddress(
  getAddressFn: () => Promise<unknown> = getFreighterAddress,
  isConnectedFn: () => Promise<unknown> = isFreighterConnected
): Promise<string | null> {
  const persisted = freighterActiveAddress.getActiveAddress();
  if (!persisted) return null;

  return withWalletLoader(async () => {
    try {
      const conn = await isConnectedFn();
      const connected =
        typeof conn === "boolean"
          ? conn
          : Boolean((conn as { isConnected?: unknown } | null)?.isConnected);
      const live = connected ? await getAddressFn() : null;
      const liveAddress =
        typeof live === "string"
          ? live
          : String((live as { address?: unknown } | null)?.address ?? "");

      if (liveAddress && liveAddress === persisted.address) return liveAddress;
    } catch (err) {
      console.warn(`${LOG_PREFIX} verification check failed, clearing persisted state`, err);
    }
    freighterActiveAddress.clear();
    return null;
  });
}

/** Simulation / fee estimation result as returned by Soroban RPC. */
export interface WalletSimulationResult {
  /** Estimated fee in stroops (1 XLM = 10_000_000 stroops). */
  fee: number;
  error?: string;
  simulationError?: unknown;
}

export interface WalletGasWarningState {
  hasWarning: boolean;
  highFee: boolean;
  simulationError: boolean;
  warningMessage: string | null;
}

/** 1_000_000 stroops = 0.1 XLM. */
export const HIGH_FEE_THRESHOLD_STROOPS = 1_000_000;

export function checkSimulationFeeWarning(result: WalletSimulationResult): WalletGasWarningState {
  if (result.error || result.simulationError) {
    return {
      hasWarning: true,
      highFee: false,
      simulationError: true,
      warningMessage: result.error
        ? `Transaction simulation failed: ${result.error}`
        : "Transaction simulation failed. The contract may have rejected this operation.",
    };
  }

  if (result.fee > HIGH_FEE_THRESHOLD_STROOPS) {
    const xlm = (result.fee / 10_000_000).toFixed(7);
    return {
      hasWarning: true,
      highFee: true,
      simulationError: false,
      warningMessage: `Estimated fee is unusually high (${result.fee} stroops / ${xlm} XLM). Review before signing.`,
    };
  }

  return { hasWarning: false, highFee: false, simulationError: false, warningMessage: null };
}

// =============================================================================
// Freighter availability and rejection helpers used by the wallet selector
// modal (moved here from the removed freighter_connector, #650).
// =============================================================================

/** Install URL surfaced when no Freighter extension is detected. */
export const FREIGHTER_INSTALL_URL = "https://www.freighter.app/";

/** Fallback copy shown when the Freighter extension is missing. */
export const FREIGHTER_SETUP_INSTRUCTION =
  "Freighter wallet extension not detected. Install Freighter and refresh this page to continue.";

export interface FreighterAvailabilityState {
  available: boolean;
  status: "available" | "unavailable" | "error";
  /** User-facing setup instructions when the extension is missing. */
  setupInstruction: string | null;
  warningMessage: string | null;
}

/** Whether the Freighter extension has injected its API into the page. */
export function detectFreighterExtension(detector?: () => boolean): boolean {
  if (detector) return detector();
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return !!(w["freighterApi"] || w["freighter"]);
}

/**
 * Checks Freighter extension availability and returns setup instructions when
 * the extension is missing or the check itself throws.
 */
export function checkFreighterAvailability(detector?: () => boolean): FreighterAvailabilityState {
  try {
    if (detectFreighterExtension(detector)) {
      return { available: true, status: "available", setupInstruction: null, warningMessage: null };
    }
    return {
      available: false,
      status: "unavailable",
      setupInstruction: FREIGHTER_SETUP_INSTRUCTION,
      warningMessage: FREIGHTER_SETUP_INSTRUCTION,
    };
  } catch (err) {
    console.warn(
      `${LOG_PREFIX} wallet availability check failed:`,
      err instanceof Error ? err.message : err
    );
    return {
      available: false,
      status: "error",
      setupInstruction: FREIGHTER_SETUP_INSTRUCTION,
      warningMessage: `Unable to verify wallet availability. ${FREIGHTER_SETUP_INSTRUCTION}`,
    };
  }
}

/** True for the messages Freighter raises when the user rejects a request. */
export function isFreighterUserRejected(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    message.includes("user rejected") ||
    message.includes("user declined") ||
    message.includes("request rejected") ||
    message.includes("denied by the user")
  );
}
