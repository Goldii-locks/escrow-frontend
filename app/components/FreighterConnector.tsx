"use client";

import { useCallback, useState } from "react";
import {
  logFreighterWarning,
  warnOnSimulationFee,
  freighterTracker,
  type FreighterSimulationResult,
} from "@/app/lib/freighter_connector";
import { useToast } from "@/app/context/ToastContext";
import FreighterGasWarningBanner from "@/app/components/FreighterGasWarningBanner";
import GasEstimationWarningBanner from "@/app/components/GasEstimationWarningBanner";

export type FreighterConnectorStatus =
  | "idle"
  | "simulating"
  | "simulation-warning"
  | "simulation-error"
  | "signing"
  | "signed"
  | "rejected"
  | "error";

export interface FreighterConnectorProps {
  /** Called with the simulation result; return value populates the banner. */
  simulate: () => Promise<FreighterSimulationResult>;
  /** Called to sign the transaction XDR after simulation passes. */
  signTransaction: () => Promise<string>;
  onSigned?: (signedXdr: string) => void;
  onSimulated?: (result: FreighterSimulationResult) => void;
  txId?: string;
}

/**
 * UI bridge for Freighter wallet actions — simulation / fee estimation and
 * the signing flow, backed by `freighter_connector` helpers.
 */
export default function FreighterConnector({
  simulate,
  signTransaction,
  onSigned,
  onSimulated,
  txId = "freighter-tx",
}: FreighterConnectorProps) {
  const [status, setStatus] = useState<FreighterConnectorStatus>("idle");
  const [simulation, setSimulation] =
    useState<FreighterSimulationResult | null>(null);
  const { showToast } = useToast();

  const handleSimulate = useCallback(async () => {
    setStatus("simulating");
    setSimulation(null);

    try {
      const result = await simulate();
      setSimulation(result);
      onSimulated?.(result);

      const warning = warnOnSimulationFee(result, { txId });
      if (warning.simulationError) {
        setStatus("simulation-error");
      } else if (warning.highFee) {
        setStatus("simulation-warning");
      } else {
        setStatus("idle");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Simulation failed.";
      logFreighterWarning("SIMULATE ERROR", message, {
        err,
        txId,
        phase: "simulating",
      });
      setStatus("error");
    }
  }, [simulate, onSimulated, txId]);

  const handleSign = useCallback(async () => {
    setStatus("signing");

    try {
      const signedXdr = await signTransaction();
      if (signedXdr) {
        freighterTracker.track(txId, "signing", "Freighter wallet signed");
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

      logFreighterWarning(
        isRejection ? "SIGNATURE REJECTED" : "SIGN ERROR",
        message,
        { err, txId, phase: "signing" }
      );

      if (isRejection) {
        showToast(
          "Signature cancelled — you rejected the request in your wallet.",
          "warning"
        );
      }

      setStatus(isRejection ? "rejected" : "error");
    }
  }, [signTransaction, onSigned, showToast, txId]);

  return (
    <div data-testid="freighter-connector">
      <button type="button" onClick={handleSimulate}>
        Estimate fees
      </button>
      <button type="button" onClick={handleSign}>
        Sign via Freighter
      </button>
      <span data-testid="freighter-connector-status">{status}</span>
      <FreighterGasWarningBanner simulation={simulation} />
      <GasEstimationWarningBanner />
    </div>
  );
}
