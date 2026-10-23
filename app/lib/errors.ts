import { reportClientError } from "@/app/lib/errorReporter";

/**
 * User-facing messages for the escrow contract's `Error` enum
 * (`escrow-contract/contracts/milestone-escrow/src/lib.rs`), keyed by code.
 * Keep in step with the enum: the backend reports a revert as
 * "Contract execution reverted (error code N)".
 */
export const ERROR_MESSAGES: Record<number, string> = {
  1: "This escrow has already been initialized.",
  2: "This escrow hasn't been initialized yet.",
  3: "This escrow has already been funded.",
  4: "This escrow hasn't been funded yet. Fund the escrow before proceeding.",
  5: "You are not authorized to perform this action.",
  6: "That milestone doesn't exist on this escrow.",
  7: "This action is not available for the current milestone status.",
  8: "This token is not on the escrow's whitelist.",
  9: "This token is already whitelisted.",
  10: "Invalid amount. Check the value and try again.",
  11: "The auto-release deadline has not passed yet. Please wait until it does.",
  12: "One of the addresses is invalid. Check it and try again.",
  13: "This escrow is paused. No actions can be taken until it is unpaused.",
  14: "The split ratio is invalid. Check the percentages and try again.",
  15: "That deadline extension isn't allowed.",
  16: "This escrow is locked and cannot be modified.",
  17: "This multisig has no signers configured.",
  18: "Too many multisig signers.",
  19: "The multisig threshold is invalid.",
  20: "The multisig has a duplicate signer.",
  21: "An admin transfer is already pending.",
  22: "There is no pending admin transfer.",
  23: "Not enough multisig approvals yet.",
  24: "A dispute is already being raised for this milestone.",
  25: "There is no balance to pay out.",
  26: "Tax withholding is in progress. Try again in a moment.",
  27: "A platform fee allocation is in progress. Try again in a moment.",
  28: "An emergency pause change is in progress. Try again in a moment.",
  29: "This escrow is already paused.",
  30: "This escrow is not paused.",
  31: "The allocation weights are invalid.",
  32: "The escrow holds no balance to settle.",
  33: "A deadline extension is in progress. Try again in a moment.",
  34: "A payment stream update is in progress. Try again in a moment.",
  35: "The fee is higher than the contract allows.",
  36: "The amount is too large to process.",
  37: "The escrow balance is too low for this action.",
};

export class WalletRejectedError extends Error {
  constructor() {
    super("You declined the transaction in your wallet.");
    this.name = "WalletRejectedError";
  }
}

// =============================================================================
// Per-wallet availability error (#687)
// =============================================================================

/** Metadata for each supported wallet. */
interface WalletInfo {
  label: string;
  installUrl: string;
}

const WALLET_INFO: Record<string, WalletInfo> = {
  freighter: {
    label: "Freighter",
    installUrl: "https://www.freighter.app/",
  },
  albedo: {
    label: "Albedo",
    installUrl: "https://albedo.link/",
  },
  xbull: {
    label: "xBull",
    installUrl: "https://xbull.app/",
  },
  hana: {
    label: "Hana",
    installUrl: "https://hanastellar.com/",
  },
  lobstr: {
    label: "LOBSTR",
    installUrl: "https://lobstr.co/",
  },
};

/**
 * Thrown when the selected wallet extension is missing or locked.
 *
 * Carrying the `walletId` allows {@link formatTxError} to produce a
 * wallet-specific install link instead of always naming Freighter.
 */
export class WalletUnavailableError extends Error {
  readonly walletId: string;

  constructor(walletId: string) {
    const info = WALLET_INFO[walletId.toLowerCase()];
    const label = info?.label ?? walletId;
    super(`${label} isn't available. Make sure the extension is installed and unlocked.`);
    this.name = "WalletUnavailableError";
    this.walletId = walletId.toLowerCase();
  }
}

/**
 * Detects whether an error was thrown by the wallet layer (user rejected the
 * signing prompt). Deliberately does NOT match backend error messages such as
 * "contract execution cancelled" — those are not wallet rejections.
 *
 * Only match phrases that wallet extensions (Freighter, Albedo, xBull, Hana)
 * actually emit when the user clicks "Reject" / "Cancel" in the extension UI.
 */
export function isWalletRejectedError(err: unknown): boolean {
  if (err instanceof WalletRejectedError) {
    return true;
  }

  if (!(err instanceof Error)) {
    return false;
  }

  const message = err.message.toLowerCase();

  // Only match explicit wallet-layer rejection phrases.
  // "cancelled" alone is intentionally excluded — backend messages can
  // contain that word ("contract execution cancelled", etc.).
  return (
    message.includes("user declined") ||
    message.includes("user rejected") ||
    message.includes("request rejected") ||
    message.includes("denied by the user") ||
    message.includes("user cancelled") ||
    message.includes("user canceled")
  );
}

export function isWalletAvailabilityError(err: unknown): boolean {
  if (err instanceof WalletUnavailableError) {
    return true;
  }

  if (!(err instanceof Error)) {
    return false;
  }

  const message = err.message.toLowerCase();
  return (
    message.includes("freighter not found") ||
    message.includes("wallet not found") ||
    message.includes("wallet extension") ||
    message.includes("extension not installed") ||
    message.includes("no wallet") ||
    message.includes("wallet unavailable") ||
    message.includes("isn't available")
  );
}

/**
 * True when `err` is the single wallet-signature timeout error type
 * (#628). Both the legacy `TxSignatureTimeoutError` and the current
 * `WalletSignatureTimeoutError` are recognised so callers can branch on
 * either name without depending on which one fired.
 */
export function isSignatureTimeoutError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "WalletSignatureTimeoutError" || err.name === "TxSignatureTimeoutError";
}

/**
 * Parses a contract error code from backend error messages of the form:
 *   "Contract execution reverted (error code N)"
 * Returns the numeric code, or null if none is found.
 */
export function parseContractErrorCode(message: string): number | null {
  const match = /error code\s+(\d+)/i.exec(message);
  if (!match) return null;
  const code = parseInt(match[1], 10);
  return Number.isFinite(code) ? code : null;
}

/**
 * Formats a transaction error into a user-friendly string.
 *
 * Resolution order:
 * 1. WalletRejectedError instance → wallet decline message
 * 2. Wallet availability error → install link for the wallet in use
 * 3. Backend contract error code → specific ERROR_MESSAGES entry (or generic
 *    with code shown for unknown codes)
 * 4. Network / connectivity errors
 * 5. Raw error message as last resort
 *
 * @param walletId - Optional wallet identifier ("freighter", "xbull", ...)
 *   used for the install link when `err` doesn't carry one itself. A
 *   {@link WalletUnavailableError}'s own `walletId` takes precedence.
 */
export function formatTxError(err: unknown, walletId?: string): string {
  if (isWalletRejectedError(err)) {
    return "You declined the transaction in your wallet.";
  }

  if (isSignatureTimeoutError(err)) {
    return "Signature request timed out. Check your wallet and try again.";
  }

  if (err instanceof WalletUnavailableError) {
    return buildWalletUnavailableMessage(err.walletId);
  }

  if (err instanceof Error) {
    if (isWalletAvailabilityError(err)) {
      return buildWalletUnavailableMessage(walletId);
    }

    // Parse contract error code from backend message first — before any
    // substring matching that could misfire.
    const code = parseContractErrorCode(err.message);
    if (code !== null) {
      return (
        ERROR_MESSAGES[code] ??
        `The contract rejected this transaction (error code ${code}). Check the job state and try again.`
      );
    }

    const message = err.message.toLowerCase();

    if (message.includes("failed to fetch")) {
      return "Network error. Check your connection and try again.";
    }

    if (message.includes("unauthorized")) {
      return "You are not authorized to perform this action.";
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

    reportClientError({ source: "tx", message: err.message || err.name });
    return err.message || "Something went wrong. Please try again.";
  }

  reportClientError({ source: "tx", message: String(err) });
  return "Something went wrong. Please try again.";
}

/** Builds the wallet-specific unavailability message with an install link. */
function buildWalletUnavailableMessage(walletId?: string): string {
  const key = (walletId ?? "").toLowerCase();
  const info = WALLET_INFO[key];

  if (info) {
    return `${info.label} isn't available. Make sure the extension is installed and unlocked. Install at ${info.installUrl}`;
  }

  // Unknown or no wallet id — fall back to a generic message.
  return "Wallet not available. Make sure the extension is installed and unlocked.";
}
