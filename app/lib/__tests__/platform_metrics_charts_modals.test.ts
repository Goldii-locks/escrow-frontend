/**
 * platform_metrics_charts_modals — unit tests (#515).
 * Confirms submit is blocked until the confirmation dialog triggers,
 * and that the state machine advances / resets correctly.
 */

import { describe, it, expect } from "vitest";
import {
  buildMetricsConfirmModal,
  canSubmitMetricsAction,
  nextMetricsConfirmStep,
  validateMetricsThreshold,
  type MetricsAction,
  type MetricsConfirmStep,
} from "../platform_metrics_charts_modals";

// =============================================================
// nextMetricsConfirmStep — state machine
// =============================================================

describe("nextMetricsConfirmStep", () => {
  it("advances from idle to confirming on submit", () => {
    expect(nextMetricsConfirmStep("idle", "submit")).toBe("confirming");
  });

  it("stays in confirming if submit is called again", () => {
    expect(nextMetricsConfirmStep("confirming", "submit")).toBe("confirming");
  });

  it("advances from confirming to confirmed on confirm", () => {
    expect(nextMetricsConfirmStep("confirming", "confirm")).toBe("confirmed");
  });

  it("confirm is a no-op when already confirmed", () => {
    expect(nextMetricsConfirmStep("confirmed", "confirm")).toBe("confirmed");
  });

  it("resets to idle from confirming on cancel", () => {
    expect(nextMetricsConfirmStep("confirming", "cancel")).toBe("idle");
  });

  it("resets to idle from confirmed on cancel", () => {
    expect(nextMetricsConfirmStep("confirmed", "cancel")).toBe("idle");
  });

  it("cancel from idle stays idle", () => {
    expect(nextMetricsConfirmStep("idle", "cancel")).toBe("idle");
  });

  it("confirm from idle is a no-op (not confirming)", () => {
    // confirm only advances from "confirming"; from "idle" it stays "idle"
    expect(nextMetricsConfirmStep("idle", "confirm")).toBe("idle");
  });
});

// =============================================================
// canSubmitMetricsAction — gate (#515 validation check)
// "Confirm submit is blocked until confirmation dialog triggers"
// =============================================================

describe("canSubmitMetricsAction", () => {
  it("returns false when step is idle", () => {
    expect(canSubmitMetricsAction("idle")).toBe(false);
  });

  it("returns false when step is confirming — submit is blocked", () => {
    // Validation check from #515: submit must be blocked until dialog is confirmed
    expect(canSubmitMetricsAction("confirming")).toBe(false);
  });

  it("returns true only when step is confirmed", () => {
    expect(canSubmitMetricsAction("confirmed")).toBe(true);
  });

  it("full flow: submit → confirming (blocked) → confirm → confirmed (allowed)", () => {
    let step: MetricsConfirmStep = "idle";

    // Step 1: user clicks the action button
    step = nextMetricsConfirmStep(step, "submit");
    expect(step).toBe("confirming");
    expect(canSubmitMetricsAction(step)).toBe(false); // still blocked

    // Step 2: user ticks checkbox and clicks confirm in the dialog
    step = nextMetricsConfirmStep(step, "confirm");
    expect(step).toBe("confirmed");
    expect(canSubmitMetricsAction(step)).toBe(true); // now allowed
  });

  it("cancel from confirming resets to blocked", () => {
    let step: MetricsConfirmStep = nextMetricsConfirmStep("idle", "submit");
    expect(canSubmitMetricsAction(step)).toBe(false);

    step = nextMetricsConfirmStep(step, "cancel");
    expect(step).toBe("idle");
    expect(canSubmitMetricsAction(step)).toBe(false);
  });
});

// =============================================================
// buildMetricsConfirmModal — copy builder
// =============================================================

describe("buildMetricsConfirmModal", () => {
  const ACTIONS: MetricsAction[] = [
    "export_csv",
    "reset_filters",
    "refresh_data",
    "apply_threshold",
  ];

  it("returns an object with title, message, confirmLabel and cancelLabel for every action", () => {
    for (const action of ACTIONS) {
      const modal = buildMetricsConfirmModal(action);
      expect(modal).toHaveProperty("title");
      expect(modal).toHaveProperty("message");
      expect(modal).toHaveProperty("confirmLabel");
      expect(modal).toHaveProperty("cancelLabel");
    }
  });

  it("all copy fields are non-empty strings for every action", () => {
    for (const action of ACTIONS) {
      const modal = buildMetricsConfirmModal(action);
      expect(modal.title.length).toBeGreaterThan(0);
      expect(modal.message.length).toBeGreaterThan(0);
      expect(modal.confirmLabel.length).toBeGreaterThan(0);
      expect(modal.cancelLabel.length).toBeGreaterThan(0);
    }
  });

  it("export_csv copy references CSV", () => {
    const modal = buildMetricsConfirmModal("export_csv");
    expect(modal.title.toLowerCase()).toMatch(/export/);
    expect(modal.message.toLowerCase()).toMatch(/csv/);
  });

  it("export_csv copy interpolates the date range when provided", () => {
    const modal = buildMetricsConfirmModal("export_csv", {
      dateRange: "2026-01-01",
    });
    expect(modal.message).toContain("2026-01-01");
  });

  it("apply_threshold copy interpolates the threshold when provided", () => {
    const modal = buildMetricsConfirmModal("apply_threshold", {
      threshold: "250",
    });
    expect(modal.message).toContain("250");
  });

  it("reset_filters copy references filters", () => {
    const modal = buildMetricsConfirmModal("reset_filters");
    expect(modal.message.toLowerCase()).toMatch(/filter/);
  });

  it("refresh_data copy references refresh or fetch", () => {
    const modal = buildMetricsConfirmModal("refresh_data");
    const text = `${modal.title} ${modal.message}`.toLowerCase();
    expect(text).toMatch(/refresh|fetch/);
  });

  it("cancelLabel is always 'Cancel'", () => {
    for (const action of ACTIONS) {
      expect(buildMetricsConfirmModal(action).cancelLabel).toBe("Cancel");
    }
  });
});

// =============================================================
// validateMetricsThreshold
// =============================================================

describe("validateMetricsThreshold", () => {
  it("returns null for a valid integer threshold", () => {
    expect(validateMetricsThreshold("100")).toBeNull();
  });

  it("returns null for a valid decimal threshold", () => {
    expect(validateMetricsThreshold("99.5")).toBeNull();
  });

  it("returns null for zero", () => {
    expect(validateMetricsThreshold("0")).toBeNull();
  });

  it("returns an error message for an empty string", () => {
    expect(validateMetricsThreshold("")).not.toBeNull();
  });

  it("returns an error message for a whitespace-only string", () => {
    expect(validateMetricsThreshold("   ")).not.toBeNull();
  });

  it("returns an error message for a non-numeric string", () => {
    expect(validateMetricsThreshold("abc")).not.toBeNull();
  });

  it("returns an error message for a negative value", () => {
    expect(validateMetricsThreshold("-1")).not.toBeNull();
  });

  it("returns null for a large valid threshold", () => {
    expect(validateMetricsThreshold("999999")).toBeNull();
  });

  it("error messages are non-empty strings", () => {
    const result = validateMetricsThreshold("");
    expect(typeof result).toBe("string");
    expect((result as string).length).toBeGreaterThan(0);
  });
});
