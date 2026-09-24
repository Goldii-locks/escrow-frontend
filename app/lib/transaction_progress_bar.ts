/**
 * transaction_progress_bar — Pure helpers and design token mappings backing the
 * transaction progress indicator (`app/components/TransactionProgressBar.tsx`).
 *
 * Implements:
 * - Interactive state classes (hover, focus-visible, disabled) (Issue #411)
 * - Responsive sizing and layout rules across viewports (Issue #412)
 * - Validation error indicators and accessible alerts (Issue #414)
 * - Design token mapping linking Tailwind classes to core theme variables (Issue #417)
 */

// =============================================================
// Core Design Variables & Tokens Mapping (Issue #417)
// =============================================================

/**
 * Core design tokens mirroring the `@theme inline` block in `app/globals.css`.
 * Linking these directly ensures class allocations match the central color scheme.
 */
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

/**
 * Linked Tailwind CSS class allocations referencing the core design tokens.
 */
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
// Responsive Viewport Sizing (Issue #412)
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
}

export function getProgressBarLayout(width: number): ProgressBarLayout {
  const viewport = classifyProgressBarViewport(width);
  switch (viewport) {
    case "desktop":
      return {
        viewport,
        stackSteps: false,
        showDescriptions: true,
        indicatorSizeClass: "h-10 w-10 text-sm",
      };
    case "tablet":
      return {
        viewport,
        stackSteps: false,
        showDescriptions: false,
        indicatorSizeClass: "h-8 w-8 text-xs",
      };
    case "mobile":
    default:
      return {
        viewport,
        stackSteps: true,
        showDescriptions: true,
        indicatorSizeClass: "h-7 w-7 text-xs",
      };
  }
}

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
