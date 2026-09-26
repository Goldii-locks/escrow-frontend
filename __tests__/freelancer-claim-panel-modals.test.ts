import { describe, expect, it } from "vitest";
import {
  INITIAL_CLAIM_CONFIRM_STATE,
  canSubmitClaim,
  cancelClaimConfirm,
  confirmClaimStep,
  getClaimConfirmCopy,
  openClaimConfirm,
} from "@/app/lib/freelancer_claim_panel_modals";

describe("claim double-confirm modal", () => {
  it("blocks submit until both confirmations", () => {
    let s = INITIAL_CLAIM_CONFIRM_STATE;
    expect(canSubmitClaim(s)).toBe(false);
    expect(confirmClaimStep(s).submit).toBe(false);
    s = openClaimConfirm();
    expect(canSubmitClaim(s)).toBe(false);
    const first = confirmClaimStep(s);
    expect(first.submit).toBe(false);
    expect(first.state.step).toBe("final");
    expect(canSubmitClaim(first.state)).toBe(true);
    const second = confirmClaimStep(first.state);
    expect(second.submit).toBe(true);
    expect(second.state.step).toBe("closed");
  });
  it("cancel resets from any step", () => {
    expect(cancelClaimConfirm().step).toBe("closed");
  });
  it("copy mentions amount and token", () => {
    expect(getClaimConfirmCopy("review", "10", "USDC").body).toContain("10 USDC");
    expect(getClaimConfirmCopy("final", "10", "USDC").confirmLabel).toBe("Sign and claim");
    expect(getClaimConfirmCopy("closed", "10", "USDC").title).toBe("");
  });
});
