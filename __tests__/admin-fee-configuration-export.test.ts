import { describe, expect, it } from "vitest";
import {
  escapeCsvCell,
  feeExportFilename,
  feeRowsToCsv,
} from "@/app/lib/admin_fee_configuration_export";

describe("admin_fee_configuration export", () => {
  it("writes header and correct cell values", () => {
    const csv = feeRowsToCsv([{ token: "USDC", feeBps: 250, state: "active", updatedAt: "2026-01-01" }]);
    const [header, row] = csv.split("\r\n");
    expect(header).toBe("Token,Fee (bps),Fee (%),State,Updated At");
    expect(row).toBe("USDC,250,2.50,active,2026-01-01");
  });

  it("escapes quotes, commas and formulas", () => {
    expect(escapeCsvCell('a,"b"')).toBe('"a,""b"""');
    expect(escapeCsvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("builds a dated filename", () => {
    expect(feeExportFilename(new Date("2026-03-04T10:00:00Z"))).toBe("admin-fee-configuration-2026-03-04.csv");
  });
});
