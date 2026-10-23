"use client";

import { checkNetworkSync, type SyncNetwork } from "@/app/lib/network_sync_checker";

interface Props {
  walletNetwork: SyncNetwork;
  appNetwork: SyncNetwork;
  className?: string;
}

/**
 * Warning bar rendered by network_sync_checker when the
 * connected wallet chain does not match the app network.
 */
export default function NetworkSyncNetworkWarningBar({
  walletNetwork,
  appNetwork,
  className = "",
}: Props) {
  const state = checkNetworkSync(walletNetwork, appNetwork);

  if (state.synced || !state.warningMessage) {
    return null;
  }

  return (
    <div
      data-testid="network-sync-network-warning-bar"
      className={`bg-warning/40 border-b border-warning px-6 py-3 text-warning-soft text-sm text-center ${className}`}
      role="alert"
    >
      {state.warningMessage}
    </div>
  );
}
