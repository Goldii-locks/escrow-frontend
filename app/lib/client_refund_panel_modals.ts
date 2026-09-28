/**
 * client_refund_panel — double-confirm validation modal (#505).
 *
 * The refund transaction must not be submitted until the user has passed
 * through both confirmation steps. Pure state machine, React-free.
 */

export type RefundConfirmStep = "closed" | "review" | "final";

export interface RefundConfirmState {
  step: RefundConfirmStep;
}

export const INITIAL_REFUND_CONFIRM_STATE: RefundConfirmState = { step: "closed" };

export interface RefundConfirmCopy {
  title: string;
  body: string;
  confirmLabel: string;
}

/** Copy for each step of the two-step refund confirmation flow. */
export function getRefundConfirmCopy(
  step: RefundConfirmStep,
  amount: string,
  token: string,
): RefundConfirmCopy {
  if (step === "review") {
    return {
      title: "Request refund?",
      body: `You are about to request a refund of ${amount} ${token}. Review the details before continuing.`,
      confirmLabel: "Continue",
    };
  }
  if (step === "final") {
    return {
      title: "Confirm and sign",
      body: `This will ask your wallet to sign a transaction requesting a refund of ${amount} ${token}. This cannot be undone.`,
      confirmLabel: "Sign and request refund",
    };
  }
  return { title: "", body: "", confirmLabel: "" };
}

/** Open the confirmation flow from closed. */
export function openRefundConfirm(): RefundConfirmState {
  return { step: "review" };
}

/** Advance one step; the second confirm returns `submit: true`. */
export function confirmRefundStep(state: RefundConfirmState): {
  state: RefundConfirmState;
  submit: boolean;
} {
  if (state.step === "review") return { state: { step: "final" }, submit: false };
  if (state.step === "final") return { state: { step: "closed" }, submit: true };
  return { state, submit: false };
}

/** Reset modal back to closed from any step. */
export function cancelRefundConfirm(): RefundConfirmState {
  return { step: "closed" };
}

/** Submit is only permitted from the final step (i.e. after both confirmations). */
export function canSubmitRefund(state: RefundConfirmState): boolean {
  return state.step === "final";
}
