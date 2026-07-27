/**
 * albedo_connector — Albedo popup wallet session helpers.
 * Securely persists non-sensitive active address / session state across reloads.
 *
 * Never stores private keys, secret keys, seeds, or signing material.
 */

export type AlbedoNetwork = "mainnet" | "testnet";

export const ALBEDO_STORAGE_KEY = "milesto_albedo_session_v1";
export const ALBEDO_STATE_VERSION = 1 as const;

/** Stellar public key: G + 55 base32 characters. */
const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

export interface AlbedoSerializedState {
  version: typeof ALBEDO_STATE_VERSION;
  /** Active public address only — never a secret key. */
  address: string;
  network: AlbedoNetwork;
  connectedAt: number;
}

export interface AlbedoRestoredState {
  restored: boolean;
  parseError: string | null;
  address: string | null;
  network: AlbedoNetwork | null;
  connectedAt: number | null;
}

export interface AlbedoPersistInput {
  address: string;
  network: AlbedoNetwork;
  connectedAt?: number;
}

export type StorageAdapter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export class AlbedoStateParseError extends Error {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message);
    this.name = "AlbedoStateParseError";
  }
}

const LOG_PREFIX = "[albedo_connector]";

export function isValidStellarAddress(address: unknown): address is string {
  return typeof address === "string" && STELLAR_ADDRESS_RE.test(address);
}

export function isValidNetwork(value: unknown): value is AlbedoNetwork {
  return value === "mainnet" || value === "testnet";
}

/**
 * Deep-validates a candidate persisted payload. Throws AlbedoStateParseError
 * on any malformed / stale / invalid field rather than trusting storage.
 */
export function validateSerializedState(
  value: unknown
): AlbedoSerializedState {
  if (value === null || value === undefined) {
    throw new AlbedoStateParseError("persisted state is missing", "root");
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new AlbedoStateParseError("persisted state must be an object", "root");
  }

  const obj = value as Record<string, unknown>;

  if (obj.version !== ALBEDO_STATE_VERSION) {
    throw new AlbedoStateParseError(
      `unsupported state version: ${String(obj.version)}`,
      "version"
    );
  }
  if (typeof obj.address !== "string") {
    throw new AlbedoStateParseError("address must be a string", "address");
  }
  if (!isValidStellarAddress(obj.address)) {
    throw new AlbedoStateParseError("address is not a valid Stellar public key", "address");
  }
  if (!isValidNetwork(obj.network)) {
    throw new AlbedoStateParseError("network is invalid", "network");
  }
  if (typeof obj.connectedAt !== "number" || !Number.isFinite(obj.connectedAt)) {
    throw new AlbedoStateParseError("connectedAt must be a finite number", "connectedAt");
  }
  if (obj.connectedAt <= 0) {
    throw new AlbedoStateParseError("connectedAt must be positive", "connectedAt");
  }

  // Reject accidental secret-key shaped fields if present in a future/malicious payload.
  for (const forbidden of ["secret", "secretKey", "privateKey", "seed", "mnemonic"]) {
    if (forbidden in obj) {
      throw new AlbedoStateParseError(
        `forbidden sensitive field "${forbidden}" must not be persisted`,
        forbidden
      );
    }
  }

  return {
    version: ALBEDO_STATE_VERSION,
    address: obj.address,
    network: obj.network,
    connectedAt: obj.connectedAt,
  };
}

/** Builds a versioned, validated session payload ready for storage. */
export function serializeWalletState(
  input: AlbedoPersistInput
): AlbedoSerializedState {
  const candidate: AlbedoSerializedState = {
    version: ALBEDO_STATE_VERSION,
    address: input.address,
    network: input.network,
    connectedAt: input.connectedAt ?? Date.now(),
  };
  return validateSerializedState(candidate);
}

/** Parses JSON text and validates the resulting session state. */
export function parseAlbedoState(raw: string): AlbedoSerializedState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new AlbedoStateParseError(
      `invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      "json"
    );
  }
  return validateSerializedState(parsed);
}

function getDefaultStorage(): StorageAdapter | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = window.localStorage;
    const testKey = "__albedo_storage_test__";
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return storage;
  } catch {
    return null;
  }
}

function resolveStorage(adapter?: StorageAdapter | null): StorageAdapter | null {
  if (adapter === null) return null;
  if (adapter) return adapter;
  return getDefaultStorage();
}

function emptyRestored(parseError: string | null = null): AlbedoRestoredState {
  return {
    restored: false,
    parseError,
    address: null,
    network: null,
    connectedAt: null,
  };
}

/**
 * Persists non-sensitive Albedo session state. Returns false on validation or
 * storage failures without throwing.
 */
export function saveAlbedoState(
  input: AlbedoPersistInput,
  options?: { storage?: StorageAdapter | null }
): boolean {
  try {
    const storage = resolveStorage(options?.storage);
    if (!storage) {
      console.warn(`${LOG_PREFIX} storage unavailable; session not persisted`);
      return false;
    }
    const serialized = serializeWalletState(input);
    storage.setItem(ALBEDO_STORAGE_KEY, JSON.stringify(serialized));
    return true;
  } catch (err) {
    console.warn(
      `${LOG_PREFIX} failed to persist session:`,
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

/**
 * Loads and validates persisted Albedo session state. Malformed / stale /
 * invalid entries are discarded (and the storage key cleared) rather than
 * crashing the app.
 */
export function loadAlbedoState(options?: {
  storage?: StorageAdapter | null;
}): AlbedoRestoredState {
  const storage = resolveStorage(options?.storage);
  if (!storage) {
    return emptyRestored("storage unavailable");
  }

  let raw: string | null;
  try {
    raw = storage.getItem(ALBEDO_STORAGE_KEY);
  } catch (err) {
    console.warn(
      `${LOG_PREFIX} failed to read session:`,
      err instanceof Error ? err.message : err
    );
    return emptyRestored("storage read failed");
  }

  if (raw === null || raw === undefined || raw === "") {
    return emptyRestored(null);
  }

  try {
    const state = parseAlbedoState(raw);
    return {
      restored: true,
      parseError: null,
      address: state.address,
      network: state.network,
      connectedAt: state.connectedAt,
    };
  } catch (err) {
    const message =
      err instanceof AlbedoStateParseError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    console.warn(`${LOG_PREFIX} discarding invalid persisted session:`, message);
    try {
      storage.removeItem(ALBEDO_STORAGE_KEY);
    } catch {
      // ignore clear failures after a bad parse
    }
    return emptyRestored(message);
  }
}

/** Clears persisted Albedo session state (e.g. on disconnect / logout). */
export function clearAlbedoState(options?: {
  storage?: StorageAdapter | null;
}): boolean {
  try {
    const storage = resolveStorage(options?.storage);
    if (!storage) return false;
    storage.removeItem(ALBEDO_STORAGE_KEY);
    return true;
  } catch (err) {
    console.warn(
      `${LOG_PREFIX} failed to clear session:`,
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

/**
 * OOP session manager that restores from storage on construction and keeps an
 * in-memory mirror of the active (public) Albedo address / network.
 */
export class AlbedoSessionManager {
  private state: AlbedoRestoredState;
  private readonly storage: StorageAdapter | null;

  constructor(storage?: StorageAdapter | null) {
    this.storage = resolveStorage(storage);
    this.state = loadAlbedoState({ storage: this.storage });
  }

  getState(): AlbedoRestoredState {
    return { ...this.state };
  }

  persist(input: AlbedoPersistInput): boolean {
    const ok = saveAlbedoState(input, { storage: this.storage });
    if (ok) {
      this.state = {
        restored: true,
        parseError: null,
        address: input.address,
        network: input.network,
        connectedAt: input.connectedAt ?? Date.now(),
      };
    }
    return ok;
  }

  /** Re-reads storage — simulates a page-reload restoration path. */
  restore(): AlbedoRestoredState {
    this.state = loadAlbedoState({ storage: this.storage });
    return this.getState();
  }

  clear(): boolean {
    const ok = clearAlbedoState({ storage: this.storage });
    this.state = emptyRestored(null);
    return ok;
  }
}

export const albedoSession = new AlbedoSessionManager();
