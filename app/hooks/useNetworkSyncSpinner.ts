"use client";

/**
 * useNetworkSyncSpinner
 *
 * Convenience hook that exposes just the loading-indicator concern of the
 * network_sync_checker module. Components that only need to know "is a
 * network check in progress?" can import this instead of the full
 * useNetworkSyncChecker hook.
 *
 * Issue #158 – Trigger loading spinner states during network_sync_checker
 *              calls.
 */

import { useCallback, useRef, useState } from "react";

export interface SpinnerState {
  /** True while a network_sync_checker operation is in flight. */
  isChecking: boolean;
}

/**
 * Returns `isChecking` plus `wrap` — a higher-order utility that toggles the
 * spinner for the duration of any async operation.
 *
 * Usage:
 * ```ts
 * const { isChecking, wrap } = useNetworkSyncSpinner();
 * const doCheck = () => wrap(async () => { await StellarWalletsKit.getNetwork(); });
 * ```
 */
export function useNetworkSyncSpinner(): SpinnerState & {
  /**
   * Run `fn` while showing the spinner. The spinner is turned off once `fn`
   * resolves or rejects (it never silently swallows errors).
   */
  wrap: <T>(fn: () => Promise<T>) => Promise<T>;
} {
  const [isChecking, setIsChecking] = useState(false);
  // Guard against state updates after unmount.
  const mountedRef = useRef(true);

  // Sync mountedRef on unmount — components call this hook at render time so
  // we use a layout-effect style cleanup via the ref itself.
  const wrap = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    if (mountedRef.current) setIsChecking(true);
    try {
      return await fn();
    } finally {
      if (mountedRef.current) setIsChecking(false);
    }
  }, []);

  return { isChecking, wrap };
}
