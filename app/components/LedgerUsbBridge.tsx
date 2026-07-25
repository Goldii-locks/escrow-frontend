"use client";

import { useCallback, useState } from "react";
import {
  checkNetworkMatch,
  signCatchingRejection,
  type LedgerNetwork,
  type LedgerSignResult,
  type LedgerToastHandler,
} from "@/app/lib/ledger_usb_bridge";

export type LedgerBridgeStatus =
  | "idle"
  | "network-ok"
  | "network-mismatch"
  | "signing"
  | "signed"
  | "rejected"
  | "error";

export interface LedgerUsbBridgeProps {
  walletNetwork: LedgerNetwork;
  appNetwork: LedgerNetwork;
  signTransaction: () => Promise<LedgerSignResult>;
  showToast: LedgerToastHandler;
  onSigned?: (result: LedgerSignResult) => void;
  onNetworkCheck?: (mismatched: boolean) => void;
}

/**
 * UI bridge for Ledger USB wallet actions — network checks and signing flows
 * backed by `ledger_usb_bridge` helpers.
 */
export default function LedgerUsbBridge({
  walletNetwork,
  appNetwork,
  signTransaction,
  showToast,
  onSigned,
  onNetworkCheck,
}: LedgerUsbBridgeProps) {
  const [status, setStatus] = useState<LedgerBridgeStatus>("idle");

  const handleCheckNetwork = useCallback(() => {
    const state = checkNetworkMatch(walletNetwork, appNetwork);
    onNetworkCheck?.(state.mismatched);
    setStatus(state.mismatched ? "network-mismatch" : "network-ok");
    if (state.mismatched && state.warningMessage) {
      showToast(state.warningMessage, "warning");
    }
  }, [walletNetwork, appNetwork, onNetworkCheck, showToast]);

  const handleSign = useCallback(async () => {
    setStatus("signing");
    try {
      const result = await signCatchingRejection(signTransaction, showToast);
      if (result) {
        onSigned?.(result);
        setStatus("signed");
      } else {
        setStatus("rejected");
      }
    } catch (err) {
      setStatus("error");
      const message =
        err instanceof Error ? err.message : "Ledger signing failed.";
      showToast(message, "error");
    }
  }, [signTransaction, showToast, onSigned]);

  return (
    <div data-testid="ledger-usb-bridge">
      <button type="button" onClick={handleCheckNetwork}>
        Check Ledger network
      </button>
      <button type="button" onClick={handleSign}>
        Sign via Ledger
      </button>
      <span data-testid="ledger-usb-bridge-status">{status}</span>
    </div>
  );
}
