/**
 * freelancer_claim_panel — double-confirm validation modal (#495).
 *
 * The claim transaction must not be submitted until the user has passed
 * through both confirmation steps. Pure state machine, React-free.
 */

export type ClaimConfirmStep = "closed" | "review" | "final";

export interface ClaimConfirmState {
  step: ClaimConfirmStep;
}

export const INITIAL_CLAIM_CONFIRM_STATE: ClaimConfirmState = { step: "closed" };

export function getClaimConfirmCopy(step: ClaimConfirmStep, amount: string, token: string) {
  if (step === "review") {
    return {
      title: "Claim payout?",
      body: `You are about to claim ${amount} ${token}. Review the details before continuing.`,
      confirmLabel: "Continue",
    };
  }
  if (step === "final") {
    return {
      title: "Confirm and sign",
      body: `This will ask your wallet to sign a transaction claiming ${amount} ${token}. This cannot be undone.`,
      confirmLabel: "Sign and claim",
    };
  }
  return { title: "", body: "", confirmLabel: "" };
}

export function openClaimConfirm(): ClaimConfirmState {
  return { step: "review" };
}

/** Advance one step; the second confirm returns `submit: true`. */
export function confirmClaimStep(state: ClaimConfirmState): { state: ClaimConfirmState; submit: boolean } {
  if (state.step === "review") return { state: { step: "final" }, submit: false };
  if (state.step === "final") return { state: { step: "closed" }, submit: true };
  return { state, submit: false };
}

export function cancelClaimConfirm(): ClaimConfirmState {
  return { step: "closed" };
}

/** Submit is only permitted from the final step (i.e. after both confirmations). */
export function canSubmitClaim(state: ClaimConfirmState): boolean {
  return state.step === "final";
}
