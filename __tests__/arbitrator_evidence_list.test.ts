import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MOCK_EVIDENCE_DATASET } from "@/__tests__/fixtures/arbitrator_evidence_list";
import {
  isArbitratorAuthorized,
  sanitizeEvidenceInput,
  fetchArbitratorEvidence,
} from "@/app/lib/arbitrator_evidence_list";

describe("arbitrator_evidence_list module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("Access Restrictions (Issue #420)", () => {
    it("isArbitratorAuthorized verifies wallet address against authorized list", () => {
      const authorized = ["GARBITER1", "GARBITER2"];
      expect(isArbitratorAuthorized("GARBITER1", authorized)).toBe(true);
      expect(isArbitratorAuthorized("GARBITER2", authorized)).toBe(true);
      expect(isArbitratorAuthorized("GUNAUTHORIZED", authorized)).toBe(false);
      expect(isArbitratorAuthorized(null, authorized)).toBe(false);
      expect(isArbitratorAuthorized("", authorized)).toBe(false);
    });
  });

  describe("Input Sanitization (Issue #422)", () => {
    it("sanitizeEvidenceInput strips script tags and code blocks", () => {
      const maliciousScript = "Evidence title <script>alert('xss')</script> valid text";
      expect(sanitizeEvidenceInput(maliciousScript)).toBe("Evidence title  valid text");

      const maliciousCode = "Payload <code>danger()</code> test";
      expect(sanitizeEvidenceInput(maliciousCode)).toBe("Payload  test");

      const nestedTags = "<b>Clean</b> <code><script>evil()</script></code>";
      expect(sanitizeEvidenceInput(nestedTags)).toBe("Clean");
    });
  });

  describe("Data Mapping & Backend Query Bindings (Issue #423)", () => {
    it("fetchArbitratorEvidence returns data from the backend", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, json: async () => MOCK_EVIDENCE_DATASET })
      );
      const data = await fetchArbitratorEvidence("disp-101");
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty("disputeId", "disp-101");
      expect(data[0]).toHaveProperty("title");
      expect(data[0]).toHaveProperty("hash");
    });

    it("throws when the backend is unreachable", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
      await expect(fetchArbitratorEvidence("disp-101")).rejects.toThrow(/network down/);
    });
  });
});
