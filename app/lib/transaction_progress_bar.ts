/**
 * transaction_progress_bar — Pure helpers, layout utilities, animations, and
 * design token mappings backing the transaction progress indicator
 * (`app/components/TransactionProgressBar.tsx`).
 *
 * Implements:
 * - CSS micro-animations on clicks and state changes (Issue #415)
 * - Mobile viewport overlay wrappers fitting screen height constraints (Issue #416)
 * - Comprehensive UI state definitions for Storybook mocks (Issue #418)
 * - Structural layout assertions for RTL tests (Issue #419)
 */

// =============================================================
// Core Design Variables & Tokens Mapping (Issue #417)
// =============================================================

export const TRANSACTION_PROGRESS_TOKENS = {
  "surface-page": "#030712",
  "surface-card": "#111827",
  "surface-field": "#1f2937",
  "border-strong": "#1f2937",
  "border-subtle": "#374151",
  "text-primary": "#f9fafb",
  "text-secondary": "#d1d5db",
  "text-muted": "#9ca3af",
  "text-disabled": "#6b7280",
  "accent": "#4f46e5",
  "accent-hover": "#6366f1",
  "accent-soft": "#818cf8",
  "success": "#16a34a",
  "success-soft": "#4ade80",
  "danger": "#991b1b",
  "danger-soft": "#f87171",
  "warning-soft": "#facc15",
  "partial-soft": "#fdba74",
} as const;

export type TransactionProgressToken = keyof typeof TRANSACTION_PROGRESS_TOKENS;

export const PROGRESS_BAR_THEME_CLASSES = {
  container: "bg-[var(--color-surface-card)] border-[var(--color-border-subtle)] text-[var(--color-text-primary)]",
  stepDefault: "bg-[var(--color-surface-field)] border-[var(--color-border-strong)] text-[var(--color-text-muted)]",
  stepActive: "bg-[var(--color-accent)] border-[var(--color-accent-soft)] text-white shadow-md shadow-indigo-500/20",
  stepCompleted: "bg-[var(--color-success)] border-[var(--color-success-soft)] text-white",
  stepFailed: "bg-[var(--color-danger)] border-[var(--color-danger-soft)] text-white",
  connectorActive: "bg-[var(--color-accent)]",
  connectorCompleted: "bg-[var(--color-success)]",
  connectorDefault: "bg-[var(--color-border-subtle)]",
  alertError: "bg-[var(--color-surface-field)] border-[var(--color-danger-soft)] text-[var(--color-danger-soft)]",
  labelPrimary: "text-[var(--color-text-primary)]",
  labelSecondary: "text-[var(--color-text-secondary)]",
  labelMuted: "text-[var(--color-text-muted)]",
} as const;

// =============================================================
// CSS Micro-animations (Issue #415)
// =============================================================

export const PROGRESS_BAR_ANIMATION_CLASSES = {
  /**
   * Uses the `pulse-soft` keyframe from globals.css rather than Tailwind's
   * `animate-pulse`: it only dims to {@link PROGRESS_BAR_PULSE_MIN_OPACITY},
   * so the active step keeps AA contrast mid-pulse. Off under reduced motion.
   */
  activePulse:
    "animate-pulse-soft motion-reduce:animate-none transition-transform duration-300",
  nodeTransition: "transition-all duration-300 ease-out transform active:scale-95",
  completedCheck: "animate-fade-in transition-all duration-300",
  errorAlert: "animate-shake transition-opacity duration-200",
  stepHover: "hover:scale-105 hover:shadow-lg transition-transform duration-200",
};

// =============================================================
// Mobile Viewport Navigation & Overlay Wrappers (Issue #416)
// =============================================================

export type ProgressBarViewport = "mobile" | "tablet" | "desktop";

export const PROGRESS_BAR_TABLET_MIN_WIDTH = 640;
export const PROGRESS_BAR_DESKTOP_MIN_WIDTH = 1024;

export function classifyProgressBarViewport(width: number): ProgressBarViewport {
  if (typeof width !== "number" || !Number.isFinite(width) || width < 0) {
    return "mobile";
  }
  if (width >= PROGRESS_BAR_DESKTOP_MIN_WIDTH) return "desktop";
  if (width >= PROGRESS_BAR_TABLET_MIN_WIDTH) return "tablet";
  return "mobile";
}

export interface ProgressBarLayout {
  viewport: ProgressBarViewport;
  stackSteps: boolean;
  showDescriptions: boolean;
  indicatorSizeClass: string;
  isOverlayModal: boolean;
}

export function getProgressBarLayout(width: number, forceOverlay = false): ProgressBarLayout {
  const viewport = classifyProgressBarViewport(width);
  switch (viewport) {
    case "desktop":
      return {
        viewport,
        stackSteps: false,
        showDescriptions: true,
        indicatorSizeClass: "h-10 w-10 text-sm",
        isOverlayModal: forceOverlay,
      };
    case "tablet":
      return {
        viewport,
        stackSteps: false,
        showDescriptions: false,
        indicatorSizeClass: "h-8 w-8 text-xs",
        isOverlayModal: forceOverlay,
      };
    case "mobile":
    default:
      return {
        viewport,
        stackSteps: true,
        showDescriptions: true,
        indicatorSizeClass: "h-7 w-7 text-xs",
        isOverlayModal: forceOverlay || true,
      };
  }
}

export const MOBILE_OVERLAY_WRAPPER_CLASSES = {
  backdrop: "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3",
  panel: "w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-gray-800 bg-[#111827] p-5 shadow-2xl animate-slide-in",
  stickyBottom: "fixed bottom-0 left-0 right-0 z-40 border-t border-gray-800 bg-[#111827]/95 p-3 backdrop-blur shadow-lg",
};

// =============================================================
// Interactive States Utilities (Issue #411)
// =============================================================

export const PROGRESS_BAR_INTERACTIVE_CLASSES = {
  stepInteractive:
    "transition-all duration-200 cursor-pointer hover:border-[var(--color-accent-soft)] hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-soft)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-card)]",
  stepDisabled:
    "cursor-not-allowed opacity-50 hover:scale-100 hover:border-transparent pointer-events-none",
};

// =============================================================
// Validation Rules & Error Indicators (Issue #414)
// =============================================================

export interface StepItem {
  id: string;
  title: string;
  description?: string;
}

export interface ProgressBarValidationResult {
  isValid: boolean;
  errors: string[];
  alertMessage: string | null;
}

export function validateProgressBarConfig(
  steps: StepItem[] | null | undefined,
  currentStepIndex: number
): ProgressBarValidationResult {
  const errors: string[] = [];

  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    errors.push("Progress bar requires at least one step.");
  } else {
    steps.forEach((step, idx) => {
      if (!step.id || step.id.trim() === "") {
        errors.push(`Step ${idx + 1} has an empty identifier.`);
      }
      if (!step.title || step.title.trim() === "") {
        errors.push(`Step ${idx + 1} is missing a title.`);
      }
    });

    if (currentStepIndex < 0 || currentStepIndex >= steps.length) {
      errors.push(`Current step index (${currentStepIndex}) is out of bounds [0, ${steps.length - 1}].`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    alertMessage: errors.length > 0 ? errors[0] : null,
  };
}

// =============================================================
// Empty Data States
// =============================================================

export interface ProgressBarEmptyCopy {
  title: string;
  description: string;
}

/** Copy for the placeholder shown when there are no steps to track. */
export const PROGRESS_BAR_EMPTY_COPY: ProgressBarEmptyCopy = {
  title: "No transaction in progress",
  description:
    "When you sign an action such as funding, releasing, or resolving a milestone, each step of its progress will appear here.",
};

/**
 * Whether a steps list has nothing to show: missing, not an array, empty, or
 * made up only of null / untitled entries. An explicit empty list is a normal
 * "nothing in flight" state, so it gets a placeholder rather than an error.
 */
export function isProgressBarEmpty(steps: unknown): boolean {
  if (!Array.isArray(steps) || steps.length === 0) return true;
  return steps.every(
    (step) =>
      !step ||
      typeof step !== "object" ||
      typeof (step as StepItem).title !== "string" ||
      (step as StepItem).title.trim() === ""
  );
}

export const PROGRESS_BAR_PLACEHOLDER_CLASSES = {
  container:
    "flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center animate-fade-in motion-reduce:animate-none " +
    "bg-[var(--color-surface-card)] border-[var(--color-border-subtle)]",
  track: "flex items-center gap-2",
  trackDot: "h-2.5 w-2.5 rounded-full bg-[var(--color-surface-field)] border border-[var(--color-border-subtle)]",
  trackLine: "h-0.5 w-6 rounded-full bg-[var(--color-border-subtle)]",
  title: "text-sm font-semibold text-[var(--color-text-secondary)]",
  description: "max-w-sm text-xs text-[var(--color-text-muted)]",
} as const;

// =============================================================
// Accessibility: step states, names and announcements
// =============================================================

export type ProgressStepState = "completed" | "active" | "failed" | "pending";

/** Human-readable state appended to each step's accessible name. */
export const PROGRESS_STEP_STATE_LABEL: Record<ProgressStepState, string> = {
  completed: "completed",
  active: "in progress",
  failed: "failed",
  pending: "not started",
};

/** Resolves a step's state from its position and the bar's overall status. */
export function getProgressStepState(
  index: number,
  currentStepIndex: number,
  status: "active" | "completed" | "failed"
): ProgressStepState {
  if (index < currentStepIndex) return "completed";
  if (index > currentStepIndex) return "pending";
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "active";
}

/** Accessible name for a step node, e.g. "Step 2 of 4: Sign, in progress". */
export function getProgressStepName(
  title: string,
  index: number,
  total: number,
  state: ProgressStepState
): string {
  return `Step ${index + 1} of ${total}: ${title}, ${PROGRESS_STEP_STATE_LABEL[state]}`;
}

/**
 * Sentence announced through the bar's polite live region whenever the
 * current step or status changes. Returns `null` when the index is out of
 * bounds (the validation alert already covers that case).
 */
export function getProgressAnnouncement(
  steps: readonly StepItem[],
  currentStepIndex: number,
  status: "active" | "completed" | "failed"
): string | null {
  const step = steps[currentStepIndex];
  if (!step) return null;
  const position = `Step ${currentStepIndex + 1} of ${steps.length}`;
  if (status === "completed" && currentStepIndex === steps.length - 1) {
    return `Transaction complete. ${position}: ${step.title}, completed.`;
  }
  return `${position}: ${step.title}, ${PROGRESS_STEP_STATE_LABEL[getProgressStepState(currentStepIndex, currentStepIndex, status)]}.`;
}

// =============================================================
// Accessibility: colour contrast (WCAG 2.1 AA)
// =============================================================

/** Lowest opacity the active step reaches mid-pulse (see `pulse-soft`). */
export const PROGRESS_BAR_PULSE_MIN_OPACITY = 0.85;

/** Colours used by the bar that are not theme tokens. */
export const PROGRESS_BAR_FIXED_COLOURS = {
  white: "#ffffff",
} as const;

type ContrastColour = TransactionProgressToken | keyof typeof PROGRESS_BAR_FIXED_COLOURS;

export interface ProgressBarContrastPair {
  usage: string;
  foreground: ContrastColour;
  background: ContrastColour;
  /** 4.5 for text; 3 for icons, focus rings and other non-text UI. */
  minRatio: number;
}

/** Resolves a token or fixed colour name to its hex value. */
export function resolveProgressBarColour(name: ContrastColour): string {
  return name in PROGRESS_BAR_FIXED_COLOURS
    ? PROGRESS_BAR_FIXED_COLOURS[name as keyof typeof PROGRESS_BAR_FIXED_COLOURS]
    : TRANSACTION_PROGRESS_TOKENS[name as TransactionProgressToken];
}

/** Every foreground/background pairing the bar renders. */
export const PROGRESS_BAR_CONTRAST_PAIRS: readonly ProgressBarContrastPair[] = [
  { usage: "active step number", foreground: "white", background: "accent", minRatio: 4.5 },
  { usage: "pending step number", foreground: "text-muted", background: "surface-field", minRatio: 4.5 },
  { usage: "completed step icon", foreground: "white", background: "success", minRatio: 3 },
  { usage: "failed step icon", foreground: "white", background: "danger", minRatio: 3 },
  { usage: "active step label", foreground: "text-primary", background: "surface-card", minRatio: 4.5 },
  { usage: "completed step label", foreground: "text-secondary", background: "surface-card", minRatio: 4.5 },
  { usage: "pending step label / description", foreground: "text-muted", background: "surface-card", minRatio: 4.5 },
  { usage: "validation alert", foreground: "danger-soft", background: "surface-field", minRatio: 4.5 },
  { usage: "overlay close button", foreground: "text-muted", background: "surface-field", minRatio: 4.5 },
  { usage: "placeholder title", foreground: "text-secondary", background: "surface-card", minRatio: 4.5 },
  { usage: "placeholder description", foreground: "text-muted", background: "surface-card", minRatio: 4.5 },
  { usage: "focus ring", foreground: "accent-soft", background: "surface-card", minRatio: 3 },
];
