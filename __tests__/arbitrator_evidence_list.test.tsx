import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ArbitratorEvidenceList from "@/app/components/ArbitratorEvidenceList";
import {
  isArbitratorAuthorized,
  sanitizeEvidenceInput,
  fetchArbitratorEvidence,
  MOCK_EVIDENCE_DATASET,
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

    it("renders fallback warning screen when wallet is unauthorized", () => {
      render(
        <ArbitratorEvidenceList
          disputeId="disp-101"
          currentWalletAddress="GUNAUTHORIZED"
          authorizedArbitrators={["GARBITER1", "GARBITER2"]}
        />
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Only authorized arbiters assigned to this dispute can review submitted evidence/i)
      ).toBeInTheDocument();
      expect(screen.queryByTestId("arbitrator-evidence-list-container")).not.toBeInTheDocument();
    });

    it("renders full evidence panel when wallet is authorized", async () => {
      render(
        <ArbitratorEvidenceList
          disputeId="disp-101"
          currentWalletAddress="GARBITER1"
          authorizedArbitrators={["GARBITER1", "GARBITER2"]}
          initialEvidence={MOCK_EVIDENCE_DATASET}
        />
      );

      expect(screen.getByTestId("arbitrator-evidence-list-container")).toBeInTheDocument();
      expect(screen.queryByText(/Access Denied/i)).not.toBeInTheDocument();
    });
  });

  describe("Loading Skeletons (Issue #421)", () => {
    it("renders placeholder skeleton frames while loading data", () => {
      render(
        <ArbitratorEvidenceList
          disputeId="disp-101"
          currentWalletAddress="GARBITER1"
          authorizedArbitrators={["GARBITER1"]}
          isLoading={true}
        />
      );

      const skeletonContainer = screen.getByTestId("arbitrator-evidence-loading-skeletons");
      expect(skeletonContainer).toBeInTheDocument();
      expect(skeletonContainer).toHaveAttribute("aria-busy", "true");
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

    it("form ignores or rejects input containing code tags", () => {
      render(
        <ArbitratorEvidenceList
          disputeId="disp-101"
          currentWalletAddress="GARBITER1"
          authorizedArbitrators={["GARBITER1"]}
          initialEvidence={MOCK_EVIDENCE_DATASET}
        />
      );

      const titleInput = screen.getByPlaceholderText(/Evidence title/i);
      const submitBtn = screen.getByRole("button", { name: /Attach Note/i });

      // Enter only code tags
      fireEvent.change(titleInput, { target: { value: "<code>malicious code payload</code>" } });
      fireEvent.click(submitBtn);

      expect(screen.getByText(/Evidence title is required and cannot contain code tags/i)).toBeInTheDocument();
    });
  });

  describe("Data Mapping & Backend Query Bindings (Issue #423)", () => {
    it("fetchArbitratorEvidence returns mock dataset when backend API is unreachable", async () => {
      const data = await fetchArbitratorEvidence("disp-101");
      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty("disputeId", "disp-101");
      expect(data[0]).toHaveProperty("title");
      expect(data[0]).toHaveProperty("hash");
    });

    it("renders evidence items loaded from dataset", async () => {
      render(
        <ArbitratorEvidenceList
          disputeId="disp-101"
          currentWalletAddress="GARBITER1"
          authorizedArbitrators={["GARBITER1"]}
          initialEvidence={MOCK_EVIDENCE_DATASET}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Project Scope Specification v1.2")).toBeInTheDocument();
        expect(screen.getByText("Production Deployment Logs & Commit Proof")).toBeInTheDocument();
      });
    });

    it("allows filtering evidence items by submitter role", async () => {
      render(
        <ArbitratorEvidenceList
          disputeId="disp-101"
          currentWalletAddress="GARBITER1"
          authorizedArbitrators={["GARBITER1"]}
          initialEvidence={MOCK_EVIDENCE_DATASET}
        />
      );

      const clientFilterBtn = screen.getByRole("button", { name: /client Submissions/i });
      fireEvent.click(clientFilterBtn);

      expect(screen.getByText("Project Scope Specification v1.2")).toBeInTheDocument();
      expect(screen.queryByText("Production Deployment Logs & Commit Proof")).not.toBeInTheDocument();
    });
  });

  describe("Grid Layout Constraints (Issue #428)", () => {
    it("aligns each evidence row in a three-column grid on large screens", () => {
      render(
        <ArbitratorEvidenceList
          disputeId="disp-101"
          currentWalletAddress="GARBITER1"
          authorizedArbitrators={["GARBITER1"]}
          initialEvidence={MOCK_EVIDENCE_DATASET}
        />
      );

      const row = screen.getByTestId(`evidence-item-${MOCK_EVIDENCE_DATASET[0].id}`);
      expect(row).toHaveClass("grid", "grid-cols-1");
      expect(row.className).toMatch(/lg:grid-cols-\[minmax\(0,2fr\)_minmax\(0,3fr\)_minmax\(0,auto\)\]/);
      // Every direct grid child may shrink so long content cannot overflow the row.
      Array.from(row.children).forEach((child) => expect(child).toHaveClass("min-w-0"));
    });

    it("wraps long hashes and text instead of overflowing the row", () => {
      render(
        <ArbitratorEvidenceList
          disputeId="disp-101"
          currentWalletAddress="GARBITER1"
          authorizedArbitrators={["GARBITER1"]}
          initialEvidence={[{ ...MOCK_EVIDENCE_DATASET[0], hash: "0x" + "a".repeat(64) }]}
        />
      );

      expect(screen.getByText(/Hash: 0xa+/)).toHaveClass("break-all", "max-w-full");
      expect(screen.getByText(MOCK_EVIDENCE_DATASET[0].title)).toHaveClass("break-words");
    });
  });

  describe("Mock Integration Checks (Issue #429)", () => {
    it("renders a fetched dataset end to end through a mocked backend", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: MOCK_EVIDENCE_DATASET }) })
      );

      render(
        <ArbitratorEvidenceList
          disputeId="disp-101"
          currentWalletAddress="GARBITER1"
          authorizedArbitrators={["GARBITER1"]}
        />
      );

      expect(screen.getByTestId("arbitrator-evidence-loading-skeletons")).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId("arbitrator-evidence-list-container")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("arbitrator-evidence-loading-skeletons")).not.toBeInTheDocument();
      MOCK_EVIDENCE_DATASET.forEach((item) => {
        expect(screen.getByTestId(`evidence-item-${item.id}`)).toBeInTheDocument();
      });
    });

    it("fires onEvidenceVerified and filters by search query", () => {
      const onEvidenceVerified = vi.fn();
      render(
        <ArbitratorEvidenceList
          disputeId="disp-101"
          currentWalletAddress="GARBITER1"
          authorizedArbitrators={["GARBITER1"]}
          initialEvidence={MOCK_EVIDENCE_DATASET}
          onEvidenceVerified={onEvidenceVerified}
        />
      );

      fireEvent.click(screen.getAllByRole("button", { name: /Mark Verified|Verified/ })[0]);
      expect(onEvidenceVerified).toHaveBeenCalledWith(MOCK_EVIDENCE_DATASET[0].id);

      fireEvent.change(screen.getByPlaceholderText(/Search evidence/i), {
        target: { value: "no-such-evidence" },
      });
      expect(screen.getByText(/No evidence records found/i)).toBeInTheDocument();
    });
  });
});
