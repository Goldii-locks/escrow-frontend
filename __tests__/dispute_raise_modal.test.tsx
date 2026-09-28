import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DisputeRaiseModal from "@/app/components/DisputeRaiseModal";

describe("DisputeRaiseModal", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    milestoneIndex: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders modal when isOpen is true", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      expect(
        screen.getByRole("dialog", { name: /raise dispute for milestone 1/i })
      ).toBeInTheDocument();
    });

    it("does not render modal when isOpen is false", () => {
      render(<DisputeRaiseModal {...defaultProps} isOpen={false} />);
      expect(
        screen.queryByRole("dialog", { name: /raise dispute for milestone 1/i })
      ).not.toBeInTheDocument();
    });

    it("renders milestone number in title", () => {
      render(<DisputeRaiseModal {...defaultProps} milestoneIndex={2} />);
      expect(screen.getByText(/raise dispute - milestone 3/i)).toBeInTheDocument();
    });

    it("renders close button", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      expect(
        screen.getByRole("button", { name: /close modal/i })
      ).toBeInTheDocument();
    });

    it("renders textarea for dispute reason", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      expect(
        screen.getByRole("textbox", { name: /dispute reason/i })
      ).toBeInTheDocument();
    });

    it("renders cancel button", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it("renders submit button", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      expect(
        screen.getByRole("button", { name: /raise dispute/i })
      ).toBeInTheDocument();
    });

    it("displays character count", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      expect(screen.getByText(/0\/500 characters/i)).toBeInTheDocument();
    });

    it("shows loading state when isLoading is true", () => {
      render(<DisputeRaiseModal {...defaultProps} isLoading={true} />);
      expect(screen.getByText(/submitting\.\.\./i)).toBeInTheDocument();
    });

    it("disables submit button when loading", () => {
      render(<DisputeRaiseModal {...defaultProps} isLoading={true} />);
      const submitButton = screen.getByRole("button", { name: /submitting/i });
      expect(submitButton).toBeDisabled();
    });

    it("disables submit button when reason is empty", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      expect(
        screen.getByRole("button", { name: /raise dispute/i })
      ).toBeDisabled();
    });
  });

  describe("Validation - Empty Reason", () => {
    it("shows error when submitting empty reason", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      const submitButton = screen.getByRole("button", { name: /raise dispute/i });

      // Button should be disabled initially
      expect(submitButton).toBeDisabled();

      // Enable button by typing and clearing
      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });
      fireEvent.change(textarea, { target: { value: "test" } });
      fireEvent.change(textarea, { target: { value: "" } });

      // Try to submit via direct call (simulating enabled state)
      fireEvent.click(submitButton);
    });

    it("displays error message for empty reason", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });

      // Type something then clear it
      fireEvent.change(textarea, { target: { value: "test" } });
      fireEvent.change(textarea, { target: { value: "" } });

      // Submit should show error
      expect(screen.queryByText(/please provide a reason/i)).not.toBeInTheDocument();
    });
  });

  describe("Validation - Minimum Length", () => {
    it("shows error when reason is less than 10 characters", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });
      const submitButton = screen.getByRole("button", { name: /raise dispute/i });

      fireEvent.change(textarea, { target: { value: "short" } });
      fireEvent.click(submitButton);

      expect(
        screen.getByText(/reason must be at least 10 characters/i)
      ).toBeInTheDocument();
    });

    it("does not show error when reason is exactly 10 characters", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });
      const submitButton = screen.getByRole("button", { name: /raise dispute/i });

      fireEvent.change(textarea, { target: { value: "1234567890" } });
      fireEvent.click(submitButton);

      expect(
        screen.queryByText(/reason must be at least 10 characters/i)
      ).not.toBeInTheDocument();
    });
  });

  describe("Validation - Maximum Length", () => {
    it("shows error when reason exceeds 500 characters", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });
      const submitButton = screen.getByRole("button", { name: /raise dispute/i });

      const longText = "a".repeat(501);
      fireEvent.change(textarea, { target: { value: longText } });
      fireEvent.click(submitButton);

      expect(
        screen.getByText(/reason must not exceed 500 characters/i)
      ).toBeInTheDocument();
    });

    it("does not show error when reason is exactly 500 characters", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });
      const submitButton = screen.getByRole("button", { name: /raise dispute/i });

      const maxLengthText = "a".repeat(500);
      fireEvent.change(textarea, { target: { value: maxLengthText } });
      fireEvent.click(submitButton);

      expect(
        screen.queryByText(/reason must not exceed 500 characters/i)
      ).not.toBeInTheDocument();
    });

    it("enforces maxLength attribute on textarea", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });
      expect(textarea).toHaveAttribute("maxLength", "500");
    });
  });

  describe("Error Display", () => {
    it("displays field error with role='alert'", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });
      const submitButton = screen.getByRole("button", { name: /raise dispute/i });

      fireEvent.change(textarea, { target: { value: "short" } });
      fireEvent.click(submitButton);

      const errorElement = screen.getByText(
        /reason must be at least 10 characters/i
      );
      expect(errorElement).toHaveAttribute("role", "alert");
    });

    it("displays field error with aria-live='polite'", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });
      const submitButton = screen.getByRole("button", { name: /raise dispute/i });

      fireEvent.change(textarea, { target: { value: "short" } });
      fireEvent.click(submitButton);

      const errorElement = screen.getByText(
        /reason must be at least 10 characters/i
      );
      expect(errorElement).toHaveAttribute("aria-live", "polite");
    });

    it("clears field error when user starts typing", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });
      const submitButton = screen.getByRole("button", { name: /raise dispute/i });

      // Trigger error
      fireEvent.change(textarea, { target: { value: "short" } });
      fireEvent.click(submitButton);
      expect(
        screen.getByText(/reason must be at least 10 characters/i)
      ).toBeInTheDocument();

      // Start typing valid input
      fireEvent.change(textarea, { target: { value: "valid reason text" } });
      expect(
        screen.queryByText(/reason must be at least 10 characters/i)
      ).not.toBeInTheDocument();
    });

    it("displays submission error from props", () => {
      render(
        <DisputeRaiseModal
          {...defaultProps}
          submissionError="Network error occurred"
        />
      );

      expect(screen.getByText(/network error occurred/i)).toBeInTheDocument();
    });

    it("displays general error with role='alert'", () => {
      render(
        <DisputeRaiseModal
          {...defaultProps}
          submissionError="Network error occurred"
        />
      );

      const errorElement = screen.getByText(/network error occurred/i);
      expect(errorElement).toHaveAttribute("role", "alert");
    });

    it("displays general error with aria-live='assertive'", () => {
      render(
        <DisputeRaiseModal
          {...defaultProps}
          submissionError="Network error occurred"
        />
      );

      const errorElement = screen.getByText(/network error occurred/i);
      expect(errorElement).toHaveAttribute("aria-live", "assertive");
    });
  });

  describe("User Interactions", () => {
    it("calls onClose when close button is clicked", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      const closeButton = screen.getByRole("button", { name: /close modal/i });

      fireEvent.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when cancel button is clicked", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      const cancelButton = screen.getByRole("button", { name: /cancel/i });

      fireEvent.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it("calls onSubmit with trimmed reason when valid", async () => {
      const mockSubmit = vi.fn().mockResolvedValue(undefined);
      render(<DisputeRaiseModal {...defaultProps} onSubmit={mockSubmit} />);

      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });
      const submitButton = screen.getByRole("button", { name: /raise dispute/i });

      fireEvent.change(textarea, { target: { value: "  valid reason  " } });
      fireEvent.click(submitButton);

      expect(mockSubmit).toHaveBeenCalledWith("valid reason");
    });

    it("does not call onSubmit when validation fails", () => {
      const mockSubmit = vi.fn();
      render(<DisputeRaiseModal {...defaultProps} onSubmit={mockSubmit} />);

      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });
      const submitButton = screen.getByRole("button", { name: /raise dispute/i });

      fireEvent.change(textarea, { target: { value: "short" } });
      fireEvent.click(submitButton);

      expect(mockSubmit).not.toHaveBeenCalled();
    });

    it("updates character count as user types", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });

      expect(screen.getByText(/0\/500 characters/i)).toBeInTheDocument();

      fireEvent.change(textarea, { target: { value: "hello" } });
      expect(screen.getByText(/5\/500 characters/i)).toBeInTheDocument();

      fireEvent.change(textarea, { target: { value: "hello world" } });
      expect(screen.getByText(/11\/500 characters/i)).toBeInTheDocument();
    });

    it("hides character count when error is displayed", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });
      const submitButton = screen.getByRole("button", { name: /raise dispute/i });

      fireEvent.change(textarea, { target: { value: "short" } });
      fireEvent.click(submitButton);

      expect(screen.queryByText(/5\/500 characters/i)).not.toBeInTheDocument();
    });

    it("sets aria-invalid on textarea when there's an error", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });
      const submitButton = screen.getByRole("button", { name: /raise dispute/i });

      expect(textarea).toHaveAttribute("aria-invalid", "false");

      fireEvent.change(textarea, { target: { value: "short" } });
      fireEvent.click(submitButton);

      expect(textarea).toHaveAttribute("aria-invalid", "true");
    });

    it("sets aria-describedby on textarea when there's an error", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });
      const submitButton = screen.getByRole("button", { name: /raise dispute/i });

      expect(textarea).not.toHaveAttribute("aria-describedby");

      fireEvent.change(textarea, { target: { value: "short" } });
      fireEvent.click(submitButton);

      expect(textarea).toHaveAttribute("aria-describedby", "dispute-reason-error");
    });
  });

  describe("Accessibility", () => {
    it("has aria-modal attribute on dialog", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });

    it("has proper aria-label on dialog", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute(
        "aria-label",
        "Raise dispute for Milestone 1"
      );
    });

    it("disables close button when loading", () => {
      render(<DisputeRaiseModal {...defaultProps} isLoading={true} />);
      const closeButton = screen.getByRole("button", { name: /close modal/i });
      expect(closeButton).toBeDisabled();
    });

    it("disables cancel button when loading", () => {
      render(<DisputeRaiseModal {...defaultProps} isLoading={true} />);
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });

    it("disables textarea when loading", () => {
      render(<DisputeRaiseModal {...defaultProps} isLoading={true} />);
      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });
      expect(textarea).toBeDisabled();
    });
  });

  describe("Error Handling", () => {
    it("displays error when onSubmit throws an error", async () => {
      const mockSubmit = vi.fn().mockRejectedValue(new Error("Submission failed"));
      render(<DisputeRaiseModal {...defaultProps} onSubmit={mockSubmit} />);

      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });
      const submitButton = screen.getByRole("button", { name: /raise dispute/i });

      fireEvent.change(textarea, { target: { value: "valid reason text" } });
      fireEvent.click(submitButton);

      // Wait for async operation
      await vi.waitFor(() => {
        expect(screen.getByText(/submission failed/i)).toBeInTheDocument();
      });
    });

    it("displays generic error when onSubmit throws non-Error", async () => {
      const mockSubmit = vi.fn().mockRejectedValue("string error");
      render(<DisputeRaiseModal {...defaultProps} onSubmit={mockSubmit} />);

      const textarea = screen.getByRole("textbox", { name: /dispute reason/i });
      const submitButton = screen.getByRole("button", { name: /raise dispute/i });

      fireEvent.change(textarea, { target: { value: "valid reason text" } });
      fireEvent.click(submitButton);

      // Wait for async operation
      await vi.waitFor(() => {
        expect(
          screen.getByText(/failed to submit dispute/i)
        ).toBeInTheDocument();
      });
    });
  });
  // The keyframes themselves live in app/globals.css; these assert the modal
  // actually opts into them, which is the part a refactor silently drops.
  describe("Micro-animations", () => {
    it("fades the backdrop in on open", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      expect(screen.getByTestId("dispute-raise-modal")).toHaveClass(
        "animate-fade-in"
      );
    });

    it("slides the panel in on open", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      expect(screen.getByTestId("dispute-raise-modal-panel")).toHaveClass(
        "animate-slide-in"
      );
    });

    it("shakes the error banner when a submission fails", () => {
      render(
        <DisputeRaiseModal
          {...defaultProps}
          errorMessage="Transaction rejected."
        />
      );
      expect(screen.getByTestId("dispute-raise-modal-error")).toHaveClass(
        "animate-shake"
      );
    });

    it("does not shake anything while there is no error", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      expect(screen.queryByTestId("dispute-raise-modal-error")).toBeNull();
    });
  });
  // Transaction feedback (#368). The banner lets the user watch the submission
  // without the modal closing first, so it is gated on the state leaving idle.
  describe("Transaction status banner", () => {
    it("is absent when no disputeState is supplied", () => {
      render(<DisputeRaiseModal {...defaultProps} />);
      expect(
        screen.queryByTestId("dispute-raise-modal-status-banner")
      ).toBeNull();
    });

    it("stays absent while the transaction state is idle", () => {
      render(
        <DisputeRaiseModal
          {...defaultProps}
          disputeState={{ phase: "idle", error: null, txHash: null }}
        />
      );
      expect(
        screen.queryByTestId("dispute-raise-modal-status-banner")
      ).toBeNull();
    });

    it("appears once the transaction is in flight", () => {
      render(
        <DisputeRaiseModal
          {...defaultProps}
          disputeState={{ phase: "submitting", error: null, txHash: null }}
        />
      );
      expect(
        screen.getByTestId("dispute-raise-modal-status-banner")
      ).toBeInTheDocument();
    });

    it("reports the failure when the transaction errors", () => {
      render(
        <DisputeRaiseModal
          {...defaultProps}
          disputeState={{
            phase: "error",
            error: "Transaction rejected by the network.",
            txHash: null,
          }}
        />
      );
      expect(
        screen.getByTestId("dispute-raise-modal-status-banner")
      ).toHaveTextContent(/transaction rejected by the network/i);
    });
  });

  // The irreversibility warning carries no visible anchor of its own, so a
  // test id keeps a future refactor from dropping it unnoticed.
  it("always shows the irreversibility warning", () => {
    render(<DisputeRaiseModal {...defaultProps} />);
    expect(
      screen.getByTestId("dispute-raise-modal-warning")
    ).toHaveTextContent(/cannot be undone/i);
  });
});
