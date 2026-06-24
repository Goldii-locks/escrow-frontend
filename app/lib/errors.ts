export class WalletRejectedError extends Error {
  constructor() {
    super("You declined the transaction in your wallet.");
    this.name = "WalletRejectedError";
  }
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
