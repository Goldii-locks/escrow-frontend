/**
 * transaction_signer_component — sign transaction interface.
 *
 * Serializes the signer's active session (address, wallet and network) to
 * `localStorage` so a page reload does not drop the user back to a
 * disconnected state. Only non-sensitive identifiers are persisted: any
 * payload carrying a secret key, seed or auth token is rejected on parse.
 */

export const TX_SIGNER_STATE_VERSION = 1 as const;
export const TX_SIGNER_STORAGE_KEY = "transaction_signer_active_session";

const LOG_PREFIX = "[transaction_signer_component]";

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface TransactionSignerSession {
  /** Active Stellar public address the signer is bound to. */
  address: string;
  /** Id of the wallet provider that produced the session. */
  walletId: string;
  /** Network passphrase the session was established against. */
  networkPassphrase: string;
  /** Epoch millis the session became active. */
  connectedAt: number;
}

export interface TransactionSignerSerializedState
  extends TransactionSignerSession {
  version: typeof TX_SIGNER_STATE_VERSION;
}

export interface TransactionSignerRestoredState {
  /** True when a valid session was read back from storage. */
  restored: boolean;
  /** Reason the persisted payload was rejected, or null. */
  parseError: string | null;
  /** The restored session, or null when nothing valid was stored. */
  session: TransactionSignerSession | null;
}

const SENSITIVE_FIELD_PATTERN =
  /(secret|private[_-]?key|seed|mnemonic|password|credential|auth[_-]?token)/i;

const STELLAR_ADDRESS_PATTERN = /^G[A-Z2-7]{55}$/;

export class TransactionSignerStateParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionSignerStateParseError";
  }
}

/** Format-only Stellar public key check (G + 55 base32 chars). */
export function isValidSignerAddress(value: unknown): value is string {
  return typeof value === "string" && STELLAR_ADDRESS_PATTERN.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Wraps a session in the versioned envelope written to storage. */
export function serializeSignerState(input: {
  address: string;
  walletId: string;
  networkPassphrase: string;
  connectedAt?: number;
}): TransactionSignerSerializedState {
  return {
    version: TX_SIGNER_STATE_VERSION,
    address: input.address,
    walletId: input.walletId,
    networkPassphrase: input.networkPassphrase,
    connectedAt: input.connectedAt ?? Date.now(),
  };
}

/** Validates a decoded payload, throwing {@link TransactionSignerStateParseError}. */
export function validateSignerState(
  value: unknown
): TransactionSignerSerializedState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TransactionSignerStateParseError("expected object");
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (SENSITIVE_FIELD_PATTERN.test(key)) {
      throw new TransactionSignerStateParseError(
        `forbidden sensitive field "${key}"`
      );
    }
  }

  if (record.version !== TX_SIGNER_STATE_VERSION) {
    throw new TransactionSignerStateParseError("unsupported version");
  }
  if (!isValidSignerAddress(record.address)) {
    throw new TransactionSignerStateParseError("invalid address");
  }
  if (!isNonEmptyString(record.walletId)) {
    throw new TransactionSignerStateParseError("invalid walletId");
  }
  if (!isNonEmptyString(record.networkPassphrase)) {
    throw new TransactionSignerStateParseError("invalid networkPassphrase");
  }
  if (
    typeof record.connectedAt !== "number" ||
    !Number.isFinite(record.connectedAt) ||
    record.connectedAt <= 0
  ) {
    throw new TransactionSignerStateParseError("invalid connectedAt");
  }

  return {
    version: TX_SIGNER_STATE_VERSION,
    address: record.address,
    walletId: record.walletId,
    networkPassphrase: record.networkPassphrase,
    connectedAt: record.connectedAt,
  };
}

/** Parses a raw storage string into a validated session envelope. */
export function parseSignerState(
  raw: string
): TransactionSignerSerializedState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new TransactionSignerStateParseError("invalid JSON");
  }
  return validateSignerState(parsed);
}

export interface TransactionSignerPersistOptions {
  storage?: StorageAdapter | null;
}

function resolveStorageAdapter(
  storage?: StorageAdapter | null
): StorageAdapter | null {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  try {
    const testKey = "__transaction_signer_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

const EMPTY_STATE: TransactionSignerRestoredState = {
  restored: false,
  parseError: null,
  session: null,
};

/** Writes the active session. Returns false when the input or storage is unusable. */
export function saveSignerState(
  input: {
    address: string;
    walletId: string;
    networkPassphrase: string;
    connectedAt?: number;
  },
  options?: TransactionSignerPersistOptions
): boolean {
  if (
    !isValidSignerAddress(input.address) ||
    !isNonEmptyString(input.walletId) ||
    !isNonEmptyString(input.networkPassphrase)
  ) {
    return false;
  }

  const storage = resolveStorageAdapter(options?.storage);
  if (!storage) return false;

  try {
    storage.setItem(
      TX_SIGNER_STORAGE_KEY,
      JSON.stringify(serializeSignerState(input))
    );
    return true;
  } catch (err) {
    console.warn(
      `${LOG_PREFIX} PERSIST FAILED`,
      err instanceof Error ? err.message : String(err)
    );
    return false;
  }
}

/**
 * Reads the active session back after a reload. A payload that fails
 * validation is discarded from storage so the next reload starts clean.
 */
export function loadSignerState(
  options?: TransactionSignerPersistOptions
): TransactionSignerRestoredState {
  const storage = resolveStorageAdapter(options?.storage);
  if (!storage) {
    return { ...EMPTY_STATE, parseError: "storage unavailable" };
  }

  let raw: string | null;
  try {
    raw = storage.getItem(TX_SIGNER_STORAGE_KEY);
  } catch {
    return { ...EMPTY_STATE, parseError: "storage read failed" };
  }

  if (!raw) return { ...EMPTY_STATE };

  try {
    const state = parseSignerState(raw);
    return {
      restored: true,
      parseError: null,
      session: {
        address: state.address,
        walletId: state.walletId,
        networkPassphrase: state.networkPassphrase,
        connectedAt: state.connectedAt,
      },
    };
  } catch (err) {
    const message =
      err instanceof TransactionSignerStateParseError
        ? err.message
        : "invalid persisted state";
    try {
      storage.removeItem(TX_SIGNER_STORAGE_KEY);
    } catch {
      // best-effort cleanup
    }
    console.warn(`${LOG_PREFIX} REHYDRATE FAILED`, message);
    return { ...EMPTY_STATE, parseError: message };
  }
}

/** Drops the persisted session (used on disconnect). */
export function clearSignerState(
  options?: TransactionSignerPersistOptions
): boolean {
  const storage = resolveStorageAdapter(options?.storage);
  if (!storage) return false;

  try {
    storage.removeItem(TX_SIGNER_STORAGE_KEY);
    return true;
  } catch (err) {
    console.warn(
      `${LOG_PREFIX} CLEAR FAILED`,
      err instanceof Error ? err.message : String(err)
    );
    return false;
  }
}

/**
 * In-memory mirror of the persisted session, rehydrated on construction so
 * the signer interface can render the active address on the first paint.
 */
export class TransactionSignerSessionStore {
  private memory: TransactionSignerRestoredState;
  private storage: StorageAdapter | null;

  constructor(storage?: StorageAdapter | null) {
    this.storage =
      storage !== undefined ? storage : resolveStorageAdapter(undefined);
    this.memory = loadSignerState({ storage: this.storage });
  }

  getState(): TransactionSignerRestoredState {
    return {
      ...this.memory,
      session: this.memory.session ? { ...this.memory.session } : null,
    };
  }

  /** Active address, or null when no session survived the reload. */
  getActiveAddress(): string | null {
    return this.memory.session?.address ?? null;
  }

  persist(input: {
    address: string;
    walletId: string;
    networkPassphrase: string;
    connectedAt?: number;
  }): boolean {
    const ok = saveSignerState(input, { storage: this.storage });
    if (ok) {
      this.memory = {
        restored: true,
        parseError: null,
        session: {
          address: input.address,
          walletId: input.walletId,
          networkPassphrase: input.networkPassphrase,
          connectedAt: input.connectedAt ?? Date.now(),
        },
      };
    }
    return ok;
  }

  /** Re-reads storage — the reload path. */
  restore(): TransactionSignerRestoredState {
    this.memory = loadSignerState({ storage: this.storage });
    return this.getState();
  }

  /** Swaps the storage adapter and rehydrates from it. */
  overrideStorage(nextStorage: StorageAdapter | null): void {
    this.storage = nextStorage;
    this.memory = loadSignerState({ storage: this.storage });
  }

  clear(): void {
    clearSignerState({ storage: this.storage });
    this.memory = { ...EMPTY_STATE };
  }
}
