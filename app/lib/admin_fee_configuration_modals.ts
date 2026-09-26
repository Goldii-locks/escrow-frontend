/**
 * admin_fee_configuration — double-confirm modal logic for fee actions (#465).
 * Submission is blocked until the confirmation dialog has been opened and confirmed.
 */

export type FeeAction = "update_fee" | "reset_fee";

export interface FeeConfirmModal {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

export function buildFeeConfirmModal(action: FeeAction, feeBps: number): FeeConfirmModal {
  if (action === "reset_fee") {
    return {
      title: "Reset platform fee?",
      message: "This resets the platform fee to its default and requires a signed transaction.",
      confirmLabel: "Yes, reset fee",
      cancelLabel: "Cancel",
    };
  }
  return {
    title: "Confirm fee update",
    message: `You are about to set the platform fee to ${(feeBps / 100).toFixed(2)}% (${feeBps} bps). This requires a signed transaction.`,
    confirmLabel: "Yes, update fee",
    cancelLabel: "Cancel",
  };
}

export type ConfirmStep = "idle" | "confirming" | "confirmed";

/** Validate the fee (basis points, integer 0-10000). Returns an error message or null. */
export function validateFeeBps(value: number): string | null {
  if (!Number.isInteger(value)) return "Fee must be a whole number of basis points";
  if (value < 0 || value > 10000) return "Fee must be between 0 and 10000 bps";
  return null;
}

/** First click opens the modal; only a confirm moves to "confirmed". */
export function nextConfirmStep(step: ConfirmStep, event: "submit" | "confirm" | "cancel"): ConfirmStep {
  if (event === "cancel") return "idle";
  if (event === "submit") return step === "idle" ? "confirming" : step;
  return step === "confirming" ? "confirmed" : step;
}

/** Signing may proceed only after the dialog was confirmed. */
export function canSubmitFeeChange(step: ConfirmStep, feeBps: number): boolean {
  return step === "confirmed" && validateFeeBps(feeBps) === null;
}
