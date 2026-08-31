"use client";

import {
  checkDisconnectSimulationFeeWarning,
  type WalletDisconnectSimulationResult,
} from "@/app/lib/wallet_disconnect_handler";

interface Props {
  /** Latest simulation result; `null` while no estimation has run. */
  simulation: WalletDisconnectSimulationResult | null;
  className?: string;
}

/**
 * Displays a warning banner when a wallet_disconnect_handler fee estimation
 * exceeds standard bounds or the simulation itself reported an error.
 */
export default function WalletDisconnectGasWarningBanner({
  simulation,
  className = "",
}: Props) {
  const state = checkDisconnectSimulationFeeWarning(simulation);

  if (!state.hasWarning || !state.warningMessage) {
    return null;
  }

  return (
    <div
      data-testid="wallet-disconnect-gas-warning-banner"
      data-high-fee={state.highFee}
      data-simulation-error={state.simulationError}
      role="alert"
      className={`bg-warning/40 border border-warning px-4 py-3 rounded-lg text-warning-soft text-sm ${className}`}
    >
      {state.warningMessage}
    </div>
  );
}
