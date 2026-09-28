import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ArbitratorEvidenceList from "@/app/components/ArbitratorEvidenceList";
import {
  type EvidenceItem,
  EVIDENCE_STATE_BADGES,
  buildEvidenceCsv,
  escapeEvidenceCsvCell,
  evidenceExportFilename,
  getEvidenceBadge,
  getEvidenceConfirmCopy,
  getEvidenceState,
  handleEvidenceExport,
} from "@/app/lib/arbitrator_evidence_list";

const mockShowToast = vi.fn();
vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

const ARBITER = "GARBITER1";

function makeItem(overrides: Partial<EvidenceItem> = {}): EvidenceItem {
  return {
    id: "evi-001",
    disputeId: "disp-101",
    submittedBy: "GCLIENT",
    submitterRole: "client",
    title: "Scope Specification",
    description: "Signed agreement",
    fileUrl: "/evidence/scope.pdf",
    fileType: "application/pdf",
    fileSize: 2048,
    uploadedAt: "2026-09-20T10:15:00Z",
    hash: "0xabc123",
    verified: false,
    ...overrides,
  };
}

function renderList(
  items: EvidenceItem[],
  props: Partial<React.ComponentProps<typeof ArbitratorEvidenceList>> = {}
) {
  return render(
    <ArbitratorEvidenceList
      disputeId="disp-101"
      currentWalletAddress={ARBITER}
      authorizedArbitrators={[ARBITER]}
      initialEvidence={items}
      {...props}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ================================================================== *
 * Issue #427 — Export data button handlers
 * ================================================================== */

describe("Export data handlers (Issue #427)", () => {
  it("escapes CSV cells per RFC 4180", () => {
    expect(escapeEvidenceCsvCell("plain")).toBe("plain");
    expect(escapeEvidenceCsvCell("has,comma")).toBe('"has,comma"');
    expect(escapeEvidenceCsvCell('has"quote')).toBe('"has""quote"');
    expect(escapeEvidenceCsvCell("has\r\nnewline")).toBe('"has\r\nnewline"');
  });

  it("neutralises spreadsheet formula injection", () => {
    // A leading =, +, - or @ would otherwise execute when opened in Excel.
    expect(escapeEvidenceCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeEvidenceCsvCell("+SUM(A1)")).toBe("'+SUM(A1)");
    expect(escapeEvidenceCsvCell("-2")).toBe("'-2");
    expect(escapeEvidenceCsvCell("@cmd")).toBe("'@cmd");
  });

  it("builds CSV text with a header and correct cell values", () => {
    const csv = buildEvidenceCsv([
      makeItem({ id: "evi-001", title: "Scope", fileSize: 2048, verified: true }),
    ]);
    const [header, row] = csv.split("\r\n");

    expect(header).toContain("Evidence ID");
    expect(header).toContain("File Size (KB)");
    expect(header).toContain("Status");

    const cells = row.split(",");
    expect(cells[0]).toBe("evi-001");
    expect(cells[1]).toBe("disp-101");
    expect(cells[2]).toBe("Scope");
    // 2048 bytes renders as 2.0 KB
    expect(row).toContain("2.0");
    expect(row).toContain("Verified");
  });

  it("quotes values containing commas so columns stay aligned", () => {
    const csv = buildEvidenceCsv([
      makeItem({ title: "Logs, commits and proof" }),
    ]);
    expect(csv).toContain('"Logs, commits and proof"');
    // Header + exactly one data row.
    expect(csv.split("\r\n")).toHaveLength(2);
  });

  it("produces a timestamped filename scoped to the dispute", () => {
    const name = evidenceExportFilename("disp-101", new Date("2026-09-28T12:00:00Z"));
    expect(name).toBe("evidence-disp-101-2026-09-28.csv");
  });

  it("strips unsafe characters from the filename", () => {
    const name = evidenceExportFilename("../../etc/passwd", new Date("2026-09-28T00:00:00Z"));
    expect(name).toBe("evidence-etcpasswd-2026-09-28.csv");
  });

  it("returns false and downloads nothing for an empty set", () => {
    const createUrl = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: vi.fn() });

    expect(handleEvidenceExport([], "x.csv")).toBe(false);
    expect(createUrl).not.toHaveBeenCalled();
  });

  it("downloads a CSV blob containing the correct cell values", async () => {
    let blob: Blob | undefined;
    const createUrl = vi.fn((b: Blob) => ((blob = b), "blob:x"));
    vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: vi.fn() });

    let downloadName: string | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      downloadName = this.download;
    });

    const ok = handleEvidenceExport(
      [makeItem({ id: "evi-007", title: "Deploy Logs" })],
      "evidence.csv"
    );

    expect(ok).toBe(true);
    expect(downloadName).toBe("evidence.csv");
    expect(blob?.type).toContain("text/csv");

    const text = await blob!.text();
    expect(text).toContain("evi-007");
    expect(text).toContain("Deploy Logs");

    // Leading BOM so Excel decodes UTF-8 correctly. Asserted on the raw
    // bytes because Blob.text() runs a UTF-8 decode, which strips the BOM.
    const bytes = new Uint8Array(await blob!.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("exports the rows currently visible from the table view", async () => {
    let blob: Blob | undefined;
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((b: Blob) => ((blob = b), "blob:x")),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderList([
      makeItem({ id: "evi-001", title: "Client Doc", submitterRole: "client" }),
      makeItem({ id: "evi-002", title: "Freelancer Doc", submitterRole: "freelancer" }),
    ]);

    fireEvent.click(screen.getByTestId("evidence-export-button"));

    await waitFor(() => expect(blob).toBeDefined());
    const text = await blob!.text();
    expect(text).toContain("Client Doc");
    expect(text).toContain("Freelancer Doc");
  });

  it("exports only the filtered subset when a role filter is active", async () => {
    let blob: Blob | undefined;
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((b: Blob) => ((blob = b), "blob:x")),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderList([
      makeItem({ id: "evi-001", title: "Client Doc", submitterRole: "client" }),
      makeItem({ id: "evi-002", title: "Freelancer Doc", submitterRole: "freelancer" }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: /client submissions/i }));
    fireEvent.click(screen.getByTestId("evidence-export-button"));

    await waitFor(() => expect(blob).toBeDefined());
    const text = await blob!.text();
    expect(text).toContain("Client Doc");
    expect(text).not.toContain("Freelancer Doc");
  });
});

/* ================================================================== *
 * Issue #426 — Action toast warnings
 * ================================================================== */

describe("Action toast warnings (Issue #426)", () => {
  it("shows a success toast naming the exported row count", () => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:x"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderList([makeItem({ id: "evi-001" }), makeItem({ id: "evi-002" })]);
    fireEvent.click(screen.getByTestId("evidence-export-button"));

    expect(mockShowToast).toHaveBeenCalledWith(
      "Exported 2 evidence rows to CSV.",
      "success"
    );
  });

  it("uses the singular form for a one-row export", () => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:x"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    renderList([makeItem()]);
    fireEvent.click(screen.getByTestId("evidence-export-button"));

    expect(mockShowToast).toHaveBeenCalledWith(
      "Exported 1 evidence row to CSV.",
      "success"
    );
  });

  it("warns instead of downloading an empty file", () => {
    const createUrl = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: createUrl, revokeObjectURL: vi.fn() });

    renderList([makeItem({ submitterRole: "client" })]);
    // Filter to a role with no rows.
    fireEvent.click(screen.getByRole("button", { name: /freelancer submissions/i }));
    fireEvent.click(screen.getByTestId("evidence-export-button"));

    expect(mockShowToast).toHaveBeenCalledWith(
      "No evidence rows to export for the current filter.",
      "warning"
    );
    expect(createUrl).not.toHaveBeenCalled();
  });

  it("warns when the note form is submitted with an invalid title", () => {
    renderList([makeItem()]);

    fireEvent.click(screen.getByRole("button", { name: /attach note/i }));

    expect(mockShowToast).toHaveBeenCalledWith(
      "Evidence title is required and cannot contain code tags.",
      "warning"
    );
  });

  it("warns when a title is only script markup, which sanitises to empty", () => {
    renderList([makeItem()]);

    fireEvent.change(screen.getByPlaceholderText("Evidence title"), {
      target: { value: "<script>alert(1)</script>" },
    });
    fireEvent.click(screen.getByRole("button", { name: /attach note/i }));

    expect(mockShowToast).toHaveBeenCalledWith(
      "Evidence title is required and cannot contain code tags.",
      "warning"
    );
  });

  it("shows a success toast when a note is attached", () => {
    renderList([makeItem()]);

    fireEvent.change(screen.getByPlaceholderText("Evidence title"), {
      target: { value: "Arbiter summary" },
    });
    fireEvent.click(screen.getByRole("button", { name: /attach note/i }));

    expect(mockShowToast).toHaveBeenCalledWith(
      "Arbiter note attached to the dispute record.",
      "success"
    );
  });

  it("shows an error toast when the signing callback throws", () => {
    const onEvidenceVerified = vi.fn(() => {
      throw new Error("wallet rejected");
    });
    renderList([makeItem({ id: "evi-001" })], { onEvidenceVerified });

    fireEvent.click(screen.getByTestId("evidence-action-evi-001"));
    fireEvent.click(screen.getByTestId("evidence-confirm-acknowledge"));
    fireEvent.click(screen.getByTestId("evidence-confirm-submit"));

    expect(mockShowToast).toHaveBeenCalledWith(
      "Evidence decision failed: wallet rejected",
      "error"
    );
  });
});

/* ================================================================== *
 * Issue #425 — Validation modals
 * ================================================================== */

describe("Validation modals (Issue #425)", () => {
  it("builds distinct copy for verify and reject actions", () => {
    const verify = getEvidenceConfirmCopy({
      kind: "verify",
      evidenceId: "evi-001",
      evidenceTitle: "Scope",
    });
    const reject = getEvidenceConfirmCopy({
      kind: "reject",
      evidenceId: "evi-001",
      evidenceTitle: "Scope",
    });

    expect(verify.confirmLabel).toBe("Sign & Verify");
    expect(reject.confirmLabel).toBe("Sign & Reject");
    expect(verify.description).toContain("Scope");
    expect(reject.description).toContain("cannot be undone");
  });

  it("keeps the dialog closed until a row action is pressed", () => {
    renderList([makeItem({ id: "evi-001" })], { onEvidenceVerified: vi.fn() });
    expect(screen.queryByTestId("evidence-confirm-modal")).toBeNull();
  });

  it("opens an accessible dialog when a row action is pressed", () => {
    renderList([makeItem({ id: "evi-001" })], { onEvidenceVerified: vi.fn() });

    fireEvent.click(screen.getByTestId("evidence-action-evi-001"));

    const dialog = screen.getByTestId("evidence-confirm-modal");
    expect(dialog).toHaveAttribute("role", "dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("evidence-confirm-target")).toHaveTextContent("evi-001");
  });

  it("blocks submit until the acknowledgement is ticked", () => {
    const onEvidenceVerified = vi.fn();
    renderList([makeItem({ id: "evi-001" })], { onEvidenceVerified });

    fireEvent.click(screen.getByTestId("evidence-action-evi-001"));

    const submit = screen.getByTestId("evidence-confirm-submit");
    expect(submit).toBeDisabled();

    // Clicking while disabled must not reach the signing path.
    fireEvent.click(submit);
    expect(onEvidenceVerified).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("evidence-confirm-acknowledge"));
    expect(submit).toBeEnabled();
  });

  it("does not sign on the first click alone — two steps are required", () => {
    const onEvidenceVerified = vi.fn();
    renderList([makeItem({ id: "evi-001" })], { onEvidenceVerified });

    fireEvent.click(screen.getByTestId("evidence-action-evi-001"));
    expect(onEvidenceVerified).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("evidence-confirm-acknowledge"));
    fireEvent.click(screen.getByTestId("evidence-confirm-submit"));
    expect(onEvidenceVerified).toHaveBeenCalledWith("evi-001");
  });

  it("closes without signing when cancelled", () => {
    const onEvidenceVerified = vi.fn();
    renderList([makeItem({ id: "evi-001" })], { onEvidenceVerified });

    fireEvent.click(screen.getByTestId("evidence-action-evi-001"));
    fireEvent.click(screen.getByTestId("evidence-confirm-cancel"));

    expect(screen.queryByTestId("evidence-confirm-modal")).toBeNull();
    expect(onEvidenceVerified).not.toHaveBeenCalled();
  });

  it("resets the acknowledgement between separate actions", () => {
    renderList(
      [makeItem({ id: "evi-001" }), makeItem({ id: "evi-002" })],
      { onEvidenceVerified: vi.fn() }
    );

    fireEvent.click(screen.getByTestId("evidence-action-evi-001"));
    fireEvent.click(screen.getByTestId("evidence-confirm-acknowledge"));
    fireEvent.click(screen.getByTestId("evidence-confirm-cancel"));

    fireEvent.click(screen.getByTestId("evidence-action-evi-002"));
    expect(screen.getByTestId("evidence-confirm-submit")).toBeDisabled();
  });

  it("offers reject copy for an already-verified row", () => {
    renderList([makeItem({ id: "evi-001", verified: true })], {
      onEvidenceVerified: vi.fn(),
    });

    fireEvent.click(screen.getByTestId("evidence-action-evi-001"));
    expect(screen.getByTestId("evidence-confirm-submit")).toHaveTextContent(
      "Sign & Reject"
    );
  });
});

/* ================================================================== *
 * Issue #424 — State badges
 * ================================================================== */

describe("State badges (Issue #424)", () => {
  it("resolves verified rows to the verified state", () => {
    expect(getEvidenceState(makeItem({ verified: true }))).toBe("verified");
  });

  it("resolves unverified rows with a hash to pending", () => {
    expect(getEvidenceState(makeItem({ verified: false }))).toBe("pending");
  });

  it("resolves rows without a hash to unverified regardless of the flag", () => {
    // A missing hash means integrity cannot be checked, so it outranks the flag.
    expect(getEvidenceState(makeItem({ hash: "", verified: true }))).toBe("unverified");
    expect(getEvidenceState(makeItem({ hash: "   ", verified: true }))).toBe("unverified");
  });

  it("gives each state a distinct colour treatment", () => {
    const classes = Object.values(EVIDENCE_STATE_BADGES).map((b) => b.className);
    expect(new Set(classes).size).toBe(classes.length);
    expect(EVIDENCE_STATE_BADGES.verified.className).toContain("emerald");
    expect(EVIDENCE_STATE_BADGES.pending.className).toContain("amber");
    expect(EVIDENCE_STATE_BADGES.unverified.className).toContain("red");
  });

  it("maps an item straight to its badge descriptor", () => {
    expect(getEvidenceBadge(makeItem({ verified: true })).label).toBe("Verified");
    expect(getEvidenceBadge(makeItem({ verified: false })).label).toBe("Pending Review");
  });

  it("renders the matching marker for each row condition", () => {
    renderList([
      makeItem({ id: "evi-001", verified: true }),
      makeItem({ id: "evi-002", verified: false }),
      makeItem({ id: "evi-003", hash: "", verified: false }),
    ]);

    expect(screen.getByTestId("evidence-state-badge-evi-001")).toHaveTextContent(
      "Verified"
    );
    expect(screen.getByTestId("evidence-state-badge-evi-002")).toHaveTextContent(
      "Pending Review"
    );
    expect(screen.getByTestId("evidence-state-badge-evi-003")).toHaveTextContent(
      "Integrity Unverified"
    );
  });

  it("exposes the badge meaning to assistive technology", () => {
    renderList([makeItem({ id: "evi-001", verified: true })]);

    const badge = screen.getByTestId("evidence-state-badge-evi-001");
    expect(badge).toHaveAttribute("role", "status");
    expect(badge).toHaveAttribute(
      "aria-label",
      "Evidence verified by an arbiter"
    );
  });

  it("updates the badge after a decision is confirmed", () => {
    renderList([makeItem({ id: "evi-001", verified: false })], {
      onEvidenceVerified: vi.fn(),
    });

    expect(screen.getByTestId("evidence-state-badge-evi-001")).toHaveTextContent(
      "Pending Review"
    );

    fireEvent.click(screen.getByTestId("evidence-action-evi-001"));
    fireEvent.click(screen.getByTestId("evidence-confirm-acknowledge"));
    fireEvent.click(screen.getByTestId("evidence-confirm-submit"));

    expect(screen.getByTestId("evidence-state-badge-evi-001")).toHaveTextContent(
      "Verified"
    );
  });
});
