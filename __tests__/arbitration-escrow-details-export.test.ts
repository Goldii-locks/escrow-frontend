import { describe, expect, it, vi } from "vitest";
import { MOCK_ARBITRATION_ESCROW_DETAILS } from "@/app/lib/arbitration_escrow_details";
import {
  ARBITRATION_EXPORT_HEADERS,
  arbitrationExportFilename,
  buildArbitrationCsv,
  escapeArbitrationCsvCell,
  handleArbitrationExport,
} from "@/app/lib/arbitration_escrow_details_export";

describe("arbitration_escrow_details export helpers (#487)", () => {
  it("escapes cells and neutralises spreadsheet formulas", () => {
    // The comma forces RFC 4180 quoting around the neutralised formula.
    expect(escapeArbitrationCsvCell("=SUM(1,2)")).toBe(`"'=SUM(1,2)"`);
    expect(escapeArbitrationCsvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeArbitrationCsvCell("+CMD")).toBe("'+CMD");
    expect(escapeArbitrationCsvCell("-100")).toBe("'-100");
    expect(escapeArbitrationCsvCell("@ADMIN")).toBe("'@ADMIN");
    expect(escapeArbitrationCsvCell('hello "world"')).toBe('"hello ""world"""');
    expect(escapeArbitrationCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeArbitrationCsvCell(null)).toBe("");
  });

  it("builds valid CSV with headers and row values", () => {
    const csv = buildArbitrationCsv([MOCK_ARBITRATION_ESCROW_DETAILS]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(ARBITRATION_EXPORT_HEADERS.join(","));
    expect(lines[1]).toContain(MOCK_ARBITRATION_ESCROW_DETAILS.escrowId);
    expect(lines[1]).toContain(MOCK_ARBITRATION_ESCROW_DETAILS.disputeId);
    expect(lines[1]).toContain(MOCK_ARBITRATION_ESCROW_DETAILS.token);
  });

  it("generates timestamped export filenames", () => {
    const date = new Date("2026-09-28T12:00:00Z");
    expect(arbitrationExportFilename("DIS-123", date)).toBe(
      "arbitration-escrow-DIS-123-2026-09-28.csv",
    );
  });

  it("handles empty export gracefully", () => {
    expect(handleArbitrationExport([])).toBe(false);
  });

  it("triggers browser download for non-empty records", () => {
    const createElementSpy = vi.spyOn(document, "createElement");
    const appendChildSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation((node) => node);
    const removeChildSpy = vi
      .spyOn(document.body, "removeChild")
      .mockImplementation((node) => node);

    const success = handleArbitrationExport([MOCK_ARBITRATION_ESCROW_DETAILS]);
    expect(success).toBe(true);
    expect(createElementSpy).toHaveBeenCalledWith("a");

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});
