import { describe, expect, it } from "vitest";
import {
  freelancerClaimContainsCodeTags,
  sanitizeClaimAmount,
  sanitizeClaimInvoiceId,
  sanitizeClaimNote,
} from "@/app/lib/freelancer_claim_panel_sanitize";

describe("freelancer_claim_panel form input sanitization (#492)", () => {
  it("detects code tags and script injections", () => {
    expect(freelancerClaimContainsCodeTags("<script>alert(1)</script>")).toBe(
      true,
    );
    expect(freelancerClaimContainsCodeTags("<img src=x onerror=alert(1)>")).toBe(
      true,
    );
    expect(freelancerClaimContainsCodeTags("javascript:alert(1)")).toBe(true);
    expect(freelancerClaimContainsCodeTags("<svg onload=alert(1)>")).toBe(true);
    expect(
      freelancerClaimContainsCodeTags("Standard delivery invoice note"),
    ).toBe(false);
  });

  it("asserts form ignores input containing code tags in claim notes (#492)", () => {
    expect(sanitizeClaimNote("<script>evil()</script>")).toBe("");
    expect(sanitizeClaimNote("Deliverable completed <iframe src=evil>")).toBe(
      "",
    );
    expect(sanitizeClaimNote("javascript:void(0)")).toBe("");
    expect(sanitizeClaimNote("All tasks completed as agreed.")).toBe(
      "All tasks completed as agreed.",
    );
  });

  it("asserts form ignores input containing code tags in invoice IDs", () => {
    expect(sanitizeClaimInvoiceId("<script>INV-01</script>")).toBe("");
    expect(sanitizeClaimInvoiceId("INV-2026_09")).toBe("INV-2026_09");
  });

  it("asserts form ignores input containing code tags in claim amounts", () => {
    expect(sanitizeClaimAmount("<script>300</script>")).toBe("");
    expect(sanitizeClaimAmount("300.00")).toBe("300.00");
    expect(sanitizeClaimAmount("$1,250.75")).toBe("1250.75");
  });

  it("handles null and empty input safely", () => {
    expect(sanitizeClaimNote(null)).toBe("");
    expect(sanitizeClaimInvoiceId(undefined)).toBe("");
    expect(sanitizeClaimAmount("")).toBe("");
  });
});
