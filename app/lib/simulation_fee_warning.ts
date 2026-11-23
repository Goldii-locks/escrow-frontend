/** Simulation / fee estimation result as returned by Soroban RPC. */
export interface LedgerSimulationResult {
  /** Estimated fee in stroops (1 XLM = 10_000_000 stroops). */
  fee: number;
  /** Optional error string from the simulation response. */
  error?: string;
  /** Raw simulation error object when the RPC reports a failure. */
  simulationError?: unknown;
}

export interface LedgerGasWarningState {
  hasWarning: boolean;
  highFee: boolean;
  simulationError: boolean;
  warningMessage: string | null;
}

/**
 * Fee ceiling above which a high-fee warning is emitted.
 * 1_000_000 stroops = 0.1 XLM.
 */
export const HIGH_FEE_THRESHOLD_STROOPS = 1_000_000;

/**
 * Inspects a simulation result and produces a user-facing warning state
 * when fee limits exceed standard bounds or the simulation reported an error.
 */
export function checkSimulationFeeWarning(
  result: LedgerSimulationResult
): LedgerGasWarningState {
  if (result.error || result.simulationError) {
    const message =
      typeof result.error === "string" && result.error
        ? `Transaction simulation failed: ${result.error}`
        : "Transaction simulation failed. The contract may have rejected this operation.";

    return {
      hasWarning: true,
      highFee: false,
      simulationError: true,
      warningMessage: message,
    };
  }

  if (result.fee > HIGH_FEE_THRESHOLD_STROOPS) {
    const xlm = (result.fee / 10_000_000).toFixed(7);
    return {
      hasWarning: true,
      highFee: true,
      simulationError: false,
      warningMessage: `Estimated fee is unusually high (${result.fee} stroops / ${xlm} XLM). Review before signing.`,
    };
  }

  return {
    hasWarning: false,
    highFee: false,
    simulationError: false,
    warningMessage: null,
  };
}
