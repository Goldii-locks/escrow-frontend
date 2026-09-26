/**
 * platform_metrics_charts — double-confirm modal logic (#515).
 * Submission is blocked until the confirmation dialog has been opened and
 * confirmed — matching the two-step pattern in
 * `admin_fee_configuration_modals.ts` and `contract_pause_switch_modals.ts`.
 * Kept free of React so every rule can be asserted directly in tests.
 */

// =============================================================
// Types
// =============================================================

export type MetricsAction =
  | "export_csv"
  | "reset_filters"
  | "refresh_data"
  | "apply_threshold";

export interface MetricsConfirmModal {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

/** Two-step confirm state: idle → confirming → confirmed (or back to idle). */
export type MetricsConfirmStep = "idle" | "confirming" | "confirmed";

// =============================================================
// Modal copy builder
// =============================================================

/**
 * Returns the copy for the confirmation dialog for the given action.
 * `payload` carries optional context (e.g. a date range or threshold value)
 * that is interpolated into the message.
 */
export function buildMetricsConfirmModal(
  action: MetricsAction,
  payload?: { dateRange?: string; threshold?: string },
): MetricsConfirmModal {
  switch (action) {
    case "export_csv":
      return {
        title: "Export metrics as CSV?",
        message: payload?.dateRange
          ? `This will export platform metrics for the period "${payload.dateRange}" as a CSV file.`
          : "This will export the current platform metrics view as a CSV file.",
        confirmLabel: "Yes, export",
        cancelLabel: "Cancel",
      };

    case "reset_filters":
      return {
        title: "Reset all filters?",
        message:
          "This will clear all active date-range and metric filters and reload the full dataset.",
        confirmLabel: "Yes, reset",
        cancelLabel: "Cancel",
      };

    case "refresh_data":
      return {
        title: "Refresh metrics data?",
        message:
          "This will discard any unsaved filter changes and fetch the latest platform stats from the network.",
        confirmLabel: "Yes, refresh",
        cancelLabel: "Cancel",
      };

    case "apply_threshold":
      return {
        title: "Apply threshold?",
        message: payload?.threshold
          ? `This will highlight chart data that exceeds ${payload.threshold} and requires re-rendering the view.`
          : "This will apply the configured threshold to the chart and re-render the view.",
        confirmLabel: "Yes, apply",
        cancelLabel: "Cancel",
      };
  }
}

// =============================================================
// State machine
// =============================================================

/**
 * Advance the confirm step based on the user event.
 *
 * - "submit"  — first click: idle → confirming; subsequent clicks are no-ops
 * - "confirm" — dialog confirm button: confirming → confirmed
 * - "cancel"  — either button cancels: any → idle
 */
export function nextMetricsConfirmStep(
  step: MetricsConfirmStep,
  event: "submit" | "confirm" | "cancel",
): MetricsConfirmStep {
  if (event === "cancel") return "idle";
  if (event === "submit") return step === "idle" ? "confirming" : step;
  return step === "confirming" ? "confirmed" : step;
}

/**
 * Returns `true` only when the dialog was explicitly confirmed, so the
 * signed transaction or destructive action may proceed.
 */
export function canSubmitMetricsAction(step: MetricsConfirmStep): boolean {
  return step === "confirmed";
}

// =============================================================
// Validation helpers
// =============================================================

/**
 * Validate a threshold string (must be a finite non-negative number).
 * Returns an error message or `null` when valid.
 */
export function validateMetricsThreshold(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return "Threshold is required.";
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return "Threshold must be a valid number.";
  if (num < 0) return "Threshold must be zero or greater.";
  return null;
}
