/**
 * albedo_connector — loading / spinner state management for Albedo wallet ops.
 *
 * Ensures loader visibility starts before async Albedo calls and always clears
 * on success, failure, cancellation, or unexpected exceptions (try/finally).
 * Concurrent calls use a reference counter so the spinner does not flicker or
 * stick when multiple operations overlap.
 */

export type AlbedoLoadingOperation =
  | "connect"
  | "getAddress"
  | "sign"
  | "submit"
  | "popup"
  | "other";

export interface AlbedoLoadingState {
  /** True while at least one tracked Albedo operation is in flight. */
  isLoading: boolean;
  /** Number of nested / concurrent in-flight operations. */
  pendingCount: number;
  /** Most recently started operation label (for UI copy / debugging). */
  activeOperation: AlbedoLoadingOperation | null;
}

export type AlbedoLoadingListener = (state: AlbedoLoadingState) => void;

const LOG_PREFIX = "[albedo_connector]";

function snapshot(
  pendingCount: number,
  activeOperation: AlbedoLoadingOperation | null
): AlbedoLoadingState {
  return {
    isLoading: pendingCount > 0,
    pendingCount,
    activeOperation: pendingCount > 0 ? activeOperation : null,
  };
}

/**
 * Reference-counted loading manager for Albedo popup / wallet operations.
 */
export class AlbedoLoadingManager {
  private pendingCount = 0;
  private activeOperation: AlbedoLoadingOperation | null = null;
  private readonly listeners = new Set<AlbedoLoadingListener>();

  getState(): AlbedoLoadingState {
    return snapshot(this.pendingCount, this.activeOperation);
  }

  subscribe(listener: AlbedoLoadingListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  /** Marks the start of an Albedo async operation (spinner on). */
  start(operation: AlbedoLoadingOperation = "other"): AlbedoLoadingState {
    this.pendingCount += 1;
    this.activeOperation = operation;
    this.emit();
    return this.getState();
  }

  /**
   * Marks completion of one Albedo async operation (spinner off when the
   * last pending call finishes).
   */
  stop(): AlbedoLoadingState {
    if (this.pendingCount > 0) {
      this.pendingCount -= 1;
    }
    if (this.pendingCount === 0) {
      this.activeOperation = null;
    }
    this.emit();
    return this.getState();
  }

  /** Force-clears all pending ops (e.g. after a catastrophic failure). */
  reset(): AlbedoLoadingState {
    this.pendingCount = 0;
    this.activeOperation = null;
    this.emit();
    return this.getState();
  }

  /**
   * Runs an async Albedo operation with loading state bracketed in try/finally
   * so success, failure, cancellation, and thrown exceptions all clear the spinner.
   */
  async runWithLoading<T>(
    operation: AlbedoLoadingOperation,
    fn: () => Promise<T>
  ): Promise<T> {
    this.start(operation);
    try {
      return await fn();
    } catch (err) {
      console.warn(
        `${LOG_PREFIX} ${operation} failed:`,
        err instanceof Error ? err.message : err
      );
      throw err;
    } finally {
      this.stop();
    }
  }
}

/** Shared singleton used by Albedo wallet call sites. */
export const albedoLoading = new AlbedoLoadingManager();

/**
 * Convenience wrapper around the shared manager for one-off Albedo calls.
 */
export async function withAlbedoLoading<T>(
  operation: AlbedoLoadingOperation,
  fn: () => Promise<T>,
  manager: AlbedoLoadingManager = albedoLoading
): Promise<T> {
  return manager.runWithLoading(operation, fn);
}

/**
 * High-level helpers mirroring common Albedo popup flows. Callers inject the
 * actual Albedo / kit implementation so tests can stub without network I/O.
 */
export async function connectWithAlbedoLoading(
  connectFn: () => Promise<string>,
  manager: AlbedoLoadingManager = albedoLoading
): Promise<string> {
  return withAlbedoLoading("connect", connectFn, manager);
}

export async function getAddressWithAlbedoLoading(
  getAddressFn: () => Promise<string>,
  manager: AlbedoLoadingManager = albedoLoading
): Promise<string> {
  return withAlbedoLoading("getAddress", getAddressFn, manager);
}

export async function signWithAlbedoLoading(
  signFn: () => Promise<string>,
  manager: AlbedoLoadingManager = albedoLoading
): Promise<string> {
  return withAlbedoLoading("sign", signFn, manager);
}

export async function submitWithAlbedoLoading(
  submitFn: () => Promise<string>,
  manager: AlbedoLoadingManager = albedoLoading
): Promise<string> {
  return withAlbedoLoading("submit", submitFn, manager);
}

export async function runAlbedoPopupWithLoading(
  popupFn: () => Promise<unknown>,
  manager: AlbedoLoadingManager = albedoLoading
): Promise<unknown> {
  return withAlbedoLoading("popup", popupFn, manager);
}
