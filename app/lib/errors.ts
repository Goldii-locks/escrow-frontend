export class WalletRejectedError extends Error {
  constructor() {
    super("You declined the transaction in your wallet.");
    this.name = "WalletRejectedError";
  }
}

const GAS_FEE_KEYWORDS = [
  "gas",
  "fee",
  "budget",
  "fee budget",
  "budget exceeded",
  "insufficient resource fee",
  "insufficient fee",
  "resource fee",
  "soroban resource",
  "soroban_resources",
  "cpu instruction",
  "cpu_instructions",
  "memory byte",
  "memory_bytes",
  "ledger entry",
  "ledger_entries",
  "resource limit",
  "resource_limit",
  "insufficient balance",
  "insufficient funds",
  "max fee",
  "max_fee",
  "tx fee",
];

export function isGasFeeError(message: string): boolean {
  const lower = message.toLowerCase();
  return GAS_FEE_KEYWORDS.some((kw) => lower.includes(kw));
}

export function formatTxError(err: unknown): string {
  if (err instanceof WalletRejectedError) {
    return err.message;
  }

  if (err instanceof Error) {
    const message = err.message.toLowerCase();

    if (
      message.includes("user declined") ||
      message.includes("user rejected") ||
      message.includes("request rejected") ||
      message.includes("cancelled") ||
      message.includes("canceled")
    ) {
      return "You declined the transaction in your wallet.";
    }

    if (isGasFeeError(message)) {
      if (message.includes("insufficient balance") || message.includes("insufficient funds")) {
        return "Insufficient account balance. Your wallet may not have enough XLM to cover the transaction fees.";
      }
      if (message.includes("budget") || message.includes("soroban") || message.includes("cpu") || message.includes("memory") || message.includes("ledger")) {
        return "Gas estimation error: This transaction exceeds the Soroban resource budget. Try a smaller batch or wait for network conditions to improve.";
      }
      if (message.includes("max fee")) {
        return "Gas estimation error: Network fees are higher than the current max fee setting. Please try again later.";
      }
      return "Gas estimation error: Your transaction might be too expensive. Review the operation and try again.";
    }

    if (message.includes("freighter not found") || message.includes("wallet")) {
      return "Wallet not available. Install Freighter and connect your wallet.";
    }

    if (message.includes("failed to fetch") || message.includes("network")) {
      return "Network error. Check your connection and try again.";
    }

    if (message.includes("unauthorized")) {
      return "You are not authorized to perform this action.";
    }

    if (message.includes("deadline")) {
      return "The auto-release deadline has not passed yet.";
    }

    if (message.includes("invalid amount") || message.includes("invalid_amount")) {
      return "Invalid release amount. Check the value and try again.";
    }

    if (message.includes("invalid status") || message.includes("invalid_status")) {
      return "This action is not available for the current milestone status.";
    }

    if (message.includes("contract") || message.includes("simulation")) {
      return "The contract rejected this transaction. Check the job state and try again.";
    }

    return err.message || "Something went wrong. Please try again.";
  }

  return "Something went wrong. Please try again.";
}
