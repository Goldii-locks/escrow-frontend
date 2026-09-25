/**
 * Design-variable linkage for ArbiterActionPanel.
 *
 * Every colour utility the panel allocates — in its class maps and in the
 * DOM it actually renders, across every state — must resolve to a token
 * declared in the `@theme` block of `app/globals.css`, and the panel's hex
 * mirror of those tokens must match the config exactly.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ArbiterActionPanel from "@/app/components/ArbiterActionPanel";
import {
  ARBITER_PANEL_CLASS_MAPS,
  ARBITER_PANEL_CONTRAST_PAIRS,
  ARBITER_PANEL_TOKENS,
  ARBITER_SUBMIT_TONE,
} from "@/app/lib/arbiter_action_panel";
import {
  WCAG_AA_NORMAL_TEXT,
  blendOver,
  classifyClassString,
  contrastRatio,
  parseThemeColourTokens,
} from "@/app/lib/theme_tokens";

const theme = parseThemeColourTokens(
  readFileSync(resolve(__dirname, "../app/globals.css"), "utf8"),
);
const themeNames = new Set(theme.keys());

/** Flattens every class string in the panel's class maps. */
const allMapEntries = Object.entries(ARBITER_PANEL_CLASS_MAPS).flatMap(([map, entries]) =>
  Object.entries(entries).map(([key, classes]) => [`${map}.${key}`, classes as string] as const),
);

/** Class strings of every rendered node, excluding shared child components. */
function renderedClassStrings(root: HTMLElement): string[] {
  const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  return nodes
    .filter(
      (el) =>
        // TxStatusBanner and ButtonSpinner are shared components with their
        // own styling; this suite covers the panel's own allocations.
        !el.closest("[data-testid='arbiter-panel-status']") &&
        !el.closest("[data-testid='button-spinner']"),
    )
    .map((el) => el.getAttribute("class") ?? "")
    .filter(Boolean);
}

describe("config file", () => {
  it("declares colour tokens in globals.css", () => {
    expect(theme.size).toBeGreaterThan(10);
  });

  it.each(Object.entries(ARBITER_PANEL_TOKENS))(
    "panel token %s matches its @theme value",
    (token, hex) => {
      expect(theme.get(token), `--color-${token} missing from @theme`).toBe(hex);
    },
  );
});

describe("class maps", () => {
  it.each(allMapEntries)("%s uses only theme tokens for colour", (_name, classes) => {
    const offPalette = classifyClassString(classes, themeNames).filter(
      (c) => c.kind === "off-palette",
    );
    expect(offPalette.map((c) => c.utility)).toEqual([]);
  });

  it("every token the maps reference is mirrored in ARBITER_PANEL_TOKENS", () => {
    const referenced = new Set(
      allMapEntries.flatMap(([, classes]) =>
        classifyClassString(classes, themeNames)
          .filter((c) => c.kind === "token")
          .map((c) => (c as { token: string }).token),
      ),
    );
    const mirrored = new Set(Object.keys(ARBITER_PANEL_TOKENS));
    expect([...referenced].filter((t) => !mirrored.has(t))).toEqual([]);
  });

  it("every contrast pair references mirrored tokens", () => {
    ARBITER_PANEL_CONTRAST_PAIRS.forEach(({ foreground, background }) => {
      expect(ARBITER_PANEL_TOKENS[foreground]).toBeDefined();
      expect(ARBITER_PANEL_TOKENS[background]).toBeDefined();
    });
  });

  it("uses no raw hex, rgb or stock palette colours anywhere", () => {
    allMapEntries.forEach(([, classes]) => {
      expect(classes).not.toMatch(/#[0-9a-f]{3,6}\b/i);
      expect(classes).not.toMatch(/rgba?\(/);
      expect(classes).not.toMatch(/\b(?:bg|text|border|ring)-(?:gray|white|black|indigo|red|green)\b/);
    });
  });
});

describe("rendered DOM matches the colour scheme", () => {
  const assertOnPalette = () => {
    const classes = renderedClassStrings(screen.getByTestId("arbiter-action-panel"));
    expect(classes.length).toBeGreaterThan(5);
    const offPalette = classes
      .flatMap((c) => classifyClassString(c, themeNames))
      .filter((c) => c.kind === "off-palette")
      .map((c) => c.utility);
    expect(offPalette).toEqual([]);
  };

  it("at rest", () => {
    render(<ArbiterActionPanel milestoneIndex={0} onResolve={vi.fn()} />);
    assertOnPalette();
  });

  it("with field errors showing", async () => {
    const user = userEvent.setup();
    render(<ArbiterActionPanel milestoneIndex={0} onResolve={vi.fn()} />);
    await user.click(screen.getByTestId("arbiter-submit"));
    assertOnPalette();
  });

  it.each(["release", "refund"])("with the %s outcome chosen", async (value) => {
    const user = userEvent.setup();
    render(<ArbiterActionPanel milestoneIndex={0} onResolve={vi.fn()} />);
    await user.click(screen.getByTestId(`arbiter-outcome-${value}`));
    await user.click(screen.getByRole("checkbox"));
    assertOnPalette();
  });

  it("when blocked by configuration", () => {
    render(<ArbiterActionPanel milestoneIndex={0} />);
    assertOnPalette();
  });

  it("while pending", () => {
    render(<ArbiterActionPanel milestoneIndex={0} onResolve={vi.fn()} isPending />);
    assertOnPalette();
  });

  it("as the empty-state placeholder", () => {
    render(<ArbiterActionPanel milestoneIndex={null} />);
    const classes = renderedClassStrings(screen.getByTestId("arbiter-panel-placeholder"));
    const offPalette = classes
      .flatMap((c) => classifyClassString(c, themeNames))
      .filter((c) => c.kind === "off-palette");
    expect(offPalette).toEqual([]);
  });

  it("renders the legend and option text from the class config, not inline colours", () => {
    render(<ArbiterActionPanel milestoneIndex={0} onResolve={vi.fn()} />);
    expect(screen.getByText("Outcome")).toHaveClass("text-text-secondary");
    expect(screen.getByText("Release to Freelancer")).toHaveClass("text-text-primary");
    expect(screen.getByText("Pay the disputed funds to the freelancer.")).toHaveClass(
      "text-text-muted",
    );
  });
});

describe("hover states keep AA contrast", () => {
  const card = ARBITER_PANEL_TOKENS["surface-card"];

  it("release submit hovers to the lighter success-soft token", () => {
    expect(ARBITER_SUBMIT_TONE.release).toContain("hover:bg-success-soft");
    expect(
      contrastRatio(ARBITER_PANEL_TOKENS["surface-page"], ARBITER_PANEL_TOKENS["success-soft"]),
    ).toBeGreaterThanOrEqual(WCAG_AA_NORMAL_TEXT);
  });

  it("the previous release hover (success/80) fell below AA", () => {
    const hovered = blendOver(ARBITER_PANEL_TOKENS.success, 0.8, card);
    expect(contrastRatio(ARBITER_PANEL_TOKENS["surface-page"], hovered)).toBeLessThan(
      WCAG_AA_NORMAL_TEXT,
    );
  });

  it.each([
    ["refund", "text-primary", "danger"],
    ["none", "text-primary", "accent"],
  ] as const)("%s submit at /80 hover", (tone, fg, bg) => {
    expect(ARBITER_SUBMIT_TONE[tone]).toContain(`hover:bg-${bg}/80`);
    const hovered = blendOver(ARBITER_PANEL_TOKENS[bg], 0.8, card);
    expect(contrastRatio(ARBITER_PANEL_TOKENS[fg], hovered)).toBeGreaterThanOrEqual(
      WCAG_AA_NORMAL_TEXT,
    );
  });

  it("no longer hovers the neutral button to accent-hover, which fails AA", () => {
    expect(ARBITER_SUBMIT_TONE.none).not.toContain("accent-hover");
    const accentHover = theme.get("accent-hover")!;
    expect(contrastRatio(ARBITER_PANEL_TOKENS["text-primary"], accentHover)).toBeLessThan(
      WCAG_AA_NORMAL_TEXT,
    );
  });
});
