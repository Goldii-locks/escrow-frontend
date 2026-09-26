import { describe, expect, it } from "vitest";
import {
  FEE_CONFIG_GRID_CLASS,
  FEE_CONFIG_MAX_WIDTH,
  getFeeConfigColumnWidth,
  getFeeConfigColumns,
  getFeeConfigSpanClass,
  getFeeConfigViewport,
} from "../app/lib/admin_fee_configuration_grid";

describe("admin_fee_configuration grid", () => {
  it("classifies viewports", () => {
    expect(getFeeConfigViewport(320)).toBe("mobile");
    expect(getFeeConfigViewport(639)).toBe("mobile");
    expect(getFeeConfigViewport(640)).toBe("tablet");
    expect(getFeeConfigViewport(1023)).toBe("tablet");
    expect(getFeeConfigViewport(1024)).toBe("desktop");
    expect(getFeeConfigViewport(NaN)).toBe("mobile");
    expect(getFeeConfigViewport(-5)).toBe("mobile");
  });

  it("maps viewports to columns", () => {
    expect(getFeeConfigColumns("mobile")).toBe(1);
    expect(getFeeConfigColumns("tablet")).toBe(2);
    expect(getFeeConfigColumns("desktop")).toBe(3);
  });

  it("uses responsive grid classes", () => {
    expect(FEE_CONFIG_GRID_CLASS).toContain("grid-cols-1");
    expect(FEE_CONFIG_GRID_CLASS).toContain("sm:grid-cols-2");
    expect(FEE_CONFIG_GRID_CLASS).toContain("lg:grid-cols-3");
  });

  it("clamps spans to available columns", () => {
    expect(getFeeConfigSpanClass(5, 2)).toBe("col-span-2");
    expect(getFeeConfigSpanClass(0, 3)).toBe("col-span-1");
    expect(getFeeConfigSpanClass(NaN, 3)).toBe("col-span-1");
  });

  it("keeps columns within the container", () => {
    for (const w of [320, 700, 1024, 1600, 3000]) {
      const cols = getFeeConfigColumns(getFeeConfigViewport(w));
      const total = getFeeConfigColumnWidth(w) * cols + 16 * (cols - 1);
      expect(total).toBeLessThanOrEqual(Math.min(w, FEE_CONFIG_MAX_WIDTH));
    }
  });
});
