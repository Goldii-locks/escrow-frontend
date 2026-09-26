import { describe, expect, it } from "vitest";
import {
  feeConfigContainsCodeTags,
  sanitizeFeeRate,
  sanitizeFeeRecipient,
} from "@/app/lib/admin_fee_configuration_sanitize";

describe("admin_fee_configuration sanitize", () => {
  it("detects code tags", () => {
    expect(feeConfigContainsCodeTags("<script>alert(1)</script>")).toBe(true);
    expect(feeConfigContainsCodeTags("javascript:alert(1)")).toBe(true);
    expect(feeConfigContainsCodeTags("2.5")).toBe(false);
  });
  it("ignores fee rate input containing code tags", () => {
    expect(sanitizeFeeRate("<img src=x onerror=1>")).toBe("");
  });
  it("keeps only numeric fee rate characters", () => {
    expect(sanitizeFeeRate(" 2.5% ")).toBe("2.5");
    expect(sanitizeFeeRate("1.2.3")).toBe("1.23");
  });
  it("ignores recipient with tags and strips junk otherwise", () => {
    expect(sanitizeFeeRecipient("<b>GABC</b>")).toBe("");
    expect(sanitizeFeeRecipient(" GABC-123 ")).toBe("GABC123");
  });
});
