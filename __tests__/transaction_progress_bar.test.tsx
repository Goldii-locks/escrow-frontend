import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TransactionProgressBar, { DEFAULT_TRANSACTION_STEPS } from "@/app/components/TransactionProgressBar";
import {
  TRANSACTION_PROGRESS_TOKENS,
  PROGRESS_BAR_THEME_CLASSES,
  PROGRESS_BAR_INTERACTIVE_CLASSES,
  classifyProgressBarViewport,
  getProgressBarLayout,
  validateProgressBarConfig,
} from "@/app/lib/transaction_progress_bar";

describe("transaction_progress_bar module", () => {
  describe("Design Tokens Mapping (Issue #417)", () => {
    it("defines core design tokens matching theme color palette", () => {
      expect(TRANSACTION_PROGRESS_TOKENS["surface-card"]).toBe("#111827");
      expect(TRANSACTION_PROGRESS_TOKENS["accent"]).toBe("#4f46e5");
      expect(TRANSACTION_PROGRESS_TOKENS["success"]).toBe("#16a34a");
      expect(TRANSACTION_PROGRESS_TOKENS["danger"]).toBe("#991b1b");
      expect(TRANSACTION_PROGRESS_TOKENS["text-primary"]).toBe("#f9fafb");
    });

    it("PROGRESS_BAR_THEME_CLASSES links allocations to theme CSS variables", () => {
      expect(PROGRESS_BAR_THEME_CLASSES.container).toContain("var(--color-surface-card)");
      expect(PROGRESS_BAR_THEME_CLASSES.stepActive).toContain("var(--color-accent)");
      expect(PROGRESS_BAR_THEME_CLASSES.stepCompleted).toContain("var(--color-success)");
      expect(PROGRESS_BAR_THEME_CLASSES.stepFailed).toContain("var(--color-danger)");
      expect(PROGRESS_BAR_THEME_CLASSES.alertError).toContain("var(--color-danger-soft)");
    });

    it("renders component container with theme token classes", () => {
      render(<TransactionProgressBar currentStepIndex={0} />);
      const container = screen.getByTestId("transaction-progress-bar-container");
      expect(container.className).toContain("var(--color-surface-card)");
    });
  });

  describe("Responsive Layouts (Issue #412)", () => {
    it("classifies viewport widths correctly", () => {
      expect(classifyProgressBarViewport(400)).toBe("mobile");
      expect(classifyProgressBarViewport(640)).toBe("tablet");
      expect(classifyProgressBarViewport(800)).toBe("tablet");
      expect(classifyProgressBarViewport(1024)).toBe("desktop");
      expect(classifyProgressBarViewport(1440)).toBe("desktop");
      expect(classifyProgressBarViewport(-10)).toBe("mobile");
    });

    it("getProgressBarLayout adjusts stack and descriptions per viewport", () => {
      const mobileLayout = getProgressBarLayout(375);
      expect(mobileLayout.stackSteps).toBe(true);

      const tabletLayout = getProgressBarLayout(768);
      expect(tabletLayout.stackSteps).toBe(false);
      expect(tabletLayout.showDescriptions).toBe(false);

      const desktopLayout = getProgressBarLayout(1280);
      expect(desktopLayout.stackSteps).toBe(false);
      expect(desktopLayout.showDescriptions).toBe(true);
    });
  });

  describe("Interactive States (Issue #411)", () => {
    it("PROGRESS_BAR_INTERACTIVE_CLASSES contains hover and focus-visible utilities", () => {
      expect(PROGRESS_BAR_INTERACTIVE_CLASSES.stepInteractive).toContain("focus-visible:ring");
      expect(PROGRESS_BAR_INTERACTIVE_CLASSES.stepInteractive).toContain("hover:border");
      expect(PROGRESS_BAR_INTERACTIVE_CLASSES.stepDisabled).toContain("opacity-50");
      expect(PROGRESS_BAR_INTERACTIVE_CLASSES.stepDisabled).toContain("cursor-not-allowed");
    });

    it("invokes onStepClick when clicking an interactive step", () => {
      const onStepClick = vi.fn();
      render(
        <TransactionProgressBar
          currentStepIndex={1}
          onStepClick={onStepClick}
        />
      );

      const step0Btn = screen.getByTestId("step-node-0");
      fireEvent.click(step0Btn);
      expect(onStepClick).toHaveBeenCalledWith(0);
    });

    it("disables step buttons when disabled prop is true", () => {
      render(
        <TransactionProgressBar
          currentStepIndex={1}
          disabled={true}
          onStepClick={vi.fn()}
        />
      );

      const step0Btn = screen.getByTestId("step-node-0");
      expect(step0Btn).toBeDisabled();
    });
  });

  describe("Validation Messages & Alerts (Issue #414)", () => {
    it("validates empty step configurations", () => {
      const result = validateProgressBarConfig([], 0);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Progress bar requires at least one step.");
    });

    it("validates out-of-bounds currentStepIndex", () => {
      const result = validateProgressBarConfig(DEFAULT_TRANSACTION_STEPS, 10);
      expect(result.isValid).toBe(false);
      expect(result.alertMessage).toContain("out of bounds");
    });

    it("renders validation alert when error is present", () => {
      render(
        <TransactionProgressBar
          steps={DEFAULT_TRANSACTION_STEPS}
          currentStepIndex={10}
        />
      );

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/out of bounds/i);
    });

    it("renders explicit errorMessage override in alert banner", () => {
      render(
        <TransactionProgressBar
          errorMessage="Custom ledger submission timeout."
        />
      );

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent("Custom ledger submission timeout.");
    });
  });
});
