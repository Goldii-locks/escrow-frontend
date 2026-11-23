/**
 * Ledger active-address persistence split out of `ledger_usb_bridge` so the
 * globally mounted wallet provider can clear session state without pulling
 * the Stellar SDK into every route's first load (#850).
 */

const WARN_PREFIX = "[ledger_usb_bridge]";

export const LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY =
  "ledger_usb_bridge_active_addresses";
export const LEDGER_ACTIVE_ADDRESSES_SCHEMA_VERSION = 1;

export type LedgerNetwork = "mainnet" | "testnet";

export interface LedgerActiveAddress {
  address: string;
  derivationPath: string;
  accountIndex: number;
  label?: string;
  network: LedgerNetwork;
  lastUsedAt: number;
}

interface LedgerActiveAddressesSerialized {
  version: number;
  addresses: LedgerActiveAddress[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidLedgerActiveAddress(value: unknown): value is LedgerActiveAddress {
  if (!isRecord(value)) return false;
  if (typeof value.address !== "string" || value.address.length === 0) return false;
  if (typeof value.derivationPath !== "string") return false;
  if (typeof value.accountIndex !== "number" || !Number.isFinite(value.accountIndex)) return false;
  if (value.network !== "mainnet" && value.network !== "testnet") return false;
  if (typeof value.lastUsedAt !== "number" || !Number.isFinite(value.lastUsedAt)) return false;
  return true;
}

function sanitizeLedgerActiveAddress(value: unknown): LedgerActiveAddress | null {
  if (!isValidLedgerActiveAddress(value)) return null;
  const sanitized: LedgerActiveAddress = {
    address: value.address,
    derivationPath: value.derivationPath,
    accountIndex: value.accountIndex,
    network: value.network,
    lastUsedAt: value.lastUsedAt,
  };
  if (typeof value.label === "string" && value.label.length > 0) {
    sanitized.label = value.label;
  }
  return sanitized;
}

function isValidSerializedPayload(value: unknown): value is LedgerActiveAddressesSerialized {
  if (!isRecord(value)) return false;
  if (value.version !== LEDGER_ACTIVE_ADDRESSES_SCHEMA_VERSION) return false;
  if (!Array.isArray(value.addresses)) return false;
  return value.addresses.every(isValidLedgerActiveAddress);
}

function getStorageAdapter(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const testKey = "__ledger_usb_bridge_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

function warn(title: string, body: string, err?: unknown): void {
  console.warn(
    `${WARN_PREFIX} ${title}`,
    body,
    err instanceof Error ? err.message : err
  );
}

export class LedgerActiveAddressStore {
  private addresses: LedgerActiveAddress[] = [];
  private storage: Storage | null;

  constructor(storageOverride?: Storage | null) {
    this.storage =
      storageOverride !== undefined ? storageOverride : getStorageAdapter();
    this.rehydrate();
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      const payload: LedgerActiveAddressesSerialized = {
        version: LEDGER_ACTIVE_ADDRESSES_SCHEMA_VERSION,
        addresses: this.addresses,
      };
      this.storage.setItem(
        LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY,
        JSON.stringify(payload)
      );
    } catch (err) {
      warn("PERSIST FAILED", err instanceof Error ? err.message : String(err), err);
    }
  }

  private rehydrate(): void {
    this.addresses = [];
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!isValidSerializedPayload(parsed)) {
        warn(
          "REHYDRATE SCHEMA MISMATCH",
          "Persisted active address data failed validation, falling back to clean state."
        );
        this.storage.removeItem(LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY);
        return;
      }
      this.addresses = parsed.addresses
        .map(sanitizeLedgerActiveAddress)
        .filter((a): a is LedgerActiveAddress => a !== null);
    } catch (err) {
      warn("REHYDRATE FAILED", err instanceof Error ? err.message : String(err), err);
      try {
        this.storage.removeItem(LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY);
      } catch {
        // no-op — best effort cleanup
      }
    }
  }

  setActiveAddresses(addresses: LedgerActiveAddress[]): void {
    const sanitized = addresses
      .map(sanitizeLedgerActiveAddress)
      .filter((a): a is LedgerActiveAddress => a !== null);
    this.addresses = sanitized;
    this.persist();
  }

  getActiveAddresses(): LedgerActiveAddress[] {
    return this.addresses.map((a) => ({ ...a }));
  }

  addOrUpdateAddress(address: LedgerActiveAddress): void {
    const sanitized = sanitizeLedgerActiveAddress(address);
    if (!sanitized) return;
    const existingIndex = this.addresses.findIndex(
      (a) =>
        a.address === sanitized.address &&
        a.derivationPath === sanitized.derivationPath
    );
    if (existingIndex >= 0) {
      this.addresses[existingIndex] = sanitized;
    } else {
      this.addresses.push(sanitized);
    }
    this.persist();
  }

  removeAddress(address: string): void {
    this.addresses = this.addresses.filter((a) => a.address !== address);
    this.persist();
  }

  clear(): void {
    this.addresses = [];
    if (this.storage) {
      try {
        this.storage.removeItem(LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY);
      } catch (err) {
        warn("CLEAR STORAGE FAILED", err instanceof Error ? err.message : String(err), err);
      }
    }
  }
}

export const ledgerActiveAddresses = new LedgerActiveAddressStore();
