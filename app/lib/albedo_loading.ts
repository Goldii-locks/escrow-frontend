/** Albedo popup loading state, split out of the SDK-backed connector (#850). */

export type AlbedoLoadingOperation =
  | "sign"
  | "connect"
  | "submit"
  | "popup"
  | "other";

export interface AlbedoLoadingState {
  isLoading: boolean;
  pendingCount: number;
  activeOperation: AlbedoLoadingOperation | null;
}

type AlbedoLoadingListener = (state: AlbedoLoadingState) => void;

function logWarning(operation: string, message: string, err?: unknown): void {
  console.warn(
    `[albedo_connector] LOADING OPERATION FAILED`,
    `${operation} ${message}`,
    err instanceof Error ? err.message : err
  );
}

export class AlbedoLoadingManager {
  private pendingCount = 0;
  private activeOperation: AlbedoLoadingOperation | null = null;
  private readonly listeners = new Set<AlbedoLoadingListener>();

  private snapshot(): AlbedoLoadingState {
    return {
      isLoading: this.pendingCount > 0,
      pendingCount: this.pendingCount,
      activeOperation: this.pendingCount > 0 ? this.activeOperation : null,
    };
  }

  getState(): AlbedoLoadingState {
    return { ...this.snapshot() };
  }

  subscribe(listener: AlbedoLoadingListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  reset(): void {
    this.pendingCount = 0;
    this.activeOperation = null;
    this.notify();
  }

  async runWithLoading<T>(
    operation: AlbedoLoadingOperation,
    fn: () => Promise<T>
  ): Promise<T> {
    this.pendingCount++;
    if (this.activeOperation === null) {
      this.activeOperation = operation;
    }
    this.notify();

    try {
      return await fn();
    } catch (err) {
      logWarning(operation, "operation failed", err);
      throw err;
    } finally {
      this.pendingCount = Math.max(0, this.pendingCount - 1);
      if (this.pendingCount === 0) {
        this.activeOperation = null;
      }
      this.notify();
    }
  }
}

export const albedoLoading = new AlbedoLoadingManager();

export async function withAlbedoLoading<T>(
  operation: AlbedoLoadingOperation,
  fn: () => Promise<T>,
  manager: AlbedoLoadingManager = albedoLoading
): Promise<T> {
  return manager.runWithLoading(operation, fn);
}
