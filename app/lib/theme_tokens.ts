/**
 * theme_tokens — Shared helpers for tying component class strings back to the
 * design variables declared in the `@theme` block of `app/globals.css`, and
 * for checking colour pairs against WCAG 2.1 AA contrast.
 *
 * Components keep their own token tables (hex mirrors of the `@theme`
 * values); tests use these helpers to assert the mirrors, the class strings
 * and the rendered DOM all stay in step with the config file.
 */

const LOG_PREFIX = "[theme_tokens]";

// =============================================================
// Colour contrast (WCAG 2.1 AA)
// =============================================================

/** Minimum contrast for normal-size text under WCAG 2.1 AA. */
export const WCAG_AA_NORMAL_TEXT = 4.5;

/** Minimum contrast for UI components, icons and focus indicators (WCAG 1.4.11). */
export const WCAG_AA_NON_TEXT = 3;

function normaliseHex(hex: string): string {
  let value = hex.trim().replace(/^#/, "");
  if (value.length === 3) {
    value = value
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`${LOG_PREFIX} invalid hex colour: ${hex}`);
  }
  return value.toLowerCase();
}

function toRgb(hex: string): [number, number, number] {
  const value = normaliseHex(hex);
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a `#rrggbb` or `#rgb` colour. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map(channelToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, from 1 (none) to 21 (black on white). */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a >= b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Composites `colour` at `alpha` (0–1) over an opaque `backdrop`, returning
 * the resulting opaque hex. Used to check contrast while an element is
 * partially transparent (e.g. mid-animation).
 */
export function blendOver(colour: string, alpha: number, backdrop: string): string {
  const a = Math.min(1, Math.max(0, alpha));
  const fg = toRgb(colour);
  const bg = toRgb(backdrop);
  return (
    "#" +
    fg
      .map((c, i) => Math.round(c * a + bg[i] * (1 - a)))
      .map((c) => c.toString(16).padStart(2, "0"))
      .join("")
  );
}

// =============================================================
// Tailwind colour utility → theme token mapping
// =============================================================

/** Utility prefixes whose value is a colour, longest first so `ring-offset` wins over `ring`. */
const COLOUR_PREFIXES = [
  "ring-offset",
  "placeholder",
  "outline",
  "divide",
  "accent",
  "border",
  "stroke",
  "shadow",
  "caret",
  "text",
  "fill",
  "ring",
  "bg",
] as const;

/**
 * Suffixes that share a colour prefix but are not colours (sizes, widths,
 * alignment, styles). Anything else after a colour prefix must be a theme
 * token.
 */
const NON_COLOUR_SUFFIXES = new Set([
  // text
  "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "center", "left", "right", "justify",
  // border / ring / outline widths and styles
  "0", "1", "2", "4", "8", "t", "b", "l", "r", "x", "y", "t-0", "b-0",
  "dashed", "dotted", "solid", "double", "none", "inset", "hidden",
  // shadow sizes
  "md", "inner",
  // keywords that carry no palette colour
  "transparent", "current", "inherit",
]);

export type ColourUtility =
  | { kind: "token"; utility: string; token: string }
  | { kind: "non-colour"; utility: string }
  | { kind: "off-palette"; utility: string; value: string };

/**
 * Classifies one Tailwind class. Variants (`hover:`, `sm:`, `has-[:checked]:`),
 * the `!` important marker and `/NN` opacity modifiers are stripped first.
 *
 * Returns `null` for classes that are not colour utilities at all,
 * `non-colour` for same-prefix utilities like `text-sm` or `border-t`,
 * `token` when the value names a theme token, and `off-palette` for anything
 * else — a stock Tailwind palette colour (`gray-800`, `white`) or an
 * arbitrary value (`[#111827]`) that bypasses the design config.
 */
export function classifyColourUtility(
  className: string,
  themeTokens: ReadonlySet<string>,
): ColourUtility | null {
  // Drop variants: everything up to the last `:` that is not inside [...].
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < className.length; i += 1) {
    const ch = className[i];
    if (ch === "[") depth += 1;
    else if (ch === "]") depth -= 1;
    else if (ch === ":" && depth === 0) cut = i;
  }
  let utility = className.slice(cut + 1).replace(/^!/, "").replace(/^-/, "");

  const prefix = COLOUR_PREFIXES.find(
    (p) => utility === p || utility.startsWith(`${p}-`),
  );
  if (!prefix) return null;
  if (utility === prefix) return { kind: "non-colour", utility };

  let value = utility.slice(prefix.length + 1);
  // `bg-[var(--color-x)]` links to the token through its CSS variable.
  const cssVar = /^\[var\(--color-([a-z0-9-]+)\)\](?:\/\d+)?$/.exec(value);
  if (cssVar) {
    return themeTokens.has(cssVar[1])
      ? { kind: "token", utility, token: cssVar[1] }
      : { kind: "off-palette", utility, value };
  }
  value = value.replace(/\/\d+$/, "");
  utility = `${prefix}-${value}`;

  if (NON_COLOUR_SUFFIXES.has(value)) return { kind: "non-colour", utility };
  // Arbitrary lengths such as `text-[10px]` or `border-[3px]` are sizes.
  if (/^\[\d[\d.]*(px|rem|em|%)?\]$/.test(value)) return { kind: "non-colour", utility };
  if (themeTokens.has(value)) return { kind: "token", utility, token: value };
  return { kind: "off-palette", utility, value };
}

/** Classifies every class in a whitespace-separated class string. */
export function classifyClassString(
  classes: string,
  themeTokens: ReadonlySet<string>,
): ColourUtility[] {
  return classes
    .split(/\s+/)
    .filter(Boolean)
    .map((cls) => classifyColourUtility(cls, themeTokens))
    .filter((c): c is ColourUtility => c !== null);
}

/**
 * Parses the `--color-*` declarations out of a stylesheet's `@theme` blocks
 * (i.e. `app/globals.css`), returning token name → declared value.
 */
export function parseThemeColourTokens(css: string): Map<string, string> {
  const tokens = new Map<string, string>();
  const themeBlock = /@theme[^{]*\{([^}]*)\}/g;
  let block: RegExpExecArray | null;
  while ((block = themeBlock.exec(css)) !== null) {
    const decl = /--color-([a-z0-9-]+)\s*:\s*([^;]+);/g;
    let match: RegExpExecArray | null;
    while ((match = decl.exec(block[1])) !== null) {
      tokens.set(match[1], match[2].trim().toLowerCase());
    }
  }
  return tokens;
}
