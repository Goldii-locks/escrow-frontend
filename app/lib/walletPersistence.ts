export const FREIGHTER_STORAGE_KEY = "freighter_wallet_state";
export const FREIGHTER_STORAGE_VERSION = 1 as const;

export type StellarNetwork = "testnet" | "mainnet";

export interface PersistedWalletState {
  version: typeof FREIGHTER_STORAGE_VERSION;
  address: string;
  network: StellarNetwork;
  connectedAt: number;
}

const VALID_NETWORKS: ReadonlyArray<StellarNetwork> = ["testnet", "mainnet"];

function isStellarNetwork(value: unknown): value is StellarNetwork {
  return typeof value === "string" && VALID_NETWORKS.includes(value as StellarNetwork);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validatePersistedState(data: unknown): data is PersistedWalletState {
  if (!isRecord(data)) return false;

  if (data.version !== FREIGHTER_STORAGE_VERSION) return false;

  if (typeof data.address !== "string" || data.address.length === 0) return false;

  if (!isStellarNetwork(data.network)) return false;

  if (typeof data.connectedAt !== "number" || Number.isNaN(data.connectedAt)) return false;

  return true;
}

export function serializeWalletState(
  address: string,
  network: StellarNetwork = "testnet",
): void {
  if (typeof window === "undefined") return;

  const state: PersistedWalletState = {
    version: FREIGHTER_STORAGE_VERSION,
    address,
    network,
    connectedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(FREIGHTER_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to persist wallet state", e);
  }
}

export function deserializeWalletState(): PersistedWalletState | null {
  if (typeof window === "undefined") return null;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(FREIGHTER_STORAGE_KEY);
  } catch (e) {
    console.error("Failed to read persisted wallet state", e);
    return null;
  }

  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn("Corrupted persisted wallet state, clearing", e);
    clearWalletState();
    return null;
  }

  if (!validatePersistedState(parsed)) {
    console.warn("Invalid persisted wallet state schema, clearing");
    clearWalletState();
    return null;
  }

  return parsed;
}

export function clearWalletState(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(FREIGHTER_STORAGE_KEY);
  } catch (e) {
    console.error("Failed to clear persisted wallet state", e);
  }
}
