import { describe, expect, it } from "vitest";
import {
  FEE_CONFIG_GRID_CLASS,
  getFeeConfigColumns,
  getFeeConfigViewport,
} from "../app/lib/admin_fee_configuration_grid";

/** Inline mock layout of the fee configuration form. */
type MockField = { id: string; label: string; value: string };

function renderMockFeeForm(width: number, fields: MockField[]) {
  const columns = getFeeConfigColumns(getFeeConfigViewport(width));
  const rows: MockField[][] = [];
  for (let i = 0; i < fields.length; i += columns) {
    rows.push(fields.slice(i, i + columns));
  }
  return { className: FEE_CONFIG_GRID_CLASS, columns, rows };
}

const FIELDS: MockField[] = [
  { id: "fee-bps", label: "Fee (bps)", value: "250" },
  { id: "min-fee", label: "Minimum fee", value: "1" },
  { id: "max-fee", label: "Maximum fee", value: "500" },
  { id: "recipient", label: "Fee recipient", value: "GABC" },
];

describe("admin_fee_configuration mock integration", () => {
  it("renders every field exactly once", () => {
    const form = renderMockFeeForm(1280, FIELDS);
    expect(form.rows.flat().map((f) => f.id)).toEqual(FIELDS.map((f) => f.id));
  });

  it("never exceeds the column count per row", () => {
    for (const w of [320, 800, 1280]) {
      const form = renderMockFeeForm(w, FIELDS);
      for (const row of form.rows) {
        expect(row.length).toBeLessThanOrEqual(form.columns);
      }
    }
  });

  it("aligns fields in three columns on desktop", () => {
    const form = renderMockFeeForm(1280, FIELDS);
    expect(form.columns).toBe(3);
    expect(form.rows[0]).toHaveLength(3);
    expect(form.className).toContain("lg:grid-cols-3");
  });

  it("stacks fields on mobile", () => {
    const form = renderMockFeeForm(360, FIELDS);
    expect(form.rows).toHaveLength(FIELDS.length);
  });

  it("renders an empty form without rows", () => {
    expect(renderMockFeeForm(1280, []).rows).toEqual([]);
  });
});
