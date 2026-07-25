"use client";

import {
  checkNetworkMatch,
  type LedgerNetwork,
} from "@/app/lib/ledger_usb_bridge";

interface Props {
  walletNetwork: LedgerNetwork;
  appNetwork: LedgerNetwork;
  className?: string;
}

/**
 * Warning bar rendered by ledger_usb_bridge network checks when the
 * connected Ledger chain does not match the app network.
 */
export default function LedgerNetworkWarningBar({
  walletNetwork,
  appNetwork,
  className = "",
}: Props) {
  const state = checkNetworkMatch(walletNetwork, appNetwork);

  if (!state.mismatched || !state.warningMessage) {
    return null;
  }

  return (
    <div
      data-testid="ledger-network-warning-bar"
      className={`bg-warning/40 border-b border-warning px-6 py-3 text-warning-soft text-sm text-center ${className}`}
      role="alert"
    >
      {state.warningMessage}
    </div>
  );
}
