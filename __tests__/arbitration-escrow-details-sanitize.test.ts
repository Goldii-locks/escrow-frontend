import { describe, expect, it } from "vitest";
import {
  arbitrationContainsCodeTags,
  sanitizeArbitrationAmount,
  sanitizeArbitrationComment,
  sanitizeArbitrationReason,
} from "@/app/lib/arbitration_escrow_details_sanitize";

describe("arbitration_escrow_details form input sanitization (#482)", () => {
  it("detects code tags and script payloads", () => {
    expect(arbitrationContainsCodeTags("<script>alert(1)</script>")).toBe(true);
    expect(arbitrationContainsCodeTags("<img src=x onerror=alert(1)>")).toBe(
      true,
    );
    expect(arbitrationContainsCodeTags("<iframe src=evil></iframe>")).toBe(true);
    expect(arbitrationContainsCodeTags("javascript:alert(1)")).toBe(true);
    expect(arbitrationContainsCodeTags("<b>bold text</b>")).toBe(true);
    expect(arbitrationContainsCodeTags("Legitimate evidence explanation")).toBe(
      false,
    );
  });

  it("asserts form ignores input containing code tags in reasons (#482)", () => {
    expect(sanitizeArbitrationReason("<script>exploit()</script>")).toBe("");
    expect(
      sanitizeArbitrationReason("Hello <svg onload=alert(1)> world"),
    ).toBe("");
    expect(sanitizeArbitrationReason("javascript:void(0)")).toBe("");
    expect(sanitizeArbitrationReason("Valid reason description")).toBe(
      "Valid reason description",
    );
  });

  it("asserts form ignores input containing code tags in comments", () => {
    expect(sanitizeArbitrationComment("<script>evil()</script>")).toBe("");
    expect(sanitizeArbitrationComment("Evidence details note")).toBe(
      "Evidence details note",
    );
  });

  it("asserts form ignores input containing code tags in amounts", () => {
    expect(sanitizeArbitrationAmount("<script>500</script>")).toBe("");
    expect(sanitizeArbitrationAmount("500.00")).toBe("500.00");
    expect(sanitizeArbitrationAmount("$1,200.50")).toBe("1200.50");
  });

  it("handles null and empty values gracefully", () => {
    expect(sanitizeArbitrationReason(null)).toBe("");
    expect(sanitizeArbitrationComment(undefined)).toBe("");
    expect(sanitizeArbitrationAmount("")).toBe("");
  });
});
