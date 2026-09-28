import { describe, expect, it } from "vitest";
import {
  formatTxError,
  isWalletAvailabilityError,
} from "@/app/lib/errors";

describe("transaction signer wallet availability errors", () => {
  it.each([
    "Freighter not found",
    "Wallet extension is not installed",
    "No wallet extension detected",
  ])("recognizes missing wallet message: %s", (message) => {
    expect(isWalletAvailabilityError(new Error(message))).toBe(true);
    expect(formatTxError(new Error(message))).toBe(
      "Wallet not available. Install Freighter and connect your wallet."
    );
  });

  it("preserves an actionable fallback for an unavailable wallet", () => {
    expect(formatTxError(new Error("Wallet unavailable"))).toContain(
      "Install Freighter"
    );
  });

  it("does not misclassify an unrelated wallet RPC failure", () => {
    const error = new Error("Wallet RPC request timed out");

    expect(isWalletAvailabilityError(error)).toBe(false);
    expect(formatTxError(error)).toBe("Wallet RPC request timed out");
  });
});