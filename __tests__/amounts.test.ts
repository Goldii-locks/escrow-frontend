import { describe, expect, it } from "vitest";
import { formatBaseUnits, parseDecimalToBaseUnits } from "@/app/lib/amounts";

describe("amount utilities", () => {
  it("converts decimal XLM to stroops", () => {
    expect(parseDecimalToBaseUnits("2.5", 7).toString()).toBe("25000000");
  });

  it("formats stroops to decimal XLM", () => {
    expect(formatBaseUnits("50000000", { decimals: 7 })).toBe("5");
  });

  it("supports dynamic token decimals", () => {
    expect(parseDecimalToBaseUnits("1.25", 2).toString()).toBe("125");
    expect(formatBaseUnits("125", { decimals: 2 })).toBe("1.25");
  });

  it("rejects values with too many decimal places", () => {
    expect(() => parseDecimalToBaseUnits("1.234", 2)).toThrow(
      "Amount supports up to 2 decimal places"
    );
  });
});
