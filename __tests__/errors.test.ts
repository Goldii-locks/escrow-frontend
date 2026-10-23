import { describe, expect, it } from "vitest";
import {
  formatTxError,
  isWalletAvailabilityError,
  WalletRejectedError,
  WalletUnavailableError,
} from "@/app/lib/errors";

describe("transaction signer wallet availability errors", () => {
  it.each([
    "Freighter not found",
    "Wallet extension is not installed",
    "No wallet extension detected",
    "Wallet unavailable",
  ])("recognizes missing wallet message: %s", (message) => {
    expect(isWalletAvailabilityError(new Error(message))).toBe(true);
  });

  it("does not misclassify an unrelated wallet RPC failure", () => {
    const error = new Error("Wallet RPC request timed out");

    expect(isWalletAvailabilityError(error)).toBe(false);
    expect(formatTxError(error)).toBe("Wallet RPC request timed out");
  });
});

// =============================================================================
// #687 — per-wallet install links
// =============================================================================

describe("WalletUnavailableError", () => {
  it.each([
    ["freighter", "Freighter", "https://www.freighter.app/"],
    ["albedo", "Albedo", "https://albedo.link/"],
    ["xbull", "xBull", "https://xbull.app/"],
    ["hana", "Hana", "https://hanastellar.com/"],
  ])("names the wallet and sets walletId for %s", (id, label, url) => {
    const err = new WalletUnavailableError(id);
    expect(err.walletId).toBe(id);
    expect(err.message).toContain(label);
    expect(err.message).toContain("installed and unlocked");
    // isWalletAvailabilityError must recognise the typed error
    expect(isWalletAvailabilityError(err)).toBe(true);
    // formatTxError must include the install link
    const formatted = formatTxError(err);
    expect(formatted).toContain(label);
    expect(formatted).toContain(url);
  });

  it("falls back to the raw walletId as label for an unknown wallet", () => {
    const err = new WalletUnavailableError("my-custom-wallet");
    expect(err.message).toContain("my-custom-wallet");
  });
});

describe("formatTxError — per-wallet install links (#687)", () => {
  it("names Freighter only for Freighter", () => {
    const err = new WalletUnavailableError("freighter");
    const message = formatTxError(err);
    expect(message).toContain("Freighter");
    expect(message).not.toMatch(/xBull|Albedo|Hana/i);
  });

  it("names xBull for an xBull availability error and does not mention Freighter", () => {
    const err = new WalletUnavailableError("xbull");
    const message = formatTxError(err);
    expect(message).toContain("xBull");
    expect(message).not.toContain("Freighter");
    expect(message).toContain("https://xbull.app/");
  });

  it("names Albedo for an Albedo availability error and does not mention Freighter", () => {
    const err = new WalletUnavailableError("albedo");
    const message = formatTxError(err);
    expect(message).toContain("Albedo");
    expect(message).not.toContain("Freighter");
    expect(message).toContain("https://albedo.link/");
  });

  it("names Hana for a Hana availability error and does not mention Freighter", () => {
    const err = new WalletUnavailableError("hana");
    const message = formatTxError(err);
    expect(message).toContain("Hana");
    expect(message).not.toContain("Freighter");
    expect(message).toContain("https://hanastellar.com/");
  });

  it("accepts an optional walletId for a plain availability error", () => {
    const message = formatTxError(new Error("Wallet unavailable"), "xbull");
    expect(message).toContain("xBull");
    expect(message).toContain("https://xbull.app/");
  });

  it("falls back to generic message when walletId is unknown", () => {
    const message = formatTxError(new Error("Wallet unavailable"), "unknown-wallet");
    expect(message).toContain("Wallet not available");
    expect(message).not.toContain("Freighter");
  });

  it("still handles WalletRejectedError unchanged", () => {
    expect(formatTxError(new WalletRejectedError())).toBe(
      "You declined the transaction in your wallet."
    );
  });
});
