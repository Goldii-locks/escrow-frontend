import { reportClientError } from "@/app/lib/errorReporter";
import {
  EscrowError,
  FactoryError,
} from "@goldii-locks/milestone-escrow-bindings";

/**
 * User-facing messages for the escrow contract's `Error` enum, keyed by the
 * enum's numeric code. The keys come from the generated bindings
 * (`@goldii-locks/milestone-escrow-bindings`), so a new or renumbered variant
 * in the contract surfaces here as a TypeScript error rather than a silently
 * wrong message. The backend reports a revert as
 * "Contract execution reverted (error code N)".
 */
const ESCROW_ERROR_TEXT: Record<keyof typeof EscrowError, string> = {
  AlreadyInitialized: "This escrow has already been initialized.",
  NotInitialized: "This escrow hasn't been initialized yet.",
  AlreadyFunded: "This escrow has already been funded.",
  NotFunded: "This escrow hasn't been funded yet. Fund the escrow before proceeding.",
  Unauthorized: "You are not authorized to perform this action.",
  MilestoneNotFound: "That milestone doesn't exist on this escrow.",
  InvalidMilestoneStatus: "This action is not available for the current milestone status.",
  TokenNotWhitelisted: "This token is not on the escrow's whitelist.",
  TokenAlreadyWhitelisted: "This token is already whitelisted.",
  InvalidAmount: "Invalid amount. Check the value and try again.",
  DeadlineNotPassed: "The auto-release deadline has not passed yet. Please wait until it does.",
  InvalidAddress: "One of the addresses is invalid. Check it and try again.",
  Paused: "This escrow is paused. No actions can be taken until it is unpaused.",
  InvalidSplitRatio: "The split ratio is invalid. Check the percentages and try again.",
  DeadlineExtensionNotAllowed: "That deadline extension isn't allowed.",
  Locked: "This escrow is locked and cannot be modified.",
  NoMultisigSigners: "This multisig has no signers configured.",
  TooManySigners: "Too many multisig signers.",
  InvalidThreshold: "The multisig threshold is invalid.",
  DuplicateSigner: "The multisig has a duplicate signer.",
  AdminTransferPending: "An admin transfer is already pending.",
  NoPendingAdminTransfer: "There is no pending admin transfer.",
  InsufficientApprovals: "Not enough multisig approvals yet.",
  DisputeAlreadyRaised: "A dispute is already being raised for this milestone.",
  NoBalanceToPay: "There is no balance to pay out.",
  TaxWithholdingInProgress: "Tax withholding is in progress. Try again in a moment.",
  FeeAllocationInProgress: "A platform fee allocation is in progress. Try again in a moment.",
  PauseChangeInProgress: "An emergency pause change is in progress. Try again in a moment.",
  AlreadyPaused: "This escrow is already paused.",
  NotPaused: "This escrow is not paused.",
  InvalidAllocationWeights: "The allocation weights are invalid.",
  NoBalanceToSettle: "The escrow holds no balance to settle.",
  DeadlineExtensionInProgress: "A deadline extension is in progress. Try again in a moment.",
  StreamUpdateInProgress: "A payment stream update is in progress. Try again in a moment.",
  FeeTooHigh: "The fee is higher than the contract allows.",
  AmountTooLarge: "The amount is too large to process.",
  InsufficientBalance: "The escrow balance is too low for this action.",
};

/**
 * Builds a `code -> message` map from a bindings `Error` enum and its text
 * table. Throws at module load if the two drift apart (e.g. a variant was
 * added to the enum but not to the text table), so the mismatch fails fast
 * in tests and at build time instead of showing a wrong message in the UI.
 */
function buildErrorMessages<E extends Record<string, number | string>>(
  errorEnum: E,
  text: Record<keyof E, string>,
): Record<number, string> {
  const messages: Record<number, string> = {};
  for (const key of Object.keys(errorEnum) as (keyof E)[]) {
    const code = errorEnum[key];
    if (typeof code !== "number") continue;
    const message = text[key];
    if (typeof message !== "string") {
      throw new Error(`Missing user-facing message for contract error "${String(key)}" (code ${code}).`);
    }
    messages[code] = message;
  }
  return messages;
}

/** Escrow contract error codes, derived from the generated bindings enum. */
export const ERROR_MESSAGES: Record<number, string> = buildErrorMessages(
  EscrowError,
  ESCROW_ERROR_TEXT,
);

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
 * Messages for the escrow-factory `Error` codes `create_escrow` can return,
 * derived from the generated bindings enum. They overlap the escrow's codes,
 * so the create flow checks these first; any other code comes from the new
 * escrow's constructor and keeps its {@link ERROR_MESSAGES} text.
 */
const FACTORY_ERROR_TEXT: Record<keyof typeof FactoryError, string> = {
  NotInitialized: "Escrow creation isn't set up yet: the escrow factory hasn't been initialized.",
  TokenNotAccepted: "This token isn't accepted for new escrows. Pick one of the listed tokens.",
  NoMilestones: "Add at least one milestone with a valid amount.",
};

/** Escrow-factory error codes, derived from the generated bindings enum. */
export const FACTORY_ERROR_MESSAGES: Record<number, string> = buildErrorMessages(
  FactoryError,
  FACTORY_ERROR_TEXT,
);

/** {@link formatTxError} for `create_escrow`, reading factory error codes first. */
export function formatCreateEscrowError(err: unknown, walletId?: string): string {
  if (err instanceof Error) {
    const code = parseContractErrorCode(err.message);
    if (code !== null && FACTORY_ERROR_MESSAGES[code]) return FACTORY_ERROR_MESSAGES[code];
  }
  return formatTxError(err, walletId);
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
