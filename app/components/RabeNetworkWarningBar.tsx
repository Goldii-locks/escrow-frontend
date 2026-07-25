"use client";

import {
  checkRabeNetworkMatch,
  type RabeNetwork,
} from "@/app/lib/rabe_connector";

interface Props {
  walletNetwork: RabeNetwork;
  appNetwork: RabeNetwork;
  className?: string;
}

/**
 * Warning bar rendered by rabe_connector network checks when the connected
 * Rabe wallet chain does not match the app network.
 */
export default function RabeNetworkWarningBar({
  walletNetwork,
  appNetwork,
  className = "",
}: Props) {
  const state = checkRabeNetworkMatch(walletNetwork, appNetwork);

  if (!state.mismatched || !state.warningMessage) {
    return null;
  }

  return (
    <div
      data-testid="rabe-network-warning-bar"
      className={`bg-warning/40 border-b border-warning px-6 py-3 text-warning-soft text-sm text-center ${className}`}
      role="alert"
    >
      {state.warningMessage}
    </div>
  );
}
