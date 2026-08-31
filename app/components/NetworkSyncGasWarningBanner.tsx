"use client";

import {
  checkSimulationFeeWarning,
  type NetworkSyncSimulationResult,
} from "@/app/lib/network_sync_checker";

interface Props {
  simulation: NetworkSyncSimulationResult | null;
  className?: string;
}

/**
 * Displays a warning banner when a network sync gas/fee estimation result
 * exceeds standard bounds or contains a simulation error.
 *
 * Renders nothing when `simulation` is null or when no warning applies.
 */
export default function NetworkSyncGasWarningBanner({
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
      data-testid="network-sync-gas-warning-banner"
      role="alert"
      className={`bg-warning/40 border border-warning px-4 py-3 rounded-lg text-warning-soft text-sm ${className}`}
    >
      {state.warningMessage}
    </div>
  );
}
