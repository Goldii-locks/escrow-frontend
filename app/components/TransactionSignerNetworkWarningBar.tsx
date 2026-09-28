"use client";

import {
  checkTransactionSignerNetworkMatch,
  type TransactionSignerNetwork,
} from "@/app/lib/transaction_signer";

interface Props {
  walletNetwork: TransactionSignerNetwork;
  appNetwork: TransactionSignerNetwork;
  className?: string;
}

/**
 * Warning bar rendered by transaction_signer network checks when the
 * connected wallet chain does not match the app network.
 */
export default function TransactionSignerNetworkWarningBar({
  walletNetwork,
  appNetwork,
  className = "",
}: Props) {
  const state = checkTransactionSignerNetworkMatch(walletNetwork, appNetwork);

  if (!state.mismatched || !state.warningMessage) {
    return null;
  }

  return (
    <div
      data-testid="transaction-signer-network-warning-bar"
      className={`bg-warning/40 border-b border-warning px-6 py-3 text-warning-soft text-sm text-center ${className}`}
      role="alert"
    >
      {state.warningMessage}
    </div>
  );
}
