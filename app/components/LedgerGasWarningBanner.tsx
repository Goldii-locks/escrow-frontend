"use client";

import {
  checkSimulationFeeWarning,
  type LedgerSimulationResult,
} from "@/app/lib/ledger_usb_bridge";

interface Props {
  simulation: LedgerSimulationResult | null;
  className?: string;
}

/**
 * Displays a warning banner when a Ledger gas/fee estimation result
 * exceeds standard bounds or contains a simulation error.
 */
export default function LedgerGasWarningBanner({
  simulation,
  className = "",
}: Props) {
  if (!simulation) return null;

  const state = checkSimulationFeeWarning(simulation);

  if (!state.hasWarning || !state.warningMessage) {
    return null;
  }

  return (
    <div
      data-testid="ledger-gas-warning-banner"
      role="alert"
      className={`bg-warning/40 border border-warning px-4 py-3 rounded-lg text-warning-soft text-sm ${className}`}
    >
      {state.warningMessage}
    </div>
  );
}
