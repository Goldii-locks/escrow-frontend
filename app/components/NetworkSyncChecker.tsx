"use client";

import { useCallback, useState } from "react";
import {
  checkNetworkSync,
  checkWalletAvailability,
  runNetworkSyncSign,
  type SyncNetwork,
  type SyncToastHandler,
  type WalletAvailabilityState,
} from "@/app/lib/network_sync_checker";
import NetworkSyncNetworkWarningBar from "./NetworkSyncNetworkWarningBar";
import NetworkSyncWalletWarningBanner from "./NetworkSyncWalletWarningBanner";

export type NetworkSyncProbeStatus =
  | "idle"
  | "checking"
  | "synced"
  | "cancelled"
  | "blocked"
  | "error";

export interface NetworkSyncCheckerProps {
  walletNetwork: SyncNetwork;
  appNetwork: SyncNetwork;
  /** Signature probe run when networks align and a wallet is available. */
  onSign?: (() => Promise<string>) | null;
  showToast?: SyncToastHandler;
  /** Optional precomputed availability; when omitted the component detects on probe. */
  availability?: WalletAvailabilityState | null;
  /** Optional detector override (useful in tests). */
  detector?: () => boolean;
  className?: string;
}

/**
 * Interactive network sync probe backed by network_sync_checker. Renders a
 * trigger action that validates network alignment, wallet availability and a
 * wallet signature probe, exposing each outcome for user feedback.
 */
export default function NetworkSyncChecker({
  walletNetwork,
  appNetwork,
  onSign,
  showToast,
  availability,
  detector,
  className = "",
}: NetworkSyncCheckerProps) {
  const [status, setStatus] = useState<NetworkSyncProbeStatus>("idle");

  const runProbe = useCallback(async () => {
    setStatus("checking");

    const networkState = checkNetworkSync(walletNetwork, appNetwork);
    if (!networkState.synced) {
      if (showToast && networkState.warningMessage) {
        showToast(networkState.warningMessage, "warning");
      }
      setStatus("blocked");
      return;
    }

    const availabilityState = availability ?? checkWalletAvailability(detector);
    if (!availabilityState.available || typeof onSign !== "function") {
      if (showToast && availabilityState.warningMessage) {
        showToast(availabilityState.warningMessage, "warning");
      }
      setStatus("blocked");
      return;
    }

    try {
      const result = await runNetworkSyncSign(onSign, showToast ?? (() => {}));
      if (result === null) {
        setStatus("cancelled");
        return;
      }
      setStatus("synced");
    } catch {
      setStatus("error");
    }
  }, [appNetwork, availability, detector, onSign, showToast, walletNetwork]);

  const isChecking = status === "checking";

  return (
    <section
      data-testid="network-sync-checker"
      className={`text-sm text-text-primary ${className}`}
    >
      <NetworkSyncNetworkWarningBar
        walletNetwork={walletNetwork}
        appNetwork={appNetwork}
      />
      <NetworkSyncWalletWarningBanner
        availability={availability}
        detector={detector}
      />

      <div className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3">
        <output
          data-testid="network-sync-probe-status"
          data-status={status}
          role="status"
          className="font-medium"
        >
          {status === "idle" && "Network sync check idle"}
          {status === "checking" && "Checking network sync…"}
          {status === "synced" && "Networks in sync — signature accepted"}
          {status === "cancelled" &&
            "Network sync cancelled — you rejected the signature in your wallet."}
          {status === "blocked" &&
            "Network sync blocked — resolve the warning below and try again."}
          {status === "error" &&
            "Network sync probe failed. Check the wallet and try again."}
        </output>

        <button
          type="button"
          data-testid="network-sync-probe-button"
          onClick={() => {
            void runProbe();
          }}
          disabled={isChecking}
          className="rounded bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isChecking ? "Checking…" : "Run network sync probe"}
        </button>
      </div>
    </section>
  );
}