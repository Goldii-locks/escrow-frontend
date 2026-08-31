/**
 * dispute_raise_modal — Pure helpers backing the dispute raise confirmation
 * modal (`app/components/DisputeRaiseModal.tsx`).
 *
 * Owns the responsive sizing rules for the modal: how it resizes and stacks
 * across mobile, tablet, and desktop viewports.  Keeping the breakpoints and
 * class strings here (rather than inline in JSX) lets the layout be asserted
 * directly in tests without mounting at a real viewport size.
 *
 * Mirrors the conventions established by `app/lib/wallet_selector_modal.ts`.
 */

const LOG_PREFIX = "[dispute_raise_modal]";

// =============================================================
// Responsive viewport classification (#332)
// =============================================================

export type DisputeViewport = "mobile" | "tablet" | "desktop";

/**
 * Minimum width (px) at which the modal switches from the mobile sheet to
 * the centered tablet dialog.  Matches Tailwind's `sm` breakpoint.
 */
export const DISPUTE_MODAL_TABLET_MIN_WIDTH = 640;

/**
 * Minimum width (px) at which the modal adopts the wider desktop dialog.
 * Matches Tailwind's `lg` breakpoint.
 */
export const DISPUTE_MODAL_DESKTOP_MIN_WIDTH = 1024;

/**
 * Maps a viewport width in pixels onto a layout bucket.
 *
 * Non-finite or negative widths fall back to `"mobile"`: the narrowest
 * layout is the safe default, since it never overflows a wider screen.
 */
export function classifyDisputeViewport(width: number): DisputeViewport {
  if (typeof width !== "number" || !Number.isFinite(width) || width < 0) {
    return "mobile";
  }
  if (width >= DISPUTE_MODAL_DESKTOP_MIN_WIDTH) return "desktop";
  if (width >= DISPUTE_MODAL_TABLET_MIN_WIDTH) return "tablet";
  return "mobile";
}

/** Structural layout decisions derived from the active viewport. */
export interface DisputeModalLayout {
  viewport: DisputeViewport;
  /** `true` when the panel spans the full viewport width (mobile sheet). */
  fullWidth: boolean;
  /** `true` when the footer actions stack vertically instead of inline. */
  stackActions: boolean;
  /** `true` when the summary rows stack into a single column. */
  stackSummary: boolean;
  /** Number of columns used by the dispute summary grid. */
  summaryColumns: number;
  /** Tailwind max-width class applied to the modal panel. */
  maxWidthClass: string;
}

/**
 * Resolves the structural layout for a viewport bucket.
 *
 * Mobile is a full-bleed bottom sheet with stacked actions; tablet centers a
 * medium dialog with inline actions; desktop widens the panel and splits the
 * summary into two columns.
 */
export function getDisputeModalLayout(
  viewport: DisputeViewport,
): DisputeModalLayout {
  switch (viewport) {
    case "desktop":
      return {
        viewport,
        fullWidth: false,
        stackActions: false,
        stackSummary: false,
        summaryColumns: 2,
        maxWidthClass: "lg:max-w-2xl",
      };
    case "tablet":
      return {
        viewport,
        fullWidth: false,
        stackActions: false,
        stackSummary: false,
        summaryColumns: 2,
        maxWidthClass: "sm:max-w-lg",
      };
    case "mobile":
    default:
      return {
        viewport: "mobile",
        fullWidth: true,
        stackActions: true,
        stackSummary: true,
        summaryColumns: 1,
        maxWidthClass: "max-w-full",
      };
  }
}

/**
 * Tailwind class strings for each part of the modal.
 *
 * Written mobile-first: the base classes describe the mobile sheet and the
 * `sm:` / `lg:` variants progressively widen and un-stack the layout, so a
 * single render is correct at every viewport without JS measurement.
 */
export const DISPUTE_MODAL_CLASSES = {
  /** Backdrop — bottom-aligned sheet on mobile, centered dialog from `sm:`. */
  overlay:
    "fixed inset-0 z-50 flex items-end justify-center overflow-y-auto " +
    "bg-black/60 p-0 sm:items-center sm:p-6",

  /** The modal panel itself — full-bleed on mobile, capped and rounded up. */
  panel:
    "w-full max-w-full max-h-[92vh] overflow-y-auto rounded-t-2xl bg-surface " +
    "p-4 shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-6 lg:max-w-2xl lg:p-8",

  /** Header row — title and close button. */
  header: "flex items-start justify-between gap-3 mb-4",

  /** Modal title — scales up with the panel. */
  title: "text-base font-semibold text-primary sm:text-lg lg:text-xl",

  /** Summary grid — one column on mobile, two from `sm:` upward. */
  summary:
    "grid grid-cols-1 gap-3 mb-4 text-sm sm:grid-cols-2 sm:gap-4",

  /** Individual summary cell — `min-w-0` so long addresses truncate. */
  summaryCell: "min-w-0 break-words",

  /** Reason field. */
  textarea:
    "w-full min-h-[96px] rounded-lg border border-white/10 bg-surface-field " +
    "px-3 py-2 text-sm text-primary sm:min-h-[120px]",

  /** Footer actions — stacked full-width on mobile, inline from `sm:`. */
  actions:
    "mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-3",

  /** Buttons — full-width tap targets on mobile, auto-width from `sm:`. */
  button:
    "w-full min-h-[44px] rounded-lg px-4 py-2.5 text-sm font-medium " +
    "transition-colors sm:w-auto",
} as const;

// =============================================================
// Dispute reason validation (#332)
// =============================================================

/** Shortest dispute reason accepted by the confirmation modal. */
export const DISPUTE_REASON_MIN_LENGTH = 10;

/** Longest dispute reason accepted by the confirmation modal. */
export const DISPUTE_REASON_MAX_LENGTH = 500;

export interface DisputeReasonValidation {
  valid: boolean;
  /** Validation message shown under the field, or `null` when valid. */
  error: string | null;
}

/**
 * Validates the free-text reason a user must supply before a dispute can be
 * raised.  Whitespace-only input is rejected the same as an empty field.
 */
export function validateDisputeReason(
  reason: string | null | undefined,
): DisputeReasonValidation {
  const trimmed = typeof reason === "string" ? reason.trim() : "";

  if (trimmed === "") {
    return { valid: false, error: "Please describe why you are raising this dispute." };
  }

  if (trimmed.length < DISPUTE_REASON_MIN_LENGTH) {
    return {
      valid: false,
      error: `Please add a little more detail (at least ${DISPUTE_REASON_MIN_LENGTH} characters).`,
    };
  }

  if (trimmed.length > DISPUTE_REASON_MAX_LENGTH) {
    return {
      valid: false,
      error: `Reason is too long (maximum ${DISPUTE_REASON_MAX_LENGTH} characters).`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Reads the current viewport width from `window`, falling back to the
 * mobile-first default during SSR where `window` is unavailable.
 */
export function readViewportWidth(): number {
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
