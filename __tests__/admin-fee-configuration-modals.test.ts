import { describe, expect, it } from "vitest";
import {
  buildFeeConfirmModal,
  canSubmitFeeChange,
  nextConfirmStep,
  validateFeeBps,
} from "@/app/lib/admin_fee_configuration_modals";

describe("admin_fee_configuration modals", () => {
  it("blocks submit until the confirmation dialog is confirmed", () => {
    let step = nextConfirmStep("idle", "submit");
    expect(step).toBe("confirming");
    expect(canSubmitFeeChange(step, 250)).toBe(false);
    step = nextConfirmStep(step, "confirm");
    expect(canSubmitFeeChange(step, 250)).toBe(true);
  });

  it("cancel resets and confirm without dialog does nothing", () => {
    expect(nextConfirmStep("confirming", "cancel")).toBe("idle");
    expect(nextConfirmStep("idle", "confirm")).toBe("idle");
  });

  it("validates fee bps", () => {
    expect(validateFeeBps(250)).toBeNull();
    expect(validateFeeBps(-1)).not.toBeNull();
    expect(validateFeeBps(10001)).not.toBeNull();
    expect(validateFeeBps(1.5)).not.toBeNull();
    expect(canSubmitFeeChange("confirmed", 20000)).toBe(false);
  });

  it("builds modal copy", () => {
    expect(buildFeeConfirmModal("update_fee", 250).message).toContain("2.50%");
    expect(buildFeeConfirmModal("reset_fee", 0).title).toMatch(/Reset/);
  });
});
