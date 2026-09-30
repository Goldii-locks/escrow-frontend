import { describe, expect, it } from "vitest";
import {
  refundAmountInvalidToast,
  refundErrorToast,
  refundExportEmptyToast,
  refundNotReadyToast,
  refundNothingToClaimToast,
  refundSuccessToast,
  refundWalletWarningToast,
} from "@/app/lib/client_refund_panel_toasts";

describe("client_refund_panel toasts (#506)", () => {
  it("builds a success toast with a shortened escrow id", () => {
    expect(refundSuccessToast("ABCDEFGHIJKLMNOP")).toEqual({
      type: "success",
      message: "Refund requested for escrow ABCD…MNOP.",
    });
  });

  it("leaves short escrow ids intact", () => {
    expect(refundSuccessToast("esc-101")).toEqual({
      type: "success",
      message: "Refund requested for escrow esc-101.",
    });
  });

  it("treats a 12-character id as already short enough", () => {
    // The elision only kicks in past 12 characters, so the boundary must not
    // truncate.
    expect(refundSuccessToast("ABCDEFGHIJKL").message).toContain("ABCDEFGHIJKL");
  });

  it("builds an error toast carrying the backend reason", () => {
    expect(refundErrorToast("ABCDEFGHIJKLMNOP", "escrow already refunded")).toEqual({
      type: "error",
      message:
        "Failed to request refund for escrow ABCD…MNOP: escrow already refunded",
    });
  });

  it("reports an error toast for a short id without truncation", () => {
    expect(refundErrorToast("esc-102", "rejected")).toEqual({
      type: "error",
      message: "Failed to request refund for escrow esc-102: rejected",
    });
  });

  it("builds every warning toast as type warning", () => {
    expect(refundNothingToClaimToast()).toEqual({
      type: "warning",
      message: "There are no refund requests for this escrow.",
    });
    expect(refundWalletWarningToast().type).toBe("warning");
    expect(refundAmountInvalidToast("must be greater than zero").type).toBe("warning");
    expect(refundNotReadyToast("milestone still open").type).toBe("warning");
    expect(refundExportEmptyToast()).toEqual({
      type: "warning",
      message: "There is no refund data to export.",
    });
  });

  it("surfaces the caller's reason in the amount and not-ready warnings", () => {
    expect(refundAmountInvalidToast("must be greater than zero").message).toContain(
      "must be greater than zero",
    );
    expect(refundNotReadyToast("milestone still open").message).toContain(
      "milestone still open",
    );
  });

  it("prompts the user to connect a wallet", () => {
    expect(refundWalletWarningToast().message).toContain("Connect your wallet");
  });

  it("uses distinct copy per action so toasts are not interchangeable", () => {
    const messages = new Set([
      refundNothingToClaimToast().message,
      refundWalletWarningToast().message,
      refundExportEmptyToast().message,
      refundAmountInvalidToast("x").message,
      refundNotReadyToast("x").message,
    ]);
    expect(messages.size).toBe(5);
  });
});