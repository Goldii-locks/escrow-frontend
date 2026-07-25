/**
 * network_sync_checker_cache
 *
 * Persistent caching for the network_sync_checker module.
 *
 * Stores the active wallet address and wallet-id in localStorage so they
 * survive page reloads. The cache is intentionally limited to these two
 * fields — no private keys or sensitive secrets are ever stored.
 *
 * Issue #157 – Implement secure persistent caching for active keys in
 *              network_sync_checker.
 */

export const ACTIVE_SESSION_KEY = "nsc_active_session";

export interface ActiveSession {
  /** Stellar public key (G… address) of the connected wallet. */
  address: string;
  /** Identifier of the wallet provider (e.g. "freighter", "albedo"). */
  walletId: string;
  /** Unix timestamp (ms) when the session was last persisted. */
  savedAt: number;
}

/**
 * Persist the active wallet session to localStorage.
 * Call this after a successful wallet connection.
 */
export function saveActiveSession(address: string, walletId: string): void {
  try {
    const session: ActiveSession = { address, walletId, savedAt: Date.now() };
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
  } catch {
    // localStorage may be unavailable in some SSR / private-browsing contexts.
  }
}

/**
 * Read the persisted active session from localStorage.
 * Returns `null` when nothing is stored or the stored value is malformed.
 */
export function loadActiveSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isValidSession(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Remove the persisted session from localStorage.
 * Call this when the user explicitly disconnects.
 */
export function clearActiveSession(): void {
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    // Ignore storage errors during cleanup.
  }
}

/** Type-guard to validate the shape of a stored session object. */
function isValidSession(value: unknown): value is ActiveSession {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.address === "string" &&
    obj.address.length > 0 &&
    typeof obj.walletId === "string" &&
    obj.walletId.length > 0 &&
    typeof obj.savedAt === "number"
  );
}
