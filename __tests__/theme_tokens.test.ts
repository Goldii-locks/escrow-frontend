/**
 * Unit tests for the shared theme-token and contrast helpers in
 * `app/lib/theme_tokens.ts`.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  blendOver,
  classifyClassString,
  classifyColourUtility,
  contrastRatio,
  parseThemeColourTokens,
  relativeLuminance,
} from "@/app/lib/theme_tokens";

const TOKENS = new Set(["surface-card", "accent-soft", "text-muted", "danger-soft"]);

describe("contrast maths", () => {
  it("matches WCAG reference values", () => {
    expect(relativeLuminance("#000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });

  it("rejects malformed colours", () => {
    expect(() => relativeLuminance("blue")).toThrow(/invalid hex colour/);
  });

  it("blends colours over a backdrop", () => {
    expect(blendOver("#ffffff", 1, "#000000")).toBe("#ffffff");
    expect(blendOver("#ffffff", 0, "#000000")).toBe("#000000");
    expect(blendOver("#ffffff", 0.5, "#000000")).toBe("#808080");
    expect(blendOver("#ffffff", 2, "#000000")).toBe("#ffffff");
  });
});

describe("classifyColourUtility", () => {
  it.each([
    ["bg-surface-card", "surface-card"],
    ["text-text-muted", "text-muted"],
    ["hover:border-accent-soft/60", "accent-soft"],
    ["has-[:focus-visible]:ring-accent-soft", "accent-soft"],
    ["focus-visible:ring-offset-surface-card", "surface-card"],
    ["!border-danger-soft", "danger-soft"],
    ["data-[state=invalid]:border-danger-soft/40", "danger-soft"],
    ["accent-accent-soft", "accent-soft"],
    ["bg-[var(--color-surface-card)]", "surface-card"],
  ])("%s → token %s", (cls, token) => {
    expect(classifyColourUtility(cls, TOKENS)).toMatchObject({ kind: "token", token });
  });

  it.each([
    "text-sm",
    "text-center",
    "border",
    "border-t",
    "border-dashed",
    "ring-2",
    "ring-offset-2",
    "outline-none",
    "bg-transparent",
    "text-[10px]",
    "shadow-lg",
  ])("%s is a non-colour utility", (cls) => {
    expect(classifyColourUtility(cls, TOKENS)).toMatchObject({ kind: "non-colour" });
  });

  it.each(["bg-gray-800", "text-white", "border-[#111827]", "bg-[var(--color-nope)]", "ring-indigo-500/20"])(
    "%s is off-palette",
    (cls) => {
      expect(classifyColourUtility(cls, TOKENS)).toMatchObject({ kind: "off-palette" });
    },
  );

  it.each(["flex", "rounded-lg", "min-h-[44px]", "sm:grid-cols-2", "animate-fade-in"])(
    "%s is not a colour utility",
    (cls) => {
      expect(classifyColourUtility(cls, TOKENS)).toBeNull();
    },
  );

  it("classifies whole class strings, skipping non-colour classes", () => {
    const result = classifyClassString("flex bg-surface-card text-sm text-white", TOKENS);
    expect(result.map((r) => r.kind)).toEqual(["token", "non-colour", "off-palette"]);
  });
});

describe("parseThemeColourTokens", () => {
  it("reads --color-* declarations from @theme blocks only", () => {
    const css = `
      :root { --color-ignored: #000; }
      @theme inline {
        --color-surface-card: #111827;
        --color-Accent: #FFF;
        --font-sans: x;
      }
      @theme { --color-extra: #ABCDEF; }
    `;
    const tokens = parseThemeColourTokens(css);
    expect(tokens.get("surface-card")).toBe("#111827");
    expect(tokens.get("extra")).toBe("#abcdef");
    expect(tokens.has("ignored")).toBe(false);
    expect(tokens.has("sans")).toBe(false);
  });

  it("parses the project's globals.css", () => {
    const tokens = parseThemeColourTokens(
      readFileSync(resolve(__dirname, "../app/globals.css"), "utf8"),
    );
    expect(tokens.get("surface-card")).toBe("#111827");
    expect(tokens.get("accent-soft")).toBe("#818cf8");
  });
});
