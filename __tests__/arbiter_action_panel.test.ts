/**
 * Unit tests for the pure helpers in `app/lib/arbiter_action_panel.ts`:
 * viewport classification, structural layout, resolution validation,
 * configuration checks, and WCAG colour-contrast maths.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ARBITER_CONFIRMATION_REQUIRED_ERROR,
  ARBITER_NO_FUNDS_ERROR,
  ARBITER_NO_HANDLER_ERROR,
  ARBITER_OUTCOME_REQUIRED_ERROR,
  ARBITER_PANEL_CONTRAST_PAIRS,
  ARBITER_PANEL_DESKTOP_MIN_WIDTH,
  ARBITER_PANEL_TABLET_MIN_WIDTH,
  ARBITER_PANEL_TOKENS,
  classifyArbiterPanelViewport,
  contrastRatio,
  getArbiterPanelConfigError,
  getArbiterPanelLayout,
  readArbiterPanelViewportWidth,
  relativeLuminance,
  validateArbiterResolution,
} from "@/app/lib/arbiter_action_panel";

describe("classifyArbiterPanelViewport", () => {
  it.each([
    [0, "mobile"],
    [320, "mobile"],
    [ARBITER_PANEL_TABLET_MIN_WIDTH - 1, "mobile"],
    [ARBITER_PANEL_TABLET_MIN_WIDTH, "tablet"],
    [768, "tablet"],
    [ARBITER_PANEL_DESKTOP_MIN_WIDTH - 1, "tablet"],
    [ARBITER_PANEL_DESKTOP_MIN_WIDTH, "desktop"],
    [1920, "desktop"],
  ] as const)("classifies %ipx as %s", (width, expected) => {
    expect(classifyArbiterPanelViewport(width)).toBe(expected);
  });

  it.each([NaN, -1, Infinity, -Infinity])(
    "falls back to mobile for invalid width %s",
    (width) => {
      expect(classifyArbiterPanelViewport(width)).toBe("mobile");
    },
  );

  it("aligns breakpoints with Tailwind sm and lg", () => {
    expect(ARBITER_PANEL_TABLET_MIN_WIDTH).toBe(640);
    expect(ARBITER_PANEL_DESKTOP_MIN_WIDTH).toBe(1024);
  });
});

describe("getArbiterPanelLayout", () => {
  it("stacks everything on mobile", () => {
    expect(getArbiterPanelLayout("mobile")).toEqual({
      viewport: "mobile",
      outcomeColumns: 1,
      stackActions: true,
      fullWidthActions: true,
      constrainHeight: true,
    });
  });

  it.each(["tablet", "desktop"] as const)("un-stacks on %s", (viewport) => {
    expect(getArbiterPanelLayout(viewport)).toEqual({
      viewport,
      outcomeColumns: 2,
      stackActions: false,
      fullWidthActions: false,
      constrainHeight: false,
    });
  });
});

describe("readArbiterPanelViewportWidth", () => {
  const original = window.innerWidth;
  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: original,
    });
    vi.restoreAllMocks();
  });

  it("returns window.innerWidth", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 777,
    });
    expect(readArbiterPanelViewportWidth()).toBe(777);
  });

  it("returns 0 and warns when the read throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      get() {
        throw new Error("boom");
      },
    });
    expect(readArbiterPanelViewportWidth()).toBe(0);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[arbiter_action_panel]"),
      "boom",
    );
  });
});

describe("validateArbiterResolution", () => {
  it("accepts a chosen outcome with confirmation", () => {
    expect(validateArbiterResolution({ outcome: "release", confirmed: true })).toEqual({
      valid: true,
      errors: {},
    });
    expect(validateArbiterResolution({ outcome: "refund", confirmed: true }).valid).toBe(
      true,
    );
  });

  it("reports every missing field at once", () => {
    expect(validateArbiterResolution({ outcome: null, confirmed: false })).toEqual({
      valid: false,
      errors: {
        outcome: ARBITER_OUTCOME_REQUIRED_ERROR,
        confirmation: ARBITER_CONFIRMATION_REQUIRED_ERROR,
      },
    });
  });

  it("flags a missing outcome only", () => {
    const result = validateArbiterResolution({ outcome: undefined, confirmed: true });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual({ outcome: ARBITER_OUTCOME_REQUIRED_ERROR });
  });

  it("flags a missing confirmation only", () => {
    const result = validateArbiterResolution({ outcome: "refund", confirmed: false });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual({ confirmation: ARBITER_CONFIRMATION_REQUIRED_ERROR });
  });

  it("rejects an unknown outcome value", () => {
    const result = validateArbiterResolution({
      outcome: "split" as unknown as "release",
      confirmed: true,
    });
    expect(result.errors.outcome).toBe(ARBITER_OUTCOME_REQUIRED_ERROR);
  });
});

describe("getArbiterPanelConfigError", () => {
  it("requires a handler", () => {
    expect(getArbiterPanelConfigError({ hasHandler: false, escrowAmount: "100" })).toBe(
      ARBITER_NO_HANDLER_ERROR,
    );
  });

  it.each(["0", "-5", " 0 "])("blocks when escrow amount is %j", (amount) => {
    expect(getArbiterPanelConfigError({ hasHandler: true, escrowAmount: amount })).toBe(
      ARBITER_NO_FUNDS_ERROR,
    );
  });

  it.each([undefined, null, "", "not-a-number", "1.5", "1", "300000000"])(
    "does not block for escrow amount %j",
    (amount) => {
      expect(
        getArbiterPanelConfigError({ hasHandler: true, escrowAmount: amount }),
      ).toBeNull();
    },
  );

  it("reports the missing handler before missing funds", () => {
    expect(getArbiterPanelConfigError({ hasHandler: false, escrowAmount: "0" })).toBe(
      ARBITER_NO_HANDLER_ERROR,
    );
  });
});

describe("contrast maths", () => {
  it("matches the WCAG reference values", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#818cf8", "#111827")).toBeCloseTo(
      contrastRatio("#111827", "#818cf8"),
      10,
    );
  });

  it("rejects malformed colours", () => {
    expect(() => relativeLuminance("red")).toThrow(/invalid hex colour/);
    expect(() => relativeLuminance("#12345")).toThrow(/invalid hex colour/);
  });
});

describe("colour contrast compliance", () => {
  const globalsCss = readFileSync(resolve(__dirname, "../app/globals.css"), "utf8");

  it.each(Object.entries(ARBITER_PANEL_TOKENS))(
    "token %s mirrors globals.css",
    (token, hex) => {
      const match = globalsCss.match(
        new RegExp(`--color-${token}:\\s*(#[0-9a-fA-F]{3,6})\\s*;`),
      );
      expect(match, `--color-${token} missing from globals.css`).not.toBeNull();
      expect(match![1].toLowerCase()).toBe(hex);
    },
  );

  it.each(ARBITER_PANEL_CONTRAST_PAIRS.map((pair) => [pair.usage, pair] as const))(
    "%s meets its WCAG AA minimum",
    (_usage, pair) => {
      const ratio = contrastRatio(
        ARBITER_PANEL_TOKENS[pair.foreground],
        ARBITER_PANEL_TOKENS[pair.background],
      );
      expect(ratio).toBeGreaterThanOrEqual(pair.minRatio);
    },
  );
});
