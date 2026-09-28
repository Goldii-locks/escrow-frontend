import { describe, expect, it, vi } from "vitest";
import {
  REFUND_EXPORT_HEADERS,
  buildRefundCsv,
  escapeRefundCsvCell,
  handleRefundExport,
  refundExportFilename,
} from "@/app/lib/client_refund_panel_export";

const rows = [
  { escrowId: "ABC-1", amount: "50.00", token: "USDC", status: "pending_refund", requestedAt: "2026-09-01" },
  { escrowId: "ABC-2", amount: 10, token: "=XLM", status: 'refund_approved,"ok"' },
];

describe("client_refund_panel export", () => {
  it("includes header row with all expected columns", () => {
    expect(REFUND_EXPORT_HEADERS).toEqual([
      "Escrow ID",
      "Amount",
      "Token",
      "Status",
      "Requested At",
    ]);
  });

  it("writes header and correct cell values", () => {
    const lines = buildRefundCsv(rows).split("\r\n");
    expect(lines[0]).toBe("Escrow ID,Amount,Token,Status,Requested At");
    expect(lines[1]).toBe("ABC-1,50.00,USDC,pending_refund,2026-09-01");
    // formula injection prefix and quoted comma/quote in status
    expect(lines[2]).toContain("'=XLM");
    expect(lines[2]).toContain('"refund_approved,""ok"""');
  });

  it("missing requestedAt renders as empty string", () => {
    const csv = buildRefundCsv([
      { escrowId: "Z1", amount: 1, token: "USDC", status: "pending_refund" },
    ]);
    // Last cell in second line should be empty (ends with comma followed by CRLF or end)
    const row = csv.split("\r\n")[1];
    expect(row).toMatch(/,$/);
  });

  it("escapes cells: quotes, commas and formula injection", () => {
    expect(escapeRefundCsvCell('a,"b"')).toBe('"a,""b"""');
    expect(escapeRefundCsvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeRefundCsvCell("+BAD")).toBe("'+BAD");
    expect(escapeRefundCsvCell(undefined)).toBe("");
    expect(escapeRefundCsvCell(null)).toBe("");
  });

  it("generates a dated filename", () => {
    expect(refundExportFilename(new Date("2026-09-28T10:00:00Z"))).toBe(
      "client-refunds-2026-09-28.csv",
    );
  });

  it("downloads a file, and skips when empty", () => {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    expect(handleRefundExport([])).toBe(false);
    expect(click).not.toHaveBeenCalled();

    expect(handleRefundExport(rows, "test-refunds.csv")).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("revokes the object URL after download", () => {
    URL.createObjectURL = vi.fn(() => "blob:y");
    const revoke = vi.fn();
    URL.revokeObjectURL = revoke;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    handleRefundExport(rows, "revoke-test.csv");
    expect(revoke).toHaveBeenCalledWith("blob:y");
  });
});
