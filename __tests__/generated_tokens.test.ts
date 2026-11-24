/**
 * Tests for the generated theme tokens mechanism (issue #680).
 *
 * Verifies that:
 *  1. The THEME_TOKENS map is non-empty and contains key colours.
 *  2. THEME_TOKENS values match the CSS `@theme` block exactly (so that
 *     changing a token in globals.css and re-running generate-tokens updates
 *     everything and these tests catch it if someone tries to hardcode a value).
 *  3. Components no longer maintain independent hex tables: ARBITER_PANEL_TOKENS
 *     is derived from THEME_TOKENS, not a copy. (TransactionProgressBar and its
 *     token table were removed as unused in #612.)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_TOKENS } from "@/app/lib/generated_tokens";
import { ARBITER_PANEL_TOKENS } from "@/app/lib/arbiter_action_panel";
import { parseThemeColourTokens } from "@/app/lib/theme_tokens";

const cssTokens = parseThemeColourTokens(
  readFileSync(resolve(__dirname, "../app/globals.css"), "utf8")
);

// ---------------------------------------------------------------------------
// THEME_TOKENS map
// ---------------------------------------------------------------------------

describe("THEME_TOKENS (generated from globals.css)", () => {
  it("contains at least the core tokens", () => {
    const required = [
      "surface-page",
      "surface-card",
      "text-primary",
      "accent",
      "success",
      "danger",
    ];
    for (const token of required) {
      expect(THEME_TOKENS).toHaveProperty(token);
    }
  });

  it("every value in THEME_TOKENS matches the parsed CSS @theme block", () => {
    for (const [token, value] of Object.entries(THEME_TOKENS)) {
      const cssValue = cssTokens.get(token);
      if (cssValue !== undefined) {
        expect(value, `THEME_TOKENS["${token}"] should match globals.css`).toBe(cssValue);
      }
    }
  });

  it("globals.css has at least 15 colour tokens", () => {
    expect(cssTokens.size).toBeGreaterThanOrEqual(15);
  });
});

// ---------------------------------------------------------------------------
// ARBITER_PANEL_TOKENS — derived, not hardcoded
// ---------------------------------------------------------------------------

describe("ARBITER_PANEL_TOKENS: derived from THEME_TOKENS", () => {
  it("every value matches the corresponding THEME_TOKENS entry", () => {
    for (const [token, value] of Object.entries(ARBITER_PANEL_TOKENS)) {
      expect(value, `ARBITER_PANEL_TOKENS["${token}"] should equal THEME_TOKENS["${token}"]`).toBe(
        THEME_TOKENS[token as keyof typeof THEME_TOKENS]
      );
    }
  });

  it("every value matches the CSS @theme block", () => {
    for (const [token, value] of Object.entries(ARBITER_PANEL_TOKENS)) {
      const cssValue = cssTokens.get(token);
      if (cssValue !== undefined) {
        expect(value, `ARBITER_PANEL_TOKENS["${token}"] should match globals.css`).toBe(cssValue);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Single source of truth: changing CSS updates token tables
// ---------------------------------------------------------------------------

describe("single source of truth invariant", () => {
  it("no component token table has a value that differs from globals.css", () => {
    const allTables: Array<[string, Record<string, string>]> = [
      ["ARBITER_PANEL_TOKENS", ARBITER_PANEL_TOKENS as Record<string, string>],
    ];

    for (const [tableName, table] of allTables) {
      for (const [token, value] of Object.entries(table)) {
        const cssValue = cssTokens.get(token);
        if (cssValue !== undefined) {
          expect(
            value,
            `${tableName}["${token}"] = "${value}" but globals.css has "${cssValue}" — re-run npm run generate-tokens`
          ).toBe(cssValue);
        }
      }
    }
  });
});
