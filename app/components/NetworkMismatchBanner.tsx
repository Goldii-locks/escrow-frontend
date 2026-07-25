"use client";

/**
 * NetworkMismatchBanner
 *
 * Renders a prominently-styled warning bar when the connected wallet's network
 * does not match the app's configured Stellar network.
 *
 * Issue #156 – Display network mismatch warnings in network_sync_checker.
 */

import ButtonSpinner from "@/app/components/ButtonSpinner";
import {
  APP_NETWORK_NAME,
  buildMismatchMessage,
} from "@/app/lib/network_sync_checker";
import type { NetworkSyncState } from "@/app/hooks/useNetworkSyncChecker";

interface Props {
  /** Sync state produced by useNetworkSyncChecker. */
  syncState: NetworkSyncState;
  /** Human-readable name of the connected wallet (e.g. "Freighter", "Albedo"). */
  walletName: string;
}

/**
 * Renders nothing when the network matches or no check has been performed yet.
 * Shows a spinner while checking and an error/warning banner afterwards.
 */
export default function NetworkMismatchBanner({ syncState, walletName }: Props) {
  const { isChecking, mismatch, result, error } = syncState;

  // While checking: show a subtle checking indicator.
  if (isChecking) {
    return (
      <div
        className="bg-gray-800/60 border-b border-gray-700 px-6 py-2 text-gray-400 text-sm text-center flex items-center justify-center gap-2"
        role="status"
        aria-live="polite"
        aria-label="Checking wallet network"
      >
        <ButtonSpinner className="h-3.5 w-3.5" />
        <span>Checking network…</span>
      </div>
    );
  }

  // If the check itself failed (e.g. wallet not responding).
  if (error) {
    return (
      <div
        className="bg-red-900/30 border-b border-red-700/60 px-6 py-3 text-red-400 text-sm text-center"
        role="alert"
        aria-live="assertive"
      >
        ⚠️ Could not verify wallet network: {error}
      </div>
    );
  }

  // No mismatch or check not yet run.
  if (!mismatch) return null;

  const walletNetworkName = result?.walletNetworkName ?? null;
  const message = buildMismatchMessage(walletName, walletNetworkName, APP_NETWORK_NAME);

  return (
    <div
      className="bg-warning/40 border-b border-warning px-6 py-3 text-warning-soft text-sm text-center"
      role="alert"
      aria-live="assertive"
      data-testid="network-mismatch-banner"
    >
      {message}
    </div>
  );
}
