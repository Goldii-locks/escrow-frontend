/**
 * freighter_connector — Freighter (and multi-wallet) session persistence.
 *
 * Handles serialization, validation, and safe restoration of active wallet
 * state across browser reload cycles via localStorage. The module is named
 * "freighter_connector" for historical reasons (Freighter was the first
 * supported wallet) but it supports all wallet IDs exposed by the kit.
 */

export type FreighterNetwork = "mainnet" | "testnet";

export type SupportedFreighterWalletId =
  | "freighter"
  | "albedo"
  | "xbull"
  | "hana";

export interface FreighterSerializedState {
  address: string;
  selectedWalletId: SupportedFreighterWalletId;
  connectedAt: number;
  network: FreighterNetwork;
  version: number;
}

export interface FreighterRestoredState {
  restored: boolean;
  address: string | null;
  selectedWalletId: SupportedFreighterWalletId;
  connectedAt: number | null;
  network: FreighterNetwork | null;
  parseError: string | null;
}

export interface FreighterTxPhase {
  phase:
    | "idle"
    | "connecting"
    | "restoring"
    | "signing"
    | "submitting"
    | "success"
    | "error";
  message: string;
  timestamp: number;
}

export interface FreighterNetworkMismatchState {
  mismatched: boolean;
  walletNetwork: FreighterNetwork;
  appNetwork: FreighterNetwork;
  warningMessage: string | null;
}

const WARN_PREFIX = "[freighter_connector]";

export const FREIGHTER_STORAGE_KEY = "milesto_freighter_session_v1";

export const FREIGHTER_STATE_VERSION = 1;

export const DEFAULT_FREIGHTER_WALLET_ID: SupportedFreighterWalletId =
  "freighter";

const VALID_WALLET_IDS: ReadonlySet<SupportedFreighterWalletId> = new Set([
  "freighter",
  "albedo",
  "xbull",
  "hana",
]);

const VALID_NETWORKS: ReadonlySet<FreighterNetwork> = new Set([
  "mainnet",
  "testnet",
]);

const STELLAR_ADDRESS_REGEX = /^G[A-Z0-9]{55}$/;

export function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_REGEX.test(address);
}

export function isValidWalletId(
  value: unknown
): value is SupportedFreighterWalletId {
  return (
    typeof value === "string" &&
    VALID_WALLET_IDS.has(value as SupportedFreighterWalletId)
  );
}

export function isValidNetwork(value: unknown): value is FreighterNetwork {
  return (
    typeof value === "string" &&
    VALID_NETWORKS.has(value as FreighterNetwork)
  );
}

export function formatStackTrace(err?: unknown): string {
  if (err instanceof Error && err.stack) {
    return err.stack;
  }

  if (typeof err === "string" && err.includes("\n")) {
    return err;
  }

  const synthetic = new Error(
    typeof err === "string" ? err : "Freighter connector trace"
  );
  return synthetic.stack ?? "Error: Freighter connector trace";
}

export function buildFreighterWarningBlock(block: {
  title: string;
  body: string;
  stack: string;
  address?: string;
  phase?: FreighterTxPhase["phase"];
}): string {
  const lines = [
    `${WARN_PREFIX} ╔══════════════════════════════════════╗`,
    `${WARN_PREFIX} ║ ${block.title.padEnd(36).slice(0, 36)} ║`,
    `${WARN_PREFIX} ╚══════════════════════════════════════╝`,
    `${WARN_PREFIX} ${block.body}`,
  ];

  if (block.address) {
    lines.push(`${WARN_PREFIX} address: ${block.address}`);
  }
  if (block.phase) {
    lines.push(`${WARN_PREFIX} phase: ${block.phase}`);
  }

  lines.push(`${WARN_PREFIX} --- stack trace ---`);
  for (const frame of block.stack.split("\n")) {
    lines.push(`${WARN_PREFIX} ${frame}`);
  }
  lines.push(`${WARN_PREFIX} --- end stack ---`);

  return lines.join("\n");
}

export function logFreighterWarning(
  title: string,
  body: string,
  options?: {
    err?: unknown;
    address?: string;
    phase?: FreighterTxPhase["phase"];
  }
): string {
  const stack = formatStackTrace(options?.err);
  const formatted = buildFreighterWarningBlock({
    title,
    body,
    stack,
    address: options?.address,
    phase: options?.phase,
  });
  console.warn(formatted);
  return formatted;
}

export class FreighterStateParseError extends Error {
  constructor(
    public readonly field: string | null,
    message: string
  ) {
    super(message);
    this.name = "FreighterStateParseError";
  }
}

export function validateSerializedState(
  raw: unknown
): FreighterSerializedState {
  if (raw === null || raw === undefined) {
    throw new FreighterStateParseError(null, "Stored state is null or undefined");
  }

  if (typeof raw !== "object") {
    throw new FreighterStateParseError(
      null,
      `Stored state must be an object, got ${typeof raw}`
    );
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.version !== "number") {
    throw new FreighterStateParseError(
      "version",
      `version must be a number, got ${typeof obj.version}`
    );
  }

  if (obj.version !== FREIGHTER_STATE_VERSION) {
    throw new FreighterStateParseError(
      "version",
      `Unsupported state version: ${obj.version}, expected ${FREIGHTER_STATE_VERSION}`
    );
  }

  if (typeof obj.address !== "string") {
    throw new FreighterStateParseError(
      "address",
      `address must be a string, got ${typeof obj.address}`
    );
  }

  if (!isValidStellarAddress(obj.address)) {
    throw new FreighterStateParseError(
      "address",
      `address is not a valid Stellar public key: ${obj.address.slice(0, 8)}...`
    );
  }

  if (!isValidWalletId(obj.selectedWalletId)) {
    throw new FreighterStateParseError(
      "selectedWalletId",
      `selectedWalletId is invalid: ${String(obj.selectedWalletId)}`
    );
  }

  if (typeof obj.connectedAt !== "number" || isNaN(obj.connectedAt)) {
    throw new FreighterStateParseError(
      "connectedAt",
      `connectedAt must be a valid number, got ${String(obj.connectedAt)}`
    );
  }

  if (obj.connectedAt <= 0) {
    throw new FreighterStateParseError(
      "connectedAt",
      `connectedAt must be positive, got ${obj.connectedAt}`
    );
  }

  if (!isValidNetwork(obj.network)) {
    throw new FreighterStateParseError(
      "network",
      `network is invalid: ${String(obj.network)}`
    );
  }

  return {
    address: obj.address,
    selectedWalletId: obj.selectedWalletId as SupportedFreighterWalletId,
    connectedAt: obj.connectedAt,
    network: obj.network as FreighterNetwork,
    version: obj.version,
  };
}

export function serializeWalletState(
  state: Omit<FreighterSerializedState, "version" | "connectedAt"> & {
    connectedAt?: number;
  }
): FreighterSerializedState {
  const validatedAddress = state.address;
  if (!isValidStellarAddress(validatedAddress)) {
    throw new FreighterStateParseError(
      "address",
      `Invalid Stellar address for serialization`
    );
  }

  if (!isValidWalletId(state.selectedWalletId)) {
    throw new FreighterStateParseError(
      "selectedWalletId",
      `Invalid wallet ID for serialization: ${state.selectedWalletId}`
    );
  }

  if (!isValidNetwork(state.network)) {
    throw new FreighterStateParseError(
      "network",
      `Invalid network for serialization: ${state.network}`
    );
  }

  return {
    address: validatedAddress,
    selectedWalletId: state.selectedWalletId,
    connectedAt: state.connectedAt ?? Date.now(),
    network: state.network,
    version: FREIGHTER_STATE_VERSION,
  };
}

interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getStorage(): StorageAdapter | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  try {
    const testKey = "__freighter_storage_test__";
    window.localStorage.setItem(testKey, "ok");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function saveFreighterState(
  state: Omit<FreighterSerializedState, "version" | "connectedAt"> & {
    connectedAt?: number;
  },
  options?: { storage?: StorageAdapter }
): boolean {
  try {
    const storage = options?.storage ?? getStorage();
    if (!storage) return false;

    const serialized = serializeWalletState(state);
    storage.setItem(FREIGHTER_STORAGE_KEY, JSON.stringify(serialized));
    return true;
  } catch (err) {
    logFreighterWarning(
      "SAVE FAILED",
      `Unable to persist wallet session to storage`,
      { err, address: state.address, phase: "error" }
    );
    return false;
  }
}

export function parseFreighterState(
  rawJson: string
): FreighterSerializedState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new FreighterStateParseError(
      null,
      `JSON parse error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  return validateSerializedState(parsed);
}

export function loadFreighterState(options?: {
  storage?: StorageAdapter;
}): FreighterRestoredState {
  const fallback: FreighterRestoredState = {
    restored: false,
    address: null,
    selectedWalletId: DEFAULT_FREIGHTER_WALLET_ID,
    connectedAt: null,
    network: null,
    parseError: null,
  };

  try {
    const storage = options?.storage ?? getStorage();
    if (!storage) return fallback;

    const raw = storage.getItem(FREIGHTER_STORAGE_KEY);
    if (raw === null) return fallback;

    const state = parseFreighterState(raw);
    return {
      restored: true,
      address: state.address,
      selectedWalletId: state.selectedWalletId,
      connectedAt: state.connectedAt,
      network: state.network,
      parseError: null,
    };
  } catch (err) {
    const errorMessage =
      err instanceof FreighterStateParseError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);

    logFreighterWarning(
      "RESTORE FAILED",
      `Dropping stale wallet session: ${errorMessage}`,
      { err, phase: "restoring" }
    );

    try {
      const storage = options?.storage ?? getStorage();
      if (storage) storage.removeItem(FREIGHTER_STORAGE_KEY);
    } catch {
      // ignore cleanup failure
    }

    return {
      ...fallback,
      parseError: errorMessage,
    };
  }
}

export function clearFreighterState(options?: {
  storage?: StorageAdapter;
}): boolean {
  try {
    const storage = options?.storage ?? getStorage();
    if (!storage) return false;
    storage.removeItem(FREIGHTER_STORAGE_KEY);
    return true;
  } catch (err) {
    logFreighterWarning("CLEAR FAILED", `Unable to clear wallet session`, {
      err,
      phase: "error",
    });
    return false;
  }
}

function capitalizeNetwork(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function checkFreighterNetworkMatch(
  walletNetwork: FreighterNetwork,
  appNetwork: FreighterNetwork
): FreighterNetworkMismatchState {
  const mismatched = walletNetwork !== appNetwork;
  return {
    mismatched,
    walletNetwork,
    appNetwork,
    warningMessage: mismatched
      ? `Network mismatch: your wallet is on ${capitalizeNetwork(walletNetwork)} but this app uses ${capitalizeNetwork(appNetwork)}. Switch networks to continue.`
      : null,
  };
}

export function warnOnFreighterNetworkMismatch(
  walletNetwork: FreighterNetwork,
  appNetwork: FreighterNetwork
): FreighterNetworkMismatchState {
  const state = checkFreighterNetworkMatch(walletNetwork, appNetwork);
  if (state.mismatched && state.warningMessage) {
    logFreighterWarning(
      "NETWORK MISMATCH",
      state.warningMessage,
      { phase: "restoring" }
    );
  }
  return state;
}

export function passphraseToNetwork(
  passphrase: string
): FreighterNetwork | null {
  if (passphrase === "Test SDF Network ; September 2015") return "testnet";
  if (passphrase === "Public Global Stellar Network ; September 2015")
    return "mainnet";
  return null;
}

export class FreighterSessionManager {
  private state: FreighterRestoredState;
  private storage: StorageAdapter | null;

  constructor(options?: { storage?: StorageAdapter }) {
    this.storage = options?.storage ?? getStorage();
    this.state = loadFreighterState({ storage: this.storage ?? undefined });
  }

  getState(): FreighterRestoredState {
    return { ...this.state };
  }

  persist(
    data: Omit<FreighterSerializedState, "version" | "connectedAt"> & {
      connectedAt?: number;
    }
  ): boolean {
    const ok = saveFreighterState(data, {
      storage: this.storage ?? undefined,
    });
    if (ok) {
      this.state = loadFreighterState({
        storage: this.storage ?? undefined,
      });
    }
    return ok;
  }

  restore(): FreighterRestoredState {
    this.state = loadFreighterState({
      storage: this.storage ?? undefined,
    });
    return { ...this.state };
  }

  clear(): boolean {
    const ok = clearFreighterState({
      storage: this.storage ?? undefined,
    });
    if (ok) {
      this.state = {
        restored: false,
        address: null,
        selectedWalletId: DEFAULT_FREIGHTER_WALLET_ID,
        connectedAt: null,
        network: null,
        parseError: null,
      };
    }
    return ok;
  }
}

export const freighterSession = new FreighterSessionManager();
