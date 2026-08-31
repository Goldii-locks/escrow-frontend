/**
 * transaction_signer — Unified transaction signing interface with
 * chain network mismatch detection (#216).
 */

// ---------------------------------------------------------------------------
// Network mismatch checks
// ---------------------------------------------------------------------------

/** Chains the Stellar wallet can be pointed at. */
export type TransactionSignerNetwork = "mainnet" | "testnet";

export interface TransactionSignerNetworkMismatchState {
  mismatched: boolean;
  walletNetwork: TransactionSignerNetwork;
  appNetwork: TransactionSignerNetwork;
  warningMessage: string | null;
}

export class TransactionSignerNetworkMismatchError extends Error {
  constructor(
    public readonly walletNetwork: TransactionSignerNetwork,
    public readonly appNetwork: TransactionSignerNetwork
  ) {
    super(
      `Network mismatch: wallet is on ${walletNetwork}, app expects ${appNetwork}`
    );
    this.name = "TransactionSignerNetworkMismatchError";
  }
}

function capitalizeNetworkName(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Compares the network the wallet is pointed at against the network the app
 * expects and produces a user-facing warning message when they diverge
 * (e.g. Mainnet vs Testnet).
 */
export function checkTransactionSignerNetworkMatch(
  walletNetwork: TransactionSignerNetwork,
  appNetwork: TransactionSignerNetwork
): TransactionSignerNetworkMismatchState {
  const mismatched = walletNetwork !== appNetwork;
  return {
    mismatched,
    walletNetwork,
    appNetwork,
    warningMessage: mismatched
      ? `Network mismatch: your wallet is on ${capitalizeNetworkName(walletNetwork)} but this app uses ${capitalizeNetworkName(appNetwork)}. Switch networks to continue.`
      : null,
  };
}

/**
 * Runs a network match check and, on mismatch, logs a warning to the console
 * via the shared transaction_signer debug conventions.
 */
export function warnOnTransactionSignerNetworkMismatch(
  walletNetwork: TransactionSignerNetwork,
  appNetwork: TransactionSignerNetwork
): TransactionSignerNetworkMismatchState {
  const state = checkTransactionSignerNetworkMatch(walletNetwork, appNetwork);
  if (state.mismatched && state.warningMessage) {
    console.warn(`[transaction_signer] ${state.warningMessage}`);
  }
  return state;
}
