import { describe, expect, it } from "vitest";
import {
  INITIAL_REFUND_CONFIRM_STATE,
  cancelRefundConfirm,
  canSubmitRefund,
  confirmRefundStep,
  getRefundConfirmCopy,
  openRefundConfirm,
} from "@/app/lib/client_refund_panel_modals";

describe("refund double-confirm modal", () => {
  it("blocks submit until both confirmations", () => {
    let s = INITIAL_REFUND_CONFIRM_STATE;
    expect(canSubmitRefund(s)).toBe(false);

    // Opening does not allow submit
    s = openRefundConfirm();
    expect(s.step).toBe("review");
    expect(canSubmitRefund(s)).toBe(false);

    // First confirm advances to final but does not submit
    const first = confirmRefundStep(s);
    expect(first.submit).toBe(false);
    expect(first.state.step).toBe("final");
    expect(canSubmitRefund(first.state)).toBe(true);

    // Second confirm submits and resets
    const second = confirmRefundStep(first.state);
    expect(second.submit).toBe(true);
    expect(second.state.step).toBe("closed");
  });

  it("cancel resets from any step", () => {
    let s = openRefundConfirm();
    expect(cancelRefundConfirm().step).toBe("closed");
    s = confirmRefundStep(s).state; // now "final"
    expect(cancelRefundConfirm().step).toBe("closed");
  });

  it("confirmRefundStep on closed state is a no-op", () => {
    const result = confirmRefundStep(INITIAL_REFUND_CONFIRM_STATE);
    expect(result.submit).toBe(false);
    expect(result.state.step).toBe("closed");
  });

  it("copy mentions amount and token", () => {
    expect(
      getRefundConfirmCopy("review", "25.00", "USDC").body,
    ).toContain("25.00 USDC");
    expect(
      getRefundConfirmCopy("final", "25.00", "USDC").body,
    ).toContain("25.00 USDC");
    expect(
      getRefundConfirmCopy("final", "25.00", "USDC").confirmLabel,
    ).toBe("Sign and request refund");
    expect(
      getRefundConfirmCopy("closed", "25.00", "USDC").title,
    ).toBe("");
  });

  it("review copy has Continue as confirm label", () => {
    expect(
      getRefundConfirmCopy("review", "10", "XLM").confirmLabel,
    ).toBe("Continue");
  });
});
