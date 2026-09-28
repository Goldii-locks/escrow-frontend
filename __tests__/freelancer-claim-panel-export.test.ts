import { describe, expect, it, vi } from "vitest";
import {
  buildClaimCsv,
  claimExportFilename,
  escapeClaimCsvCell,
  handleClaimExport,
} from "@/app/lib/freelancer_claim_panel_export";

const rows = [
  { escrowId: "1", amount: "10.5", token: "USDC", status: "Ready" },
  { escrowId: "2", amount: 3, token: "=cmd", status: 'a,"b"' },
];

describe("freelancer_claim_panel export", () => {
  it("writes header and correct cell values", () => {
    expect(buildClaimCsv(rows).split("\r\n")).toEqual([
      "Escrow ID,Amount,Token,Status",
      "1,10.5,USDC,Ready",
      `2,3,'=cmd,"a,""b"""`,
    ]);
  });

  it("escapes cells and names files by date", () => {
    expect(escapeClaimCsvCell("x,y")).toBe('"x,y"');
    expect(claimExportFilename(new Date("2026-09-25T10:00:00Z"))).toBe(
      "freelancer-claims-2026-09-25.csv",
    );
  });

  it("downloads a file, and skips when empty", () => {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    expect(handleClaimExport([])).toBe(false);
    expect(click).not.toHaveBeenCalled();
    expect(handleClaimExport(rows, "f.csv")).toBe(true);
    expect(click).toHaveBeenCalledTimes(1);
  });
});
