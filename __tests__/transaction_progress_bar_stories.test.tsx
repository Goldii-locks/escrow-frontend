import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TransactionProgressBar, { DEFAULT_TRANSACTION_STEPS } from "@/app/components/TransactionProgressBar";
import {
  PROGRESS_BAR_ANIMATION_CLASSES,
  MOBILE_OVERLAY_WRAPPER_CLASSES,
} from "@/app/lib/transaction_progress_bar";

describe("transaction_progress_bar stories, animations and mobile layout (Issues #415, #416, #418, #419)", () => {
  describe("CSS Micro-animations (Issue #415)", () => {
    it("renders active node with pulse animation classes", () => {
      render(
        <TransactionProgressBar
          steps={DEFAULT_TRANSACTION_STEPS}
          currentStepIndex={1}
          status="active"
        />
      );

      const activeNode = screen.getByTestId("step-node-1");
      expect(activeNode.className).toContain("animate-pulse");
      expect(activeNode.className).toContain(PROGRESS_BAR_ANIMATION_CLASSES.nodeTransition);
    });

    it("renders completed node with fade-in checkmark animation", () => {
      render(
        <TransactionProgressBar
          steps={DEFAULT_TRANSACTION_STEPS}
          currentStepIndex={2}
          status="active"
        />
      );

      const completedNode = screen.getByTestId("step-node-0");
      expect(completedNode.className).toContain(PROGRESS_BAR_ANIMATION_CLASSES.completedCheck);
    });

    it("renders validation alert with shake animation class", () => {
      render(
        <TransactionProgressBar
          steps={DEFAULT_TRANSACTION_STEPS}
          errorMessage="Ledger sequence error"
        />
      );

      const alert = screen.getByTestId("progress-bar-validation-alert");
      expect(alert.className).toContain(PROGRESS_BAR_ANIMATION_CLASSES.errorAlert);
    });
  });

  describe("Mobile Viewports Navigation Overlay (Issue #416)", () => {
    it("renders inside modal backdrop overlay when mobileOverlay is true", () => {
      render(
        <TransactionProgressBar
          steps={DEFAULT_TRANSACTION_STEPS}
          currentStepIndex={1}
          mobileOverlay={true}
        />
      );

      const overlay = screen.getByTestId("mobile-overlay-wrapper");
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveAttribute("role", "dialog");
      expect(overlay).toHaveAttribute("aria-modal", "true");
      expect(overlay.className).toContain("fixed inset-0");
    });

    it("fires onCloseOverlay when close button in overlay is clicked", () => {
      const onClose = vi.fn();
      render(
        <TransactionProgressBar
          steps={DEFAULT_TRANSACTION_STEPS}
          currentStepIndex={1}
          mobileOverlay={true}
          onCloseOverlay={onClose}
        />
      );

      const closeBtn = screen.getByRole("button", { name: /Close transaction overlay/i });
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Client-side Layout & Node Rendering (Issue #418, #419)", () => {
    it("renders all transaction step nodes correctly", () => {
      render(
        <TransactionProgressBar
          steps={DEFAULT_TRANSACTION_STEPS}
          currentStepIndex={0}
        />
      );

      expect(screen.getByTestId("step-node-0")).toBeInTheDocument();
      expect(screen.getByTestId("step-node-1")).toBeInTheDocument();
      expect(screen.getByTestId("step-node-2")).toBeInTheDocument();
      expect(screen.getByTestId("step-node-3")).toBeInTheDocument();
      expect(screen.getByText("Prepare")).toBeInTheDocument();
      expect(screen.getByText("Sign")).toBeInTheDocument();
      expect(screen.getByText("Submit")).toBeInTheDocument();
      expect(screen.getByText("Confirm")).toBeInTheDocument();
    });

    it("renders completed status across all nodes when confirmed", () => {
      render(
        <TransactionProgressBar
          steps={DEFAULT_TRANSACTION_STEPS}
          currentStepIndex={3}
          status="completed"
        />
      );

      for (let i = 0; i <= 3; i++) {
        const node = screen.getByTestId(`step-node-${i}`);
        expect(node.className).toContain("var(--color-success)");
      }
    });

    it("renders failed indicator when step fails", () => {
      render(
        <TransactionProgressBar
          steps={DEFAULT_TRANSACTION_STEPS}
          currentStepIndex={2}
          status="failed"
        />
      );

      const failedNode = screen.getByTestId("step-node-2");
      expect(failedNode.className).toContain("var(--color-danger)");
    });
  });
});
