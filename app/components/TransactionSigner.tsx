"use client";

import { useCallback, useState } from "react";
import {
  checkTransactionSignerNetworkMatch,
  warnOnTransactionSignerNetworkMismatch,
  type TransactionSignerNetwork,
} from "@/app/lib/transaction_signer";
import TransactionSignerNetworkWarningBar from "@/app/components/TransactionSignerNetworkWarningBar";

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
  children,
}: TransactionSignerProps) {
  const [status, setStatus] = useState<TransactionSignerStatus>("idle");

  const networkState = checkTransactionSignerNetworkMatch(
    walletNetwork,
    appNetwork
  );

  const handleSign = useCallback(async () => {
    if (networkState.mismatched) {
      warnOnTransactionSignerNetworkMismatch(walletNetwork, appNetwork);
      return;
    }

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
    walletNetwork,
    appNetwork,
    signTransaction,
    onSigned,
  ]);

  return (
    <div data-testid="transaction-signer">
      <TransactionSignerNetworkWarningBar
        walletNetwork={walletNetwork}
        appNetwork={appNetwork}
      />
      {children}
      <button
        type="button"
        onClick={handleSign}
        disabled={networkState.mismatched}
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
