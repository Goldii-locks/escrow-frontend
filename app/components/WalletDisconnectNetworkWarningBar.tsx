"use client";

import { checkDisconnectNetworkMatch } from "@/app/lib/wallet_disconnect_handler";

interface Props {
  /** Network reported by the connected wallet (label or passphrase). */
  walletNetwork: string | null | undefined;
  /** Network this app is configured for (label or passphrase). */
  appNetwork: string | null | undefined;
  className?: string;
}

/**
 * Warning bar rendered by wallet_disconnect_handler network checks when the
 * connected wallet's chain does not match the app network (e.g. the wallet
 * is on Mainnet while the app runs against Testnet).
 */
export default function WalletDisconnectNetworkWarningBar({
  walletNetwork,
  appNetwork,
  className = "",
}: Props) {
  const state = checkDisconnectNetworkMatch(walletNetwork, appNetwork);

  if (!state.mismatched || !state.warningMessage) {
    return null;
  }

  return (
    <div
      data-testid="wallet-disconnect-network-warning-bar"
      data-unknown-network={state.unknownNetwork}
      role="alert"
      className={`bg-warning/40 border-b border-warning px-6 py-3 text-warning-soft text-sm text-center ${className}`}
    >
      {state.warningMessage}
    </div>
  );
}
