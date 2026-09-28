import { describe, expect, it } from "vitest";
import {
  ARBITRATION_DESKTOP_MIN_WIDTH,
  ARBITRATION_GRID_CLASS,
  ARBITRATION_TABLET_MIN_WIDTH,
  getArbitrationColumnWidth,
  getArbitrationColumns,
  getArbitrationSpanClass,
  getArbitrationViewport,
} from "@/app/lib/arbitration_escrow_details_grid";

describe("arbitration_escrow_details grid sizing constraints (#488)", () => {
  it("determines viewport based on container width constraints", () => {
    expect(getArbitrationViewport(320)).toBe("mobile");
    expect(getArbitrationViewport(ARBITRATION_TABLET_MIN_WIDTH)).toBe("tablet");
    expect(getArbitrationViewport(800)).toBe("tablet");
    expect(getArbitrationViewport(ARBITRATION_DESKTOP_MIN_WIDTH)).toBe(
      "desktop",
    );
    expect(getArbitrationViewport(1440)).toBe("desktop");
    expect(getArbitrationViewport(NaN)).toBe("mobile");
  });

  it("assigns responsive column counts", () => {
    expect(getArbitrationColumns("mobile")).toBe(1);
    expect(getArbitrationColumns("tablet")).toBe(2);
    expect(getArbitrationColumns("desktop")).toBe(3);
  });

  it("calculates safe column span classes that do not wrap out of bounds", () => {
    expect(getArbitrationSpanClass(1, 3)).toBe("col-span-1");
    expect(getArbitrationSpanClass(2, 2)).toBe("col-span-2");
    expect(getArbitrationSpanClass(5, 3)).toBe("col-span-3");
    expect(getArbitrationSpanClass(0, 2)).toBe("col-span-1");
  });

  it("calculates positive column widths without overflow", () => {
    const colWidthMobile = getArbitrationColumnWidth(500);
    expect(colWidthMobile).toBe(500);

    const colWidthDesktop = getArbitrationColumnWidth(1200, 16);
    expect(colWidthDesktop).toBeGreaterThan(0);
    expect(colWidthDesktop * 3 + 16 * 2).toBeLessThanOrEqual(1200);
  });

  it("includes responsive grid class definition", () => {
    expect(ARBITRATION_GRID_CLASS).toContain("grid-cols-1");
    expect(ARBITRATION_GRID_CLASS).toContain("sm:grid-cols-2");
    expect(ARBITRATION_GRID_CLASS).toContain("lg:grid-cols-3");
  });
});
