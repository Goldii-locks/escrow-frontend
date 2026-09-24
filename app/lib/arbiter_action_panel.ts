/**
 * arbiter_action_panel — Pure helpers backing the arbiter dispute resolution
 * panel (`app/components/ArbiterActionPanel.tsx`).
 *
 * Owns the panel's responsive layout rules, its interactive-state class
 * strings, the validation for a resolution before it is submitted, and the
 * colour pairs the panel relies on for WCAG AA contrast. Keeping these here
 * (rather than inline in JSX) lets each rule be asserted directly in tests
 * without mounting at a real viewport size.
 *
 * Mirrors the conventions established by `app/lib/dispute_raise_modal.ts`.
 */

const LOG_PREFIX = "[arbiter_action_panel]";

// =============================================================
// Responsive viewport classification
// =============================================================

export type ArbiterPanelViewport = "mobile" | "tablet" | "desktop";

/**
 * Minimum width (px) at which the outcome options sit side by side and the
 * submit button stops spanning the full width. Matches Tailwind's `sm`.
 */
export const ARBITER_PANEL_TABLET_MIN_WIDTH = 640;

/**
 * Minimum width (px) at which the panel adopts the roomier desktop spacing.
 * Matches Tailwind's `lg` breakpoint.
 */
export const ARBITER_PANEL_DESKTOP_MIN_WIDTH = 1024;

/**
 * Maps a viewport width in pixels onto a layout bucket.
 *
 * Non-finite or negative widths fall back to `"mobile"`: the narrowest
 * layout is the safe default, since it never overflows a wider screen.
 */
export function classifyArbiterPanelViewport(
  width: number,
): ArbiterPanelViewport {
  if (typeof width !== "number" || !Number.isFinite(width) || width < 0) {
    return "mobile";
  }
  if (width >= ARBITER_PANEL_DESKTOP_MIN_WIDTH) return "desktop";
  if (width >= ARBITER_PANEL_TABLET_MIN_WIDTH) return "tablet";
  return "mobile";
}

/** Structural layout decisions derived from the active viewport. */
export interface ArbiterPanelLayout {
  viewport: ArbiterPanelViewport;
  /** Number of columns used by the outcome option grid. */
  outcomeColumns: number;
  /** `true` when the action row stacks vertically instead of inline. */
  stackActions: boolean;
  /** `true` when the submit button spans the full panel width. */
  fullWidthActions: boolean;
}

/**
 * Resolves the structural layout for a viewport bucket.
 *
 * Mobile stacks the outcome options into one column with a full-width submit
 * button; tablet and desktop place both outcomes side by side and right-align
 * an auto-width submit button.
 */
export function getArbiterPanelLayout(
  viewport: ArbiterPanelViewport,
): ArbiterPanelLayout {
  switch (viewport) {
    case "desktop":
    case "tablet":
      return {
        viewport,
        outcomeColumns: 2,
        stackActions: false,
        fullWidthActions: false,
      };
    case "mobile":
    default:
      return {
        viewport: "mobile",
        outcomeColumns: 1,
        stackActions: true,
        fullWidthActions: true,
      };
  }
}

/**
 * Reads the current viewport width from `window`, falling back to the
 * mobile-first default during SSR where `window` is unavailable.
 */
export function readArbiterPanelViewportWidth(): number {
  if (typeof window === "undefined") return 0;
  try {
    return window.innerWidth;
  } catch (err) {
    console.warn(
      `${LOG_PREFIX} VIEWPORT READ FAILED:`,
      err instanceof Error ? err.message : String(err),
    );
    return 0;
  }
}

/** Shared focus ring: visible only for keyboard focus, offset from the card. */
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card";

/**
 * Tailwind class strings for each part of the panel.
 *
 * Written mobile-first: the base classes describe the phone layout and the
 * `sm:` / `lg:` variants progressively un-stack it, so a single render is
 * correct at every viewport without JS measurement.
 */
export const ARBITER_PANEL_CLASSES = {
  /** Panel container — full width of the card, separated by a top rule. */
  container:
    "w-full min-w-0 mt-1 pt-3 border-t border-border-subtle " +
    "flex flex-col gap-3 lg:gap-4",

  /** Panel heading. */
  title: "text-sm font-semibold text-text-primary lg:text-base",

  /** Supporting copy under the heading. */
  description: "text-xs text-text-muted lg:text-sm",

  /** Fieldset wrapping the outcome radios; reset the browser chrome. */
  fieldset: "m-0 min-w-0 border-0 p-0",

  /** Outcome grid — one column on mobile, two from `sm:` upward. */
  outcomeGrid: "grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3",

  /**
   * Outcome option (a `<label>` wrapping its radio). Hover lifts the border,
   * a checked radio tints the option, keyboard focus on the radio rings the
   * whole option, and a disabled radio dims it and drops the hover.
   */
  outcomeOption:
    "flex min-h-[44px] min-w-0 cursor-pointer items-start gap-2 rounded-lg " +
    "border border-border-subtle bg-surface-field px-3 py-2 text-sm text-text-primary " +
    "transition-colors hover:border-accent-soft/60 hover:bg-surface-field/80 " +
    "has-[:checked]:border-accent-soft has-[:checked]:bg-accent/10 " +
    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-soft " +
    "has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface-card " +
    "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 " +
    "has-[:disabled]:hover:border-border-subtle has-[:disabled]:hover:bg-surface-field",

  /** Outcome option when the outcome field is invalid. */
  outcomeOptionInvalid: "!border-danger-soft",

  /** Native radio input inside an option. */
  radio:
    "mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent-soft " +
    "focus-visible:outline-none disabled:cursor-not-allowed",

  /** Confirmation checkbox row. */
  confirmRow:
    "flex min-h-[44px] cursor-pointer items-start gap-2 text-sm text-text-secondary " +
    "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",

  /** Confirmation checkbox. */
  checkbox:
    `mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-accent-soft ${FOCUS_RING} ` +
    "disabled:cursor-not-allowed",

  /** Field-level error text. */
  fieldError: "text-xs text-danger-soft",

  /** Panel-level alert for configuration and submission errors. */
  alert:
    "w-full rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-soft",

  /** Action row — stacked on mobile, inline and right-aligned from `sm:`. */
  actions: "flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3",

  /**
   * Submit button — a full-width 44px tap target on mobile, auto-width from
   * `sm:`. Disabled keeps the resting colour so hover gives no false cue.
   */
  submit:
    "inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2 " +
    "text-sm font-medium transition-all sm:w-auto sm:min-h-0 sm:py-1.5 " +
    `active:scale-[0.97] ${FOCUS_RING} ` +
    "disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
} as const;

/** Submit button tone for each outcome, including its hover and disabled state. */
export const ARBITER_SUBMIT_TONE: Record<ArbiterOutcome | "none", string> = {
  release:
    "bg-success text-surface-page hover:bg-success/80 disabled:hover:bg-success",
  refund:
    "bg-danger text-text-primary hover:bg-danger/80 disabled:hover:bg-danger",
  none:
    "bg-accent text-text-primary hover:bg-accent-hover disabled:hover:bg-accent",
};

// =============================================================
// Resolution validation
// =============================================================

/** Where the disputed funds go: to the freelancer, or back to the client. */
export type ArbiterOutcome = "release" | "refund";

export interface ArbiterResolutionInput {
  outcome: ArbiterOutcome | null | undefined;
  /** Whether the arbiter ticked the "this decision is final" confirmation. */
  confirmed: boolean;
}

export interface ArbiterFieldErrors {
  outcome?: string;
  confirmation?: string;
}

export interface ArbiterResolutionValidation {
  valid: boolean;
  errors: ArbiterFieldErrors;
}

export const ARBITER_OUTCOME_REQUIRED_ERROR =
  "Select how the disputed funds should be distributed.";

export const ARBITER_CONFIRMATION_REQUIRED_ERROR =
  "Confirm that you understand this decision is final.";

/**
 * Validates the arbiter's inputs before a resolution is submitted. Every
 * failing field is reported at once so all indicators light up together.
 */
export function validateArbiterResolution(
  input: ArbiterResolutionInput,
): ArbiterResolutionValidation {
  const errors: ArbiterFieldErrors = {};

  if (input.outcome !== "release" && input.outcome !== "refund") {
    errors.outcome = ARBITER_OUTCOME_REQUIRED_ERROR;
  }
  if (!input.confirmed) {
    errors.confirmation = ARBITER_CONFIRMATION_REQUIRED_ERROR;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export interface ArbiterPanelConfig {
  /** Whether a resolve handler is wired up. */
  hasHandler: boolean;
  /**
   * Funds still held in escrow for the milestone, in base units. `null` or
   * an unparseable value means "unknown" and does not block resolution.
   */
  escrowAmount?: string | null;
}

export const ARBITER_NO_HANDLER_ERROR =
  "Dispute resolution is unavailable right now. Reconnect your wallet and try again.";

export const ARBITER_NO_FUNDS_ERROR =
  "This milestone has no escrowed funds left to distribute.";

/**
 * Checks that the panel is configured well enough to submit a resolution.
 * Returns the panel-level error message, or `null` when it can proceed.
 */
export function getArbiterPanelConfigError(
  config: ArbiterPanelConfig,
): string | null {
  if (!config.hasHandler) return ARBITER_NO_HANDLER_ERROR;

  if (typeof config.escrowAmount === "string" && config.escrowAmount.trim() !== "") {
    let parsed: bigint | null = null;
    try {
      parsed = BigInt(config.escrowAmount.trim());
    } catch {
      parsed = null;
    }
    if (parsed !== null && parsed <= BigInt(0)) return ARBITER_NO_FUNDS_ERROR;
  }

  return null;
}

// =============================================================
// Colour contrast (WCAG 2.1 AA)
// =============================================================

/** Minimum contrast for normal-size text under WCAG 2.1 AA. */
export const WCAG_AA_NORMAL_TEXT = 4.5;

/** Minimum contrast for UI components and focus indicators (WCAG 1.4.11). */
export const WCAG_AA_NON_TEXT = 3;

/**
 * Hex values of the theme tokens the panel paints with. These mirror the
 * `@theme` block in `app/globals.css`; the contrast test asserts they still
 * match so a palette change cannot silently break compliance.
 */
export const ARBITER_PANEL_TOKENS = {
  "surface-page": "#030712",
  "surface-card": "#111827",
  "surface-field": "#1f2937",
  "text-primary": "#f9fafb",
  "text-secondary": "#d1d5db",
  "text-muted": "#9ca3af",
  "accent": "#4f46e5",
  "accent-soft": "#818cf8",
  "success": "#16a34a",
  "danger": "#991b1b",
  "danger-soft": "#f87171",
} as const;

export type ArbiterPanelToken = keyof typeof ARBITER_PANEL_TOKENS;

export interface ArbiterContrastPair {
  /** What the pair is used for, for readable test output. */
  usage: string;
  foreground: ArbiterPanelToken;
  background: ArbiterPanelToken;
  /** Required ratio: text pairs need 4.5, focus rings and borders need 3. */
  minRatio: number;
}

/** Every foreground/background pairing the panel renders in its enabled state. */
export const ARBITER_PANEL_CONTRAST_PAIRS: readonly ArbiterContrastPair[] = [
  { usage: "heading", foreground: "text-primary", background: "surface-card", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "description", foreground: "text-muted", background: "surface-card", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "confirmation label", foreground: "text-secondary", background: "surface-card", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "outcome option label", foreground: "text-primary", background: "surface-field", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "outcome option hint", foreground: "text-muted", background: "surface-field", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "field error", foreground: "danger-soft", background: "surface-card", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "release button", foreground: "surface-page", background: "success", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "refund button", foreground: "text-primary", background: "danger", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "resolve button", foreground: "text-primary", background: "accent", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "focus ring", foreground: "accent-soft", background: "surface-card", minRatio: WCAG_AA_NON_TEXT },
  { usage: "invalid option border", foreground: "danger-soft", background: "surface-card", minRatio: WCAG_AA_NON_TEXT },
];

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a `#rrggbb` or `#rgb` colour. */
export function relativeLuminance(hex: string): number {
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
  const r = channelToLinear(parseInt(value.slice(0, 2), 16));
  const g = channelToLinear(parseInt(value.slice(2, 4), 16));
  const b = channelToLinear(parseInt(value.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, from 1 (none) to 21 (black on white). */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a >= b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}
