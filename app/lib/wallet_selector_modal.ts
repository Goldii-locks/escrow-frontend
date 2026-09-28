/**
 * wallet_selector_modal — Pure helper functions backing the wallet
 * selector modal component (`app/components/WalletSelectorModal.tsx`).
 * Provides network mismatch detection, persistent caching for active keys,
 * and loading-state management for wallet operations.
 *
 * Mirrors the conventions established by `app/lib/wallet_state_context.ts`
 * and `app/lib/wallet_state_store.ts`.
 */

const LOG_PREFIX = "[wallet_selector_modal]";

// =============================================================
// Network mismatch detection (#task-1)
// =============================================================

/** Supported Stellar network passphrases used in this application. */
export const APP_NETWORK_PASSPHRASES: Record<string, string> = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
};

/**
 * Determines whether the given wallet network matches the expected app
 * network.  A mismatch triggers a warning in the wallet selector modal.
 */
export function checkNetworkMismatch(
  walletNetwork: string,
  expectedNetwork: string,
): { mismatched: boolean; warningMessage: string | null } {
  if (!walletNetwork || !expectedNetwork) {
    return {
      mismatched: false,
      warningMessage: null,
    };
  }

  if (walletNetwork !== expectedNetwork) {
    const walletDisplay = walletNetwork.length > 40
      ? `${walletNetwork.slice(0, 20)}…`
      : walletNetwork;

    const expectedDisplay = expectedNetwork.length > 40
      ? `${expectedNetwork.slice(0, 20)}…`
      : expectedNetwork;

    return {
      mismatched: true,
      warningMessage:
        `Network mismatch detected: wallet is on "${walletDisplay}" ` +
        `but this app expects "${expectedDisplay}". ` +
        "Please switch your wallet network to continue.",
    };
  }

  return { mismatched: false, warningMessage: null };
}

/**
 * Builds a user-friendly network mismatch message for a given wallet ID.
 * Returns `null` when networks match.
 */
export function buildWalletSelectorMismatchMessage(
  walletId: string,
  walletNetwork: string,
  appNetwork: string,
): string | null {
  const result = checkNetworkMismatch(walletNetwork, appNetwork);
  if (!result.mismatched) return null;

  const walletName = walletId.charAt(0).toUpperCase() + walletId.slice(1);

  return (
    `⚠️ ${walletName} network mismatch: your wallet is on a different ` +
    `network than this application. Please switch to the correct network ` +
    `in your ${walletName} wallet extension.`
  );
}

// =============================================================
// Persistent caching for active keys (#task-2)
// =============================================================

const STORAGE_KEY = "wallet_selector_modal_active_key";
const CACHED_SCHEMA_VERSION = 1;

/** Shape of a cached wallet key entry. */
export interface WalletCachedKey {
  walletId: string;
  address: string;
  networkPassphrase: string;
  connectedAt: number;
}

interface WalletCachedKeySerializedV1 {
  version: 1;
  walletId: string;
  address: string;
  networkPassphrase: string;
  connectedAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidCachedKey(value: unknown): value is WalletCachedKey {
  if (!isRecord(value)) return false;
  if (typeof value.walletId !== "string" || value.walletId.length === 0)
    return false;
  if (typeof value.address !== "string" || value.address.length === 0)
    return false;
  if (typeof value.networkPassphrase !== "string") return false;
  if (typeof value.connectedAt !== "number" || !Number.isFinite(value.connectedAt))
    return false;
  return true;
}

function isValidSerializedPayload(
  value: unknown,
): value is WalletCachedKeySerializedV1 {
  if (!isRecord(value)) return false;
  if (value.version !== CACHED_SCHEMA_VERSION) return false;
  return isValidCachedKey(value);
}

function getStorageAdapter(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const testKey = "__wallet_selector_modal_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch {
    return null;
  }
}

function sanitizeCachedKey(value: unknown): WalletCachedKey | null {
  if (!isValidCachedKey(value)) return null;
  return {
    walletId: value.walletId,
    address: value.address,
    networkPassphrase: value.networkPassphrase,
    connectedAt: value.connectedAt,
  };
}

// =============================================================
// Loading state management (#task-3)
// =============================================================

let activeWalletOperationCount = 0;
const walletLoadingListeners = new Set<(isLoading: boolean) => void>();

/**
 * Returns `true` when at least one wallet operation is in flight.
 */
export function isModalWalletLoading(): boolean {
  return activeWalletOperationCount > 0;
}

/**
 * Subscribes to loading-state transitions.  The listener is invoked
 * immediately with the current state.  Returns an unsubscribe function.
 */
export function subscribeToModalWalletLoading(
  listener: (isLoading: boolean) => void,
): () => void {
  walletLoadingListeners.add(listener);
  listener(activeWalletOperationCount > 0);
  return () => {
    walletLoadingListeners.delete(listener);
  };
}

function notifyModalWalletLoadingListeners(): void {
  const loading = activeWalletOperationCount > 0;
  walletLoadingListeners.forEach((l) => l(loading));
}

/**
 * Marks the start of a wallet operation (connect, disconnect, sign, etc.).
 * Increments the internal counter and notifies all subscribers.
 */
export function startModalWalletOperation(): void {
  activeWalletOperationCount++;
  notifyModalWalletLoadingListeners();
}

/**
 * Marks the end of a wallet operation.  Decrements the internal counter
 * (clamped to zero) and notifies all subscribers.
 */
export function endModalWalletOperation(): void {
  activeWalletOperationCount = Math.max(0, activeWalletOperationCount - 1);
  notifyModalWalletLoadingListeners();
}

/**
 * Wraps an async function in the loading lifecycle.  The spinner is shown
 * on entry and cleared on exit — even when the wrapped call throws.
 */
export async function withModalWalletLoader<T>(
  fn: () => Promise<T>,
): Promise<T> {
  startModalWalletOperation();
  try {
    return await fn();
  } finally {
    endModalWalletOperation();
  }
}

// =============================================================
// WalletSelectorStore — singleton for cached key management (#task-2)
// =============================================================

/**
 * Manages the persistent cache of the last-used wallet key inside the
 * wallet selector modal.  The cached key allows the modal to pre-select
 * the previously active wallet on reload.
 */
export class WalletSelectorStore {
  private cachedKey: WalletCachedKey | null = null;
  private storage: Storage | null;

  constructor(storageOverride?: Storage | null) {
    this.storage =
      storageOverride !== undefined ? storageOverride : getStorageAdapter();
    this.rehydrate();
  }

  private persist(): void {
    if (!this.storage) return;
    try {
      if (this.cachedKey) {
        const payload: WalletCachedKeySerializedV1 = {
          version: CACHED_SCHEMA_VERSION,
          walletId: this.cachedKey.walletId,
          address: this.cachedKey.address,
          networkPassphrase: this.cachedKey.networkPassphrase,
          connectedAt: this.cachedKey.connectedAt,
        };
        this.storage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } else {
        this.storage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.warn(
        `${LOG_PREFIX} PERSIST FAILED`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  /**
   * Reads the persisted key from storage and populates the in-memory cache.
   * Called automatically on construction; can be called again after
   * `overrideStorage` swaps the backend.
   */
  rehydrate(): void {
    this.cachedKey = null;
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!isValidSerializedPayload(parsed)) {
        console.warn(
          `${LOG_PREFIX} REHYDRATE SCHEMA MISMATCH`,
          "Persisted wallet selector key failed validation, falling back to clean state.",
        );
        this.storage.removeItem(STORAGE_KEY);
        return;
      }
      this.cachedKey = sanitizeCachedKey(parsed);
    } catch (err) {
      console.warn(
        `${LOG_PREFIX} REHYDRATE FAILED`,
        err instanceof Error ? err.message : String(err),
      );
      try {
        this.storage.removeItem(STORAGE_KEY);
      } catch {
        // no-op
      }
    }
  }

  /**
   * Replaces the storage backend and rehydrates from the new source.
   */
  overrideStorage(nextStorage: Storage | null): void {
    this.storage = nextStorage;
    this.rehydrate();
  }

  /**
   * Stores the active wallet key and persists it for future reloads.
   * Pass `null` to clear the cache.
   */
  setCachedKey(key: WalletCachedKey | null): void {
    this.cachedKey = key ? sanitizeCachedKey(key) : null;
    this.persist();
  }

  /**
   * Returns a defensive copy of the cached key, or `null` if nothing is
   * cached.
   */
  getCachedKey(): WalletCachedKey | null {
    if (!this.cachedKey) return null;
    return {
      walletId: this.cachedKey.walletId,
      address: this.cachedKey.address,
      networkPassphrase: this.cachedKey.networkPassphrase,
      connectedAt: this.cachedKey.connectedAt,
    };
  }

  /**
   * Clears the cached key from both memory and storage.
   */
  clear(): void {
    this.cachedKey = null;
    if (this.storage) {
      try {
        this.storage.removeItem(STORAGE_KEY);
      } catch (err) {
        console.warn(
          `${LOG_PREFIX} CLEAR STORAGE FAILED`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }
}

/** Module-level singleton for the wallet selector modal store. */
export const walletSelectorStore = new WalletSelectorStore();

// =============================================================
// Transaction timeout clocks
// =============================================================
//
// Once the user picks a wallet from the list the modal hands the transaction
// to that provider and waits for a signature. Providers can hang indefinitely
// (extension never opens, hardware wallet asleep, user walks away), so every
// request is raced against a timeout clock. On expiry the operation is
// aborted through an `AbortSignal` and any sensitive payload memory the
// request carried is zeroed and dropped.

/** Default bound for a signature requested from the wallet selector modal. */
export const DEFAULT_WALLET_SELECTOR_TIMEOUT_MS = 60_000;

export interface WalletSelectorSignRequest {
  /** Id of the wallet chosen from the dropdown list. */
  walletId: string;
  /** Transaction XDR handed to the provider. */
  xdr: string;
  /** Sensitive buffer cleared on timeout / completion. */
  payload?: Uint8Array | null;
}

/** Signing callback invoked with the request XDR and an abort signal. */
export type WalletSelectorSignFn<T> = (
  xdr: string,
  signal: AbortSignal
) => Promise<T>;

export class WalletSelectorTimeoutError extends Error {
  constructor(
    public readonly timeoutMs: number,
    public readonly walletId?: string
  ) {
    super(
      walletId
        ? `Wallet "${walletId}" signature timed out after ${timeoutMs}ms`
        : `Wallet signature timed out after ${timeoutMs}ms`
    );
    this.name = "WalletSelectorTimeoutError";
  }
}

/** Zeroes and drops a sensitive buffer so it cannot be retained after abort. */
export function clearWalletSelectorSensitiveMemory(
  request: WalletSelectorSignRequest
): WalletSelectorSignRequest {
  if (request.payload) {
    request.payload.fill(0);
  }
  request.payload = null;
  return request;
}

interface PendingWalletSelectorOperation {
  walletId: string;
  startedAt: number;
  controller: AbortController;
}

const pendingOperations = new Map<number, PendingWalletSelectorOperation>();
let nextOperationId = 1;

/** Number of signature requests still in flight. */
export function getPendingWalletSelectorOperationCount(): number {
  return pendingOperations.size;
}

/** Wallet ids of the signature requests still in flight. */
export function getPendingWalletSelectorWalletIds(): string[] {
  return Array.from(pendingOperations.values(), (op) => op.walletId);
}

/**
 * Aborts every in-flight signature request and empties the registry. Called
 * when the modal unmounts or the user closes it mid-request.
 */
export function abortAllWalletSelectorOperations(): number {
  const aborted = pendingOperations.size;
  for (const operation of pendingOperations.values()) {
    operation.controller.abort();
  }
  pendingOperations.clear();
  return aborted;
}

function normalizeSelectorTimeout(timeoutMs: number): number {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return DEFAULT_WALLET_SELECTOR_TIMEOUT_MS;
  }
  return timeoutMs;
}

/**
 * Races a signature request from the wallet selector modal against a timeout
 * clock. On expiry the operation is aborted via its `AbortSignal`, the
 * sensitive payload is cleared, and a {@link WalletSelectorTimeoutError} is
 * thrown. The pending-operation registry is emptied on every exit path so no
 * controller or buffer outlives the request.
 *
 * @param request   - Wallet id, XDR and optional sensitive payload.
 * @param signFn    - Provider callback; receives the XDR and an abort signal.
 * @param timeoutMs - Bound in ms. Defaults to
 *                    {@link DEFAULT_WALLET_SELECTOR_TIMEOUT_MS}.
 */
export async function signWithWalletSelectorTimeout<T>(
  request: WalletSelectorSignRequest,
  signFn: WalletSelectorSignFn<T>,
  timeoutMs: number = DEFAULT_WALLET_SELECTOR_TIMEOUT_MS
): Promise<T> {
  const bound = normalizeSelectorTimeout(timeoutMs);
  const controller = new AbortController();
  const operationId = nextOperationId++;

  pendingOperations.set(operationId, {
    walletId: request.walletId,
    startedAt: Date.now(),
    controller,
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      clearWalletSelectorSensitiveMemory(request);
      console.warn(
        `${LOG_PREFIX} SIGNATURE TIMEOUT — wallet "${request.walletId}" did not respond within ${bound}ms; operation aborted and memory cleared.`
      );
      reject(new WalletSelectorTimeoutError(bound, request.walletId));
    }, bound);
  });

  try {
    const result = await Promise.race([
      signFn(request.xdr, controller.signal),
      timeoutPromise,
    ]);
    clearWalletSelectorSensitiveMemory(request);
    return result;
  } catch (err) {
    if (timedOut || err instanceof WalletSelectorTimeoutError) {
      clearWalletSelectorSensitiveMemory(request);
    }
    throw err;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    pendingOperations.delete(operationId);
  }
}
