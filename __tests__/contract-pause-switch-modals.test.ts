import { describe, expect, it } from "vitest";
import {
  INITIAL_PAUSE_CONFIRM_STATE,
  canSubmitPause,
  cancelPauseConfirm,
  confirmPauseStep,
  getPauseAction,
  getPauseConfirmCopy,
  openPauseConfirm,
} from "@/app/lib/contract_pause_switch_modals";

describe("pause double-confirm modal", () => {
  it("derives the action from the paused flag", () => {
    expect(getPauseAction(false)).toBe("freeze");
    expect(getPauseAction(true)).toBe("unfreeze");
  });
  it("blocks submit until both confirmations", () => {
    expect(canSubmitPause(INITIAL_PAUSE_CONFIRM_STATE)).toBe(false);
    expect(confirmPauseStep(INITIAL_PAUSE_CONFIRM_STATE).submit).toBeNull();
    const opened = openPauseConfirm(false);
    expect(canSubmitPause(opened)).toBe(false);
    const first = confirmPauseStep(opened);
    expect(first.submit).toBeNull();
    expect(canSubmitPause(first.state)).toBe(true);
    const second = confirmPauseStep(first.state);
    expect(second.submit).toBe("freeze");
    expect(second.state.step).toBe("closed");
  });
  it("unfreeze flow submits unfreeze", () => {
    const s = confirmPauseStep(confirmPauseStep(openPauseConfirm(true)).state);
    expect(s.submit).toBe("unfreeze");
  });
  it("cancel resets", () => {
    expect(cancelPauseConfirm()).toEqual(INITIAL_PAUSE_CONFIRM_STATE);
  });
  it("copy differs per action and step", () => {
    expect(getPauseConfirmCopy("review", "freeze").title).toBe("Freeze contract?");
    expect(getPauseConfirmCopy("final", "unfreeze").confirmLabel).toBe("Sign and unfreeze");
    expect(getPauseConfirmCopy("closed", null).title).toBe("");
  });
});
