"use client";

const STORAGE_KEY = "wallet_state_store_active_state";
const SCHEMA_VERSION = 1;

export interface WalletActiveState {
  address: string;
  selectedWalletId: string;
  networkPassphrase: string;
  connectedAt: number;
}

interface WalletActiveStateSerializedV1 {
  version: 1;
  address: string;
  selectedWalletId: string;
  networkPassphrase: string;
  connectedAt: number;
}

type WalletActiveStateSerialized = WalletActiveStateSerializedV1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidWalletActiveState(value: unknown): value is WalletActiveState {
  if (!isRecord(value)) return false;
  if (typeof value.address !== "string" || value.address.length === 0) return false;
  if (typeof value.selectedWalletId !== "string" || value.selectedWalletId.length === 0) return false;
  if (typeof value.networkPassphrase !== "string") return false;
  if (typeof value.connectedAt !== "number" || !Number.isFinite(value.connectedAt)) return false;
  return true;
}

function sanitizeWalletActiveState(value: unknown): WalletActiveState | null {
  if (!isValidWalletActiveState(value)) return null;
  return {
    address: value.address,
    selectedWalletId: value.selectedWalletId,
    networkPassphrase: value.networkPassphrase,
    connectedAt: value.connectedAt,
  };
}

function isValidSerializedPayload(value: unknown): value is WalletActiveStateSerialized {
  if (!isRecord(value)) return false;
  if (value.version !== SCHEMA_VERSION) return false;
  if (typeof value.address !== "string" || value.address.length === 0) return false;
  if (typeof value.selectedWalletId !== "string" || value.selectedWalletId.length === 0) return false;
  if (typeof value.networkPassphrase !== "string") return false;
  if (typeof value.connectedAt !== "number" || !Number.isFinite(value.connectedAt)) return false;
  return true;
}

function getStorageAdapter(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const testKey = "__wallet_state_store_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

const LOG_PREFIX = "[wallet_state_store]";

export class WalletStateStore {
  private activeState: WalletActiveState | null = null;
  private storage: Storage | null;
  private transactionSigning = false;
  private listeners = new Set<() => void>();

  constructor(storageOverride?: Storage | null) {
    this.storage =
      storageOverride !== undefined ? storageOverride : getStorageAdapter();
    this.rehydrate();
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      if (this.activeState) {
        const payload: WalletActiveStateSerialized = {
          version: SCHEMA_VERSION,
          address: this.activeState.address,
          selectedWalletId: this.activeState.selectedWalletId,
          networkPassphrase: this.activeState.networkPassphrase,
          connectedAt: this.activeState.connectedAt,
        };
        this.storage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } else {
        this.storage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.warn(
        `$LOG_PREFIX} PERSIST FAILED `,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  rehydrate(): void {
    this.activeState = null;
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!isValidSerializedPayload(parsed)) {
        console.warn(
          `$LOG_PREFI} REHYDRATE SCHEMA MISMATCH `,
          "Persisted active state data failed validation, falling back to clean state."
        );
        this.storage.removeItem(STORAGE_KEY);
        return;
      }
      this.activeState = sanitizeWalletActiveState(parsed);
    } catch (err) {
      console.warn(
        `$LOG_PREFIX} REHYDRATE FAILED `,
        err instanceof Error ? err.message : String(err)
      );
      try {
        this.storage.removeItem(STORAGE_KEY);
      } catch {
        // no-op
      }
    }
  }

  overrideStorage(nextStorage: Storage | null): void {
    this.storage = nextStorage;
    this.rehydrate();
  }

  setActiveState(state: WalletActiveState | null): void {
    this.activeState = state ? sanitizeWalletActiveState(state) : null;
    this.persist();
  }

  getActiveState(): WalletActiveState | null {
    if (!this.activeState) return null;
    return {
      address: this.activeState.address,
      selectedWalletId: this.activeState.selectedWalletId,
      networkPassphrase: this.activeState.networkPassphrase,
      connectedAt: this.activeState.connectedAt,
    };
  }

  clear(): void {
    this.activeState = null;
    if (this.storage) {
      try {
        this.storage.removeItem(STORAGE_KEY);
      } catch (err) {
        console.warn(
          `$LOG_PREFIX} CLEAR STORAGE FAILED `,
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  }

  isTransactionSigning(): boolean {
    return this.transactionSigning;
  }

  setTransactionSigning(isSigning: boolean): void {
    if (this.transactionSigning === isSigning) return;
    this.transactionSigning = isSigning;
    this.emitChange();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const walletStateStore = new WalletStateStore();
