/**
 * contract_pause_switch — double-confirm validation modal (#475).
 *
 * Freezing or unfreezing the contract must not be submitted until the admin
 * has passed through both confirmation steps. Pure state machine, React-free.
 */

export type PauseAction = "freeze" | "unfreeze";
export type PauseConfirmStep = "closed" | "review" | "final";

export interface PauseConfirmState {
  step: PauseConfirmStep;
  action: PauseAction | null;
}

export const INITIAL_PAUSE_CONFIRM_STATE: PauseConfirmState = { step: "closed", action: null };

/** The action a toggle performs given the current paused flag. */
export function getPauseAction(paused: boolean): PauseAction {
  return paused ? "unfreeze" : "freeze";
}

export function getPauseConfirmCopy(step: PauseConfirmStep, action: PauseAction | null) {
  if (step === "closed" || !action) return { title: "", body: "", confirmLabel: "" };
  const verb = action === "freeze" ? "freeze" : "unfreeze";
  if (step === "review") {
    return {
      title: action === "freeze" ? "Freeze contract?" : "Unfreeze contract?",
      body:
        action === "freeze"
          ? "Freezing halts all escrow activity until the contract is unfrozen."
          : "Unfreezing resumes normal escrow activity for all users.",
      confirmLabel: "Continue",
    };
  }
  return {
    title: `Confirm ${verb}`,
    body: `Your wallet will be asked to sign a transaction to ${verb} the contract.`,
    confirmLabel: action === "freeze" ? "Sign and freeze" : "Sign and unfreeze",
  };
}

export function openPauseConfirm(paused: boolean): PauseConfirmState {
  return { step: "review", action: getPauseAction(paused) };
}

/** Advance one step; the second confirm returns `submit: true` with the action. */
export function confirmPauseStep(state: PauseConfirmState): {
  state: PauseConfirmState;
  submit: PauseAction | null;
} {
  if (state.step === "review") return { state: { ...state, step: "final" }, submit: null };
  if (state.step === "final") return { state: INITIAL_PAUSE_CONFIRM_STATE, submit: state.action };
  return { state, submit: null };
}

export function cancelPauseConfirm(): PauseConfirmState {
  return INITIAL_PAUSE_CONFIRM_STATE;
}

/** Submit is only permitted from the final step (after both confirmations). */
export function canSubmitPause(state: PauseConfirmState): boolean {
  return state.step === "final" && state.action !== null;
}
