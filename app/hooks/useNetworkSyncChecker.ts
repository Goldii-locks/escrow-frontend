"use client";

/**
 * useNetworkSyncChecker
 *
 * Hook for the network_sync_checker module.
 * Checks whether the connected wallet's network matches the app's configured
 * Stellar network and exposes the result along with a loading state and a
 * manual re-check trigger.
 *
 * Issues addressed:
 *   #156 – network mismatch warnings
 *   #158 – loading spinner state during network_sync_checker calls
 */

import { useCallback, useEffect, useState } from "react";
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import {
  NetworkCheckResult,
  runNetworkCheck,
} from "@/app/lib/network_sync_checker";

export interface NetworkSyncState {
  /** True while a network check is in flight. */
  isChecking: boolean;
  /** True when a mismatch has been confirmed. */
  mismatch: boolean;
  /** Full result of the last successful check, or null if never checked. */
  result: NetworkCheckResult | null;
  /** Error message if the last check threw, otherwise null. */
  error: string | null;
}

const DEFAULT_STATE: NetworkSyncState = {
  isChecking: false,
  mismatch: false,
  result: null,
  error: null,
};

/**
 * Checks the wallet network and keeps the state in sync.
 *
 * @param address  The currently connected wallet address (or null when disconnected).
 *                 Passing null skips the check and resets state to the default.
 */
export function useNetworkSyncChecker(address: string | null): NetworkSyncState & {
  recheck: () => void;
} {
  const [state, setState] = useState<NetworkSyncState>(DEFAULT_STATE);
  // Increment to force a re-check when recheck() is called manually.
  const [checkTrigger, setCheckTrigger] = useState(0);

  // Re-run whenever the connected address or the manual trigger changes.
  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      if (!address) {
        setState(DEFAULT_STATE);
        return;
      }

      // Issue #158: set isChecking = true to drive spinner UI.
      setState((prev) => ({ ...prev, isChecking: true, error: null }));

      try {
        const result = await runNetworkCheck(() => StellarWalletsKit.getNetwork());
        if (controller.signal.aborted) return;
        setState({
          isChecking: false,
          mismatch: result.mismatch,
          result,
          error: null,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({
          isChecking: false,
          mismatch: false,
          result: null,
          error: err instanceof Error ? err.message : "Network check failed.",
        });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [address, checkTrigger]);

  const recheck = useCallback(() => {
    setCheckTrigger((t) => t + 1);
  }, []);

  return { ...state, recheck };
}
