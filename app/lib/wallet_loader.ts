/**
 * wallet_loader — loader-overlay listener pair for wallet operations.
 *
 * Extracted from `wallet_state_context.ts`. Re-exported from that module for
 * backwards compatibility.
 *
 * Call `withWalletLoader` to wrap any async wallet operation so the global
 * loading overlay is raised while it runs. Subscribe with
 * `subscribeToWalletLoading` to react to loading state changes.
 */

let activeOperationsCount = 0;
const loaderListeners = new Set<(isLoading: boolean) => void>();

export function isWalletLoading(): boolean {
  return activeOperationsCount > 0;
}

export function subscribeToWalletLoading(listener: (isLoading: boolean) => void): () => void {
  loaderListeners.add(listener);
  listener(activeOperationsCount > 0);
  return () => {
    loaderListeners.delete(listener);
  };
}

function notifyWalletLoaderListeners(): void {
  const loading = activeOperationsCount > 0;
  loaderListeners.forEach((l) => l(loading));
}

export function startWalletOperation(): void {
  activeOperationsCount++;
  notifyWalletLoaderListeners();
}

export function endWalletOperation(): void {
  activeOperationsCount = Math.max(0, activeOperationsCount - 1);
  notifyWalletLoaderListeners();
}

/**
 * Executes an async wallet operation wrapped in the loading overlay
 * lifecycle. Uses a try/finally pattern so the loader clears even on error.
 */
export async function withWalletLoader<T>(fn: () => Promise<T>): Promise<T> {
  startWalletOperation();
  try {
    return await fn();
  } finally {
    endWalletOperation();
  }
}
