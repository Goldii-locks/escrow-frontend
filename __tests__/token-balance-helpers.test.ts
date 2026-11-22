import { describe, expect, it } from "vitest";
import {
  formatTokenAmount,
  hasInsufficientBalance,
  insufficientBalanceMessage,
  sumBaseUnits,
} from "@/app/lib/balance_check";
import { parseTokenBalance } from "@/app/lib/token_balance";

describe("token balance helpers (issue #845)", () => {
  describe("sumBaseUnits", () => {
    it("adds milestone amounts as base units", () => {
      expect(sumBaseUnits(["250000000", "150000000"])).toBe("400000000");
    });

    it("ignores blank or invalid entries and returns null when none are valid", () => {
      expect(sumBaseUnits(["", "abc", "100"])).toBe("100");
      expect(sumBaseUnits(["", "abc"])).toBeNull();
    });
  });

  describe("hasInsufficientBalance", () => {
    it("is true only when a known balance is below the known requirement", () => {
      expect(hasInsufficientBalance("10", "40")).toBe(true);
      expect(hasInsufficientBalance("40", "40")).toBe(false);
      expect(hasInsufficientBalance("50", "40")).toBe(false);
    });

    it("does not report a shortfall while the balance or requirement is unknown", () => {
      expect(hasInsufficientBalance(null, "40")).toBe(false);
      expect(hasInsufficientBalance("10", null)).toBe(false);
    });
  });

  describe("formatting", () => {
    it("formats base units with token decimals and symbol", () => {
      expect(formatTokenAmount("400000000", { decimals: 7, symbol: "USDC" })).toBe("40 USDC");
      expect(formatTokenAmount(null)).toBe("—");
    });

    it("builds the insufficient-balance message required by the UI", () => {
      expect(
        insufficientBalanceMessage("100000000", "400000000", { decimals: 7, symbol: "USDC" })
      ).toBe("Insufficient balance: you have 10 USDC, need 40 USDC");
    });
  });

  describe("parseTokenBalance", () => {
    it("reads a decimal string from the backend's standard envelope", () => {
      expect(parseTokenBalance({ success: true, data: { result: "1234567" } })).toBe("1234567");
    });

    it("reads nested balance values and safe integers", () => {
      expect(parseTokenBalance({ data: { result: { balance: "42" } } })).toBe("42");
      expect(parseTokenBalance({ data: { balance: 42 } })).toBe("42");
    });

    it("returns null for missing or non-numeric values", () => {
      expect(parseTokenBalance(null)).toBeNull();
      expect(parseTokenBalance({ data: { result: "not-a-number" } })).toBeNull();
      expect(parseTokenBalance({ data: { result: 1.5 } })).toBeNull();
    });
  });
});
