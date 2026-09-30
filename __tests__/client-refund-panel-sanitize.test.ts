import { describe, expect, it } from "vitest";
import {
  refundContainsCodeTags,
  sanitizeClientAddress,
  sanitizeRefundAmount,
  sanitizeRefundReason,
} from "@/app/lib/client_refund_panel_sanitize";

describe("client_refund_panel sanitization (#502)", () => {
  describe("refundContainsCodeTags", () => {
    it("detects HTML code tags and script injections", () => {
      expect(refundContainsCodeTags("<script>alert(1)</script>")).toBe(true);
      expect(refundContainsCodeTags("<img src=x onerror=alert(1)>")).toBe(true);
      expect(refundContainsCodeTags("<iframe src='evil.com'></iframe>")).toBe(
        true,
      );
      expect(refundContainsCodeTags("javascript:alert(1)")).toBe(true);
      expect(refundContainsCodeTags("<div>plain text</div>")).toBe(true);
      expect(refundContainsCodeTags("normal dispute reason text")).toBe(false);
      expect(refundContainsCodeTags("500.00")).toBe(false);
    });
  });

  describe("sanitizeRefundReason", () => {
    it("ignores input containing code tags outright (#502 validation requirement)", () => {
      expect(sanitizeRefundReason("<script>evil()</script>")).toBe("");
      expect(sanitizeRefundReason("Hello <img src=x onerror=alert(1)>")).toBe(
        "",
      );
      expect(sanitizeRefundReason("javascript:void(0)")).toBe("");
    });

    it("allows valid safe reason strings", () => {
      expect(
        sanitizeRefundReason("Milestone not delivered within deadline"),
      ).toBe("Milestone not delivered within deadline");
      expect(sanitizeRefundReason("  Work scope altered without consent.  ")).toBe(
        "Work scope altered without consent.",
      );
    });

    it("handles null or undefined input safely", () => {
      expect(sanitizeRefundReason(null)).toBe("");
      expect(sanitizeRefundReason(undefined)).toBe("");
      expect(sanitizeRefundReason("")).toBe("");
    });
  });

  describe("sanitizeRefundAmount", () => {
    it("ignores input containing code tags", () => {
      expect(sanitizeRefundAmount("<script>100</script>")).toBe("");
      expect(sanitizeRefundAmount("100<svg onload=alert(1)>")).toBe("");
    });

    it("cleans numeric amounts and preserves valid single decimal", () => {
      expect(sanitizeRefundAmount("150.50")).toBe("150.50");
      expect(sanitizeRefundAmount("$1,500.00")).toBe("1500.00");
      expect(sanitizeRefundAmount("12.34.56")).toBe("12.3456");
      expect(sanitizeRefundAmount("abc100xyz")).toBe("100");
    });
  });

  describe("sanitizeClientAddress", () => {
    it("ignores code tags and extracts alphanumeric characters", () => {
      expect(sanitizeClientAddress("<script>addr</script>")).toBe("");
      expect(
        sanitizeClientAddress("  GCLIENT123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ  "),
      ).toBe("GCLIENT123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    });
  });
});
