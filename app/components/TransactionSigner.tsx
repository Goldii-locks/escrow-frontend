"use client";

import { useCallback, useState } from "react";
import {
  checkTransactionSignerNetworkMatch,
  warnOnTransactionSignerNetworkMismatch,
  type TransactionSignerNetwork,
} from "@/app/lib/transaction_signer";
import {
  checkFreighterAvailability,
  type FreighterAvailabilityState,
} from "@/app/lib/freighter_connector";
import TransactionSignerNetworkWarningBar from "@/app/components/TransactionSignerNetworkWarningBar";
import FreighterWalletWarningBanner from "@/app/components/FreighterWalletWarningBanner";

export type TransactionSignerStatus =
  | "idle"
  | "signing"
  | "signed"
  | "rejected"
  | "error";

export interface TransactionSignerProps {
  /** The wallet's current network. */
  walletNetwork: TransactionSignerNetwork;
  /** The network the app expects. */
  appNetwork: TransactionSignerNetwork;
  /** Called to sign the transaction XDR. */
  signTransaction: () => Promise<string>;
  /** Called with the signed XDR after a successful signing. */
  onSigned?: (signedXdr: string) => void;
  /** Optional transaction identifier for logging. */
  txId?: string;
  /** Precomputed wallet availability, useful when the parent already checked. */
  walletAvailability?: FreighterAvailabilityState;
  children?: React.ReactNode;
}

/**
 * Unified transaction signing interface with integrated chain network
 * mismatch detection. Displays a warning bar when the wallet network
 * does not match the app network, and manages the signing lifecycle.
 */
export default function TransactionSigner({
  walletNetwork,
  appNetwork,
  signTransaction,
  onSigned,
  txId = "tx-signer",
  walletAvailability: suppliedWalletAvailability,
  children,
}: TransactionSignerProps) {
  const [status, setStatus] = useState<TransactionSignerStatus>("idle");
  const walletAvailability =
    suppliedWalletAvailability ?? checkFreighterAvailability();

  const networkState = checkTransactionSignerNetworkMatch(
    walletNetwork,
    appNetwork
  );

  const handleSign = useCallback(async () => {
    if (networkState.mismatched) {
      warnOnTransactionSignerNetworkMismatch(walletNetwork, appNetwork);
      return;
    }
    if (!walletAvailability.available) return;

    setStatus("signing");

    try {
      const signedXdr = await signTransaction();
      if (signedXdr) {
        onSigned?.(signedXdr);
        setStatus("signed");
      } else {
        setStatus("rejected");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Signing failed.";
      const lc = message.toLowerCase();
      const isRejection =
        lc.includes("user rejected") ||
        lc.includes("user declined") ||
        lc.includes("request rejected") ||
        lc.includes("cancelled") ||
        lc.includes("canceled");

      console.warn(
        `[transaction_signer] ${isRejection ? "SIGNATURE REJECTED" : "SIGN ERROR"}: ${message}`
      );

      setStatus(isRejection ? "rejected" : "error");
    }
  }, [
    networkState.mismatched,
    walletAvailability.available,
    walletNetwork,
    appNetwork,
    signTransaction,
    onSigned,
  ]);

  return (
    <div data-testid="transaction-signer">
      <FreighterWalletWarningBanner availability={walletAvailability} />
      <TransactionSignerNetworkWarningBar
        walletNetwork={walletNetwork}
        appNetwork={appNetwork}
      />
      {children}
      <button
        type="button"
        onClick={handleSign}
        disabled={networkState.mismatched || !walletAvailability.available}
        data-testid="transaction-signer-sign-button"
      >
        Sign Transaction
      </button>
      <span data-testid="transaction-signer-status">{status}</span>
      {txId && (
        <span data-testid="transaction-signer-tx-id" className="hidden">
          {txId}
        </span>
      )}
    </div>
  );
}
