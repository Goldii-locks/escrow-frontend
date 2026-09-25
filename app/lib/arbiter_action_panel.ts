/**
 * arbiter_action_panel — Pure helpers backing the arbiter dispute resolution
 * panel (`app/components/ArbiterActionPanel.tsx`).
 *
 * Owns the panel's responsive layout rules (including the mobile overlay
 * wrapper that fits short screens), its interactive-state and motion class
 * strings, its empty-state copy, the validation for a resolution before it is
 * submitted, and the colour pairs the panel relies on for WCAG AA contrast.
 * Keeping these here (rather than inline in JSX) lets each rule be asserted
 * directly in tests without mounting at a real viewport size.
 *
 * Mirrors the conventions established by `app/lib/dispute_raise_modal.ts`.
 */

import { WCAG_AA_NON_TEXT, WCAG_AA_NORMAL_TEXT } from "@/app/lib/theme_tokens";

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
  /**
   * `true` when the panel caps its height to the viewport, scrolls its body,
   * and pins the submit bar to the bottom so it stays reachable on short
   * phone screens.
   */
  constrainHeight: boolean;
}

/**
 * Resolves the structural layout for a viewport bucket.
 *
 * Mobile stacks the outcome options into one column with a full-width submit
 * button and constrains the panel to the screen height; tablet and desktop
 * place both outcomes side by side, right-align an auto-width submit button,
 * and let the panel grow to its content.
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
        constrainHeight: false,
      };
    case "mobile":
    default:
      return {
        viewport: "mobile",
        outcomeColumns: 1,
        stackActions: true,
        fullWidthActions: true,
        constrainHeight: true,
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

// =============================================================
// Motion
// =============================================================

/**
 * Animation utilities for the panel's interactions and state changes. Each
 * one reuses a keyframe from `app/globals.css` and is switched off under
 * `prefers-reduced-motion`, so motion is purely decorative.
 */
export const ARBITER_PANEL_MOTION = {
  /** Panel and placeholder mount. */
  enter: "animate-fade-in motion-reduce:animate-none",
  /** Field error text sliding in beneath its control. */
  fieldError: "animate-slide-in motion-reduce:animate-none",
  /** Panel-level alert: a short shake to draw the eye. */
  alert: "animate-shake motion-reduce:animate-none",
  /** Transaction status banner appearing. */
  status: "animate-fade-in motion-reduce:animate-none",
  /** Submit label cross-fading when the chosen outcome changes. */
  labelSwap: "inline-block animate-fade-in motion-reduce:animate-none",
  /**
   * Press feedback on clickable controls: colour, shadow and scale ease
   * together, and the scale-down is dropped under reduced motion.
   */
  press:
    "transition duration-200 ease-out active:scale-[0.98] " +
    "motion-reduce:transition-none motion-reduce:active:scale-100",
  /** Panel border tint easing between idle / invalid / ready states. */
  stateTint:
    "transition-colors duration-300 ease-out motion-reduce:transition-none " +
    "data-[state=invalid]:border-danger-soft/40 data-[state=ready]:border-accent-soft/50",
} as const;

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
  /**
   * Panel container and mobile overlay wrapper — full width of the card,
   * separated by a top rule. On mobile it is capped to the dynamic viewport
   * height (`dvh`, so browser chrome showing or hiding is accounted for) and
   * clips its body, which scrolls; from `sm:` it grows to its content.
   */
  container:
    "w-full min-w-0 mt-1 pt-3 border-t border-border-subtle " +
    "flex flex-col gap-3 lg:gap-4 " +
    "max-h-[75dvh] overflow-hidden sm:max-h-none sm:overflow-visible",

  /**
   * Scrollable body — takes the remaining height on mobile and scrolls on
   * its own (`overscroll-contain` stops the scroll chaining to the page).
   * The 4px inset padding keeps focus rings from being clipped.
   */
  scrollableContent:
    "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain " +
    "-mx-1 px-1 py-1 lg:gap-4 sm:overflow-visible",

  /**
   * Sticky footer holding the submit button — stays on screen at the bottom
   * of the panel on mobile however tall the body gets; static from `sm:`.
   */
  stickyFooter:
    "sticky bottom-0 z-10 shrink-0 bg-surface-card pt-2 " +
    "sm:static sm:z-auto sm:bg-transparent sm:pt-0",

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
   * whole option, a press scales it down slightly, and a disabled radio dims
   * it and drops the hover and press feedback.
   */
  outcomeOption:
    "flex min-h-[44px] min-w-0 cursor-pointer items-start gap-2 rounded-lg " +
    "border border-border-subtle bg-surface-field px-3 py-2 text-sm text-text-primary " +
    "touch-manipulation select-none " +
    `${ARBITER_PANEL_MOTION.press} hover:border-accent-soft/60 hover:bg-surface-field/80 ` +
    "has-[:checked]:border-accent-soft has-[:checked]:bg-accent/10 " +
    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-soft " +
    "has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-surface-card " +
    "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 " +
    "has-[:disabled]:hover:border-border-subtle has-[:disabled]:hover:bg-surface-field " +
    "has-[:disabled]:active:scale-100",

  /** Outcome option when the outcome field is invalid. */
  outcomeOptionInvalid: "!border-danger-soft",

  /** Native radio input inside an option. */
  radio:
    "mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent-soft " +
    "focus-visible:outline-none disabled:cursor-not-allowed",

  /** Confirmation checkbox row. */
  confirmRow:
    "flex min-h-[44px] cursor-pointer touch-manipulation select-none items-start gap-2 " +
    "text-sm text-text-secondary " +
    "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50",

  /** Confirmation checkbox. */
  checkbox:
    `mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-accent-soft ${FOCUS_RING} ` +
    "transition duration-200 ease-out motion-reduce:transition-none " +
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
    "touch-manipulation text-sm font-medium transition-all duration-200 ease-out " +
    "sm:w-auto sm:min-h-0 sm:py-1.5 " +
    `active:scale-[0.97] ${FOCUS_RING} ` +
    "disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 " +
    "motion-reduce:transition-none motion-reduce:active:scale-100",

  /** Empty-state placeholder card. */
  placeholder:
    "w-full min-w-0 mt-1 flex flex-col items-center gap-2 rounded-lg border border-dashed " +
    "border-border-subtle bg-surface-field/40 px-4 py-6 text-center",

  /** Placeholder icon badge (decorative). */
  placeholderIcon:
    "flex h-10 w-10 items-center justify-center rounded-full bg-surface-field " +
    "text-lg text-text-muted",

  /** Placeholder heading. */
  placeholderTitle: "text-sm font-semibold text-text-secondary",

  /** Placeholder body copy. */
  placeholderDescription: "max-w-sm text-xs text-text-muted",

  /** Outcome fieldset legend. */
  legend: "mb-2 text-xs font-medium text-text-secondary",

  /** Wrapper for an outcome option's text; `min-w-0` lets long copy wrap. */
  optionText: "min-w-0",

  /** Outcome option title. */
  optionLabel: "block font-medium text-text-primary",

  /** Outcome option supporting hint. */
  optionHint: "block text-xs text-text-muted",
} as const;

/** Submit button tone for each outcome, including its hover and disabled state. */
export const ARBITER_SUBMIT_TONE: Record<ArbiterOutcome | "none", string> = {
  release:
    "bg-success text-surface-page hover:bg-success-soft disabled:hover:bg-success",
  refund:
    "bg-danger text-text-primary hover:bg-danger/80 disabled:hover:bg-danger",
  none:
    "bg-accent text-text-primary hover:bg-accent/80 disabled:hover:bg-accent",
};

// =============================================================
// Empty data states
// =============================================================

/**
 * Which empty state a placeholder describes:
 * - `no-milestone`  — the panel received no usable milestone to resolve.
 * - `no-disputes`   — the arbiter's job has milestones, but none are disputed.
 * - `no-milestones` — the arbiter's job has no milestone data at all.
 */
export type ArbiterEmptyVariant = "no-milestone" | "no-disputes" | "no-milestones";

export interface ArbiterEmptyCopy {
  title: string;
  description: string;
  /** Decorative glyph shown above the title. */
  icon: string;
}

export const ARBITER_EMPTY_COPY: Record<ArbiterEmptyVariant, ArbiterEmptyCopy> = {
  "no-milestone": {
    title: "No dispute selected",
    description:
      "There is no disputed milestone to resolve here. Open a job with a disputed milestone to review it and decide where the funds go.",
    icon: "⚖",
  },
  "no-disputes": {
    title: "No disputes need your decision",
    description:
      "None of this job's milestones are disputed. If the client or freelancer raises a dispute, the resolution panel will appear on that milestone.",
    icon: "✓",
  },
  "no-milestones": {
    title: "Nothing to arbitrate yet",
    description:
      "This job has no milestones yet. Once milestones exist and one is disputed, you can resolve it here.",
    icon: "…",
  },
};

/** Whether a value is a usable zero-based milestone index. */
export function isValidMilestoneIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Chooses the arbiter's job-level empty state from its milestone list, or
 * `null` when at least one milestone is disputed and needs a decision.
 * A missing or non-array list counts as empty.
 */
export function getArbiterJobEmptyState(
  milestones: ReadonlyArray<{ status?: unknown } | null | undefined> | null | undefined,
): Exclude<ArbiterEmptyVariant, "no-milestone"> | null {
  if (!Array.isArray(milestones) || milestones.length === 0) return "no-milestones";
  const hasDispute = milestones.some((m) => m?.status === "Disputed");
  return hasDispute ? null : "no-disputes";
}

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

/**
 * The panel's overall interaction state, exposed as `data-state` so styles
 * (and tests) can react to it:
 * - `pending` — a resolve transaction is in flight.
 * - `blocked` — the configuration prevents resolution.
 * - `invalid` — the last submit attempt failed validation.
 * - `ready`   — an outcome is chosen and the decision confirmed.
 * - `idle`    — anything else.
 */
export type ArbiterPanelState = "pending" | "blocked" | "invalid" | "ready" | "idle";

export function getArbiterPanelState(input: {
  isPending: boolean;
  configError: string | null;
  fieldErrors: ArbiterFieldErrors;
  outcome: ArbiterOutcome | null;
  confirmed: boolean;
}): ArbiterPanelState {
  if (input.isPending) return "pending";
  if (input.configError !== null) return "blocked";
  if (Object.keys(input.fieldErrors).length > 0) return "invalid";
  if (input.outcome !== null && input.confirmed) return "ready";
  return "idle";
}

// =============================================================
// Design variables & colour contrast (WCAG 2.1 AA)
// =============================================================

// Contrast maths is shared with other components; re-exported so existing
// imports from this module keep working.
export {
  WCAG_AA_NON_TEXT,
  WCAG_AA_NORMAL_TEXT,
  contrastRatio,
  relativeLuminance,
} from "@/app/lib/theme_tokens";

/**
 * Hex values of every theme token the panel paints with. These mirror the
 * `@theme` block in `app/globals.css` (the core design variables config);
 * tests assert the mirror still matches, and that every colour utility in
 * the class maps below resolves to one of these tokens, so a palette change
 * or an off-palette class cannot slip in silently.
 */
export const ARBITER_PANEL_TOKENS = {
  "surface-page": "#030712",
  "surface-card": "#111827",
  "surface-field": "#1f2937",
  "border-subtle": "#374151",
  "text-primary": "#f9fafb",
  "text-secondary": "#d1d5db",
  "text-muted": "#9ca3af",
  "accent": "#4f46e5",
  "accent-soft": "#818cf8",
  "success": "#16a34a",
  "success-soft": "#4ade80",
  "danger": "#991b1b",
  "danger-soft": "#f87171",
} as const;

export type ArbiterPanelToken = keyof typeof ARBITER_PANEL_TOKENS;

/**
 * Every class map the panel draws its styling from. The token-linkage tests
 * walk these, so a class added to any of them is checked against the config.
 */
export const ARBITER_PANEL_CLASS_MAPS = {
  classes: ARBITER_PANEL_CLASSES,
  submitTone: ARBITER_SUBMIT_TONE,
  motion: ARBITER_PANEL_MOTION,
} as const;

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
  { usage: "outcome legend", foreground: "text-secondary", background: "surface-card", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "confirmation label", foreground: "text-secondary", background: "surface-card", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "outcome option label", foreground: "text-primary", background: "surface-field", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "outcome option hint", foreground: "text-muted", background: "surface-field", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "field error", foreground: "danger-soft", background: "surface-card", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "release button", foreground: "surface-page", background: "success", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "refund button", foreground: "text-primary", background: "danger", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "resolve button", foreground: "text-primary", background: "accent", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "placeholder title", foreground: "text-secondary", background: "surface-field", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "placeholder description", foreground: "text-muted", background: "surface-field", minRatio: WCAG_AA_NORMAL_TEXT },
  { usage: "focus ring", foreground: "accent-soft", background: "surface-card", minRatio: WCAG_AA_NON_TEXT },
  { usage: "invalid option border", foreground: "danger-soft", background: "surface-card", minRatio: WCAG_AA_NON_TEXT },
];
