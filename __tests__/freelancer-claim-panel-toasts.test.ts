import { describe, expect, it } from "vitest";
import {
  claimErrorToast,
  claimNotReadyToast,
  claimNothingToClaimToast,
  claimSuccessToast,
  claimWalletWarningToast,
} from "@/app/lib/freelancer_claim_panel_toasts";

describe("freelancer_claim_panel toasts", () => {
  it("builds success and error toasts with shortened ids", () => {
    expect(claimSuccessToast("ABCDEFGHIJKLMNOP")).toEqual({
      type: "success",
      message: "Payout for escrow ABCD…MNOP claimed.",
    });
    expect(claimErrorToast("42", "rejected")).toEqual({
      type: "error",
      message: "Failed to claim escrow 42: rejected",
    });
  });

  it("builds warning toasts", () => {
    expect(claimNothingToClaimToast().type).toBe("warning");
    expect(claimWalletWarningToast().type).toBe("warning");
    expect(claimNotReadyToast("locked").message).toContain("locked");
  });
});
