"use client";

import { useCallback, useMemo, useState } from "react";
import {
  checkLedgerAvailability,
  checkNetworkMatch,
  signCatchingRejection,
  warnOnMissingLedgerTransport,
  type LedgerAvailabilityState,
  type LedgerNetwork,
  type LedgerSignResult,
  type LedgerToastHandler,
} from "@/app/lib/ledger_usb_bridge";
import LedgerWalletWarningBanner from "./LedgerWalletWarningBanner";

export type LedgerBridgeStatus =
  | "idle"
  | "network-ok"
  | "network-mismatch"
  | "signing"
  | "signed"
  | "rejected"
  | "error"
  | "transport-unavailable";

export interface LedgerUsbBridgeProps {
  walletNetwork: LedgerNetwork;
  appNetwork: LedgerNetwork;
  signTransaction: () => Promise<LedgerSignResult>;
  showToast: LedgerToastHandler;
  onSigned?: (result: LedgerSignResult) => void;
  onNetworkCheck?: (mismatched: boolean) => void;
  /** Optional precomputed availability state; when omitted, detects on render. */
  availability?: LedgerAvailabilityState | null;
  /** Optional detector override (useful in tests). */
  detector?: () => { hasWebUsb: boolean; hasWebHid: boolean };
}

/**
 * UI bridge for Ledger USB wallet actions — transport availability detection,
 * network checks, and signing flows backed by `ledger_usb_bridge` helpers.
 */
export default function LedgerUsbBridge({
  walletNetwork,
  appNetwork,
  signTransaction,
  showToast,
  onSigned,
  onNetworkCheck,
  availability,
  detector,
}: LedgerUsbBridgeProps) {
  const transportState = useMemo<LedgerAvailabilityState>(
    () => availability ?? checkLedgerAvailability(detector),
    [availability, detector]
  );

  const [status, setStatus] = useState<LedgerBridgeStatus>("idle");

  const displayStatus: LedgerBridgeStatus =
    status === "idle" && !transportState.available
      ? "transport-unavailable"
      : status;

  const handleCheckNetwork = useCallback(() => {
    if (!transportState.available) {
      warnOnMissingLedgerTransport(showToast, detector);
      setStatus("transport-unavailable");
      return;
    }
    const state = checkNetworkMatch(walletNetwork, appNetwork);
    onNetworkCheck?.(state.mismatched);
    setStatus(state.mismatched ? "network-mismatch" : "network-ok");
    if (state.mismatched && state.warningMessage) {
      showToast(state.warningMessage, "warning");
    }
  }, [
    walletNetwork,
    appNetwork,
    onNetworkCheck,
    showToast,
    transportState,
    detector,
  ]);

  const handleSign = useCallback(async () => {
    if (!transportState.available) {
      warnOnMissingLedgerTransport(showToast, detector);
      setStatus("transport-unavailable");
      return;
    }
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
  }, [signTransaction, showToast, onSigned, transportState, detector]);

  return (
    <div data-testid="ledger-usb-bridge">
      <LedgerWalletWarningBanner availability={transportState} />
      <button
        type="button"
        onClick={handleCheckNetwork}
        disabled={!transportState.available}
        className="disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Check Ledger network
      </button>
      <button
        type="button"
        onClick={handleSign}
        disabled={!transportState.available}
        className="disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Sign via Ledger
      </button>
      <span data-testid="ledger-usb-bridge-status">{displayStatus}</span>
    </div>
  );
}
