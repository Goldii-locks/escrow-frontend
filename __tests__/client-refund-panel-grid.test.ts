import { describe, expect, it } from "vitest";
import {
  REFUND_PANEL_GRID,
  REFUND_PANEL_GRID_CLASS,
  REFUND_PANEL_MAX_WIDTH,
  getRefundPanelColumnWidth,
  getRefundPanelColumns,
  getRefundPanelSpanClass,
  getRefundPanelViewport,
  refundPanelGridItemStyle,
  refundPanelGridStyle,
} from "@/app/lib/client_refund_panel_grid";

describe("getRefundPanelViewport", () => {
  it("classifies viewports correctly", () => {
    expect(getRefundPanelViewport(320)).toBe("mobile");
    expect(getRefundPanelViewport(639)).toBe("mobile");
    expect(getRefundPanelViewport(640)).toBe("tablet");
    expect(getRefundPanelViewport(1023)).toBe("tablet");
    expect(getRefundPanelViewport(1024)).toBe("desktop");
    expect(getRefundPanelViewport(1920)).toBe("desktop");
  });

  it("falls back to mobile for non-finite or negative inputs", () => {
    expect(getRefundPanelViewport(NaN)).toBe("mobile");
    expect(getRefundPanelViewport(-5)).toBe("mobile");
    expect(getRefundPanelViewport(Infinity)).toBe("desktop");
  });
});

describe("getRefundPanelColumns", () => {
  it("maps viewports to correct column counts", () => {
    expect(getRefundPanelColumns("mobile")).toBe(1);
    expect(getRefundPanelColumns("tablet")).toBe(2);
    expect(getRefundPanelColumns("desktop")).toBe(3);
  });
});

describe("REFUND_PANEL_GRID_CLASS", () => {
  it("uses responsive grid classes including sm and lg breakpoints", () => {
    expect(REFUND_PANEL_GRID_CLASS).toContain("grid-cols-1");
    expect(REFUND_PANEL_GRID_CLASS).toContain("sm:grid-cols-2");
    expect(REFUND_PANEL_GRID_CLASS).toContain("lg:grid-cols-3");
  });
});

describe("getRefundPanelSpanClass", () => {
  it("clamps spans to available columns", () => {
    expect(getRefundPanelSpanClass(5, 2)).toBe("col-span-2");
    expect(getRefundPanelSpanClass(0, 3)).toBe("col-span-1");
    expect(getRefundPanelSpanClass(NaN, 3)).toBe("col-span-1");
    expect(getRefundPanelSpanClass(2, 3)).toBe("col-span-2");
    expect(getRefundPanelSpanClass(3, 3)).toBe("col-span-3");
  });
});

describe("refundPanelGridStyle", () => {
  it("uses an auto-fit grid bounded by min column and max width", () => {
    expect(refundPanelGridStyle.display).toBe("grid");
    expect(refundPanelGridStyle.gridTemplateColumns).toContain("auto-fit");
    expect(refundPanelGridStyle.gridTemplateColumns).toContain(
      `min(100%, ${REFUND_PANEL_GRID.columnMin})`,
    );
    expect(refundPanelGridStyle.maxWidth).toBe("72rem");
  });
});

describe("refundPanelGridItemStyle", () => {
  it("lets items shrink and wrap inside their cell", () => {
    expect(refundPanelGridItemStyle.minWidth).toBe(0);
    expect(refundPanelGridItemStyle.overflowWrap).toBe("anywhere");
  });
});

describe("getRefundPanelColumnWidth", () => {
  it("keeps columns within the container at all viewport sizes", () => {
    for (const w of [320, 700, 1024, 1600, 3000]) {
      const viewport = getRefundPanelViewport(w);
      const cols = getRefundPanelColumns(viewport);
      const total = getRefundPanelColumnWidth(w) * cols + 16 * (cols - 1);
      expect(total).toBeLessThanOrEqual(Math.min(w, REFUND_PANEL_MAX_WIDTH));
    }
  });
});
