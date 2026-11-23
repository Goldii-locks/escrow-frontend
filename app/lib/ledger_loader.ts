/** Shared Ledger operation loader state, kept free of SDK imports (#850). */

let activeOperationsCount = 0;
const listeners = new Set<(isLoading: boolean) => void>();

export function isLedgerLoading(): boolean {
  return activeOperationsCount > 0;
}

export function subscribeToLedgerLoading(
  listener: (isLoading: boolean) => void
): () => void {
  listeners.add(listener);
  listener(activeOperationsCount > 0);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(): void {
  const loading = activeOperationsCount > 0;
  listeners.forEach((listener) => listener(loading));
}

export function startLedgerOperation(): void {
  activeOperationsCount++;
  notifyListeners();
}

export function endLedgerOperation(): void {
  activeOperationsCount = Math.max(0, activeOperationsCount - 1);
  notifyListeners();
}

export function resetLedgerOperations(): void {
  activeOperationsCount = 0;
  notifyListeners();
}
