import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import CreateJob from "@/app/create/page";

const mockUseWallet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

describe("Response Deadline validation and features", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: [{ address: "CTOKEN", symbol: "USDC" }],
        }),
      }),
    );
    mockUseWallet.mockReturnValue({
      address: "GTEST",
      signTransaction: vi.fn(),
    });
  });

  describe("Preset buttons", () => {
    it("renders all four preset buttons (3, 7, 14, 30 days)", () => {
      render(<CreateJob />);

      expect(screen.getByRole("button", { name: "3 days" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "7 days" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "14 days" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "30 days" })).toBeInTheDocument();
    });

    it("highlights the currently selected preset (default 7 days)", () => {
      render(<CreateJob />);

      const sevenDayButton = screen.getByRole("button", { name: "7 days" });
      expect(sevenDayButton).toHaveClass("border-accent-soft", "bg-accent/10");
    });

    it("sets the input value when a preset is clicked", () => {
      render(<CreateJob />);

      const input = screen.getByLabelText(
        "Response Deadline (days)",
      ) as HTMLInputElement;
      const fourteenDayButton = screen.getByRole("button", { name: "14 days" });

      fireEvent.click(fourteenDayButton);

      expect(input.value).toBe("14");
    });

    it("highlights the correct preset after clicking", () => {
      render(<CreateJob />);

      const threeDayButton = screen.getByRole("button", { name: "3 days" });
      const sevenDayButton = screen.getByRole("button", { name: "7 days" });

      fireEvent.click(threeDayButton);

      expect(threeDayButton).toHaveClass("border-accent-soft", "bg-accent/10");
      expect(sevenDayButton).not.toHaveClass("border-accent-soft");
    });

    it("clears validation errors when a preset is clicked", async () => {
      render(<CreateJob />);

      const input = screen.getByLabelText("Response Deadline (days)");

      // Trigger an error by entering invalid value and blurring
      fireEvent.change(input, { target: { value: "500" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText("Must be at most 365 days")).toBeInTheDocument();
      });

      // Click a preset
      const sevenDayButton = screen.getByRole("button", { name: "7 days" });
      fireEvent.click(sevenDayButton);

      // Error should be cleared
      expect(screen.queryByText("Must be at most 365 days")).not.toBeInTheDocument();
    });
  });

  describe("Validation", () => {
    it("shows error when field is empty on blur", async () => {
      render(<CreateJob />);

      const input = screen.getByLabelText("Response Deadline (days)");

      fireEvent.change(input, { target: { value: "" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(
          screen.getByText("Response deadline is required"),
        ).toBeInTheDocument();
      });
    });

    it("shows error for non-integer values", async () => {
      render(<CreateJob />);

      const input = screen.getByLabelText("Response Deadline (days)");

      fireEvent.change(input, { target: { value: "3.5" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(
          screen.getByText("Must be a whole number of days"),
        ).toBeInTheDocument();
      });
    });

    it("shows error for values less than 1", async () => {
      render(<CreateJob />);

      const input = screen.getByLabelText("Response Deadline (days)");

      fireEvent.change(input, { target: { value: "0" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText("Must be at least 1 day")).toBeInTheDocument();
      });
    });

    it("shows error for negative values", async () => {
      render(<CreateJob />);

      const input = screen.getByLabelText("Response Deadline (days)");

      fireEvent.change(input, { target: { value: "-5" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByText("Must be at least 1 day")).toBeInTheDocument();
      });
    });

    it("shows error for values greater than 365", async () => {
      render(<CreateJob />);

      const input = screen.getByLabelText("Response Deadline (days)");

      fireEvent.change(input, { target: { value: "400" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(
          screen.getByText("Must be at most 365 days"),
        ).toBeInTheDocument();
      });
    });

    it("accepts valid values between 1 and 365", async () => {
      render(<CreateJob />);

      const input = screen.getByLabelText("Response Deadline (days)");

      fireEvent.change(input, { target: { value: "100" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(
          screen.queryByText("Response deadline is required"),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText("Must be a whole number of days"),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText("Must be at least 1 day"),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText("Must be at most 365 days"),
        ).not.toBeInTheDocument();
      });
    });

    it("applies error border style when there's an error", async () => {
      render(<CreateJob />);

      const input = screen.getByLabelText("Response Deadline (days)");

      fireEvent.change(input, { target: { value: "500" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(input).toHaveClass("border-danger");
      });
    });

    it("has correct aria-invalid attribute when there's an error", async () => {
      render(<CreateJob />);

      const input = screen.getByLabelText("Response Deadline (days)");

      fireEvent.change(input, { target: { value: "500" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(input).toHaveAttribute("aria-invalid", "true");
      });
    });

    it("clears error when valid value is entered after an error", async () => {
      render(<CreateJob />);

      const input = screen.getByLabelText("Response Deadline (days)");

      // First trigger an error
      fireEvent.change(input, { target: { value: "500" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(
          screen.getByText("Must be at most 365 days"),
        ).toBeInTheDocument();
      });

      // Now enter a valid value
      fireEvent.change(input, { target: { value: "30" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(
          screen.queryByText("Must be at most 365 days"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Human-readable preview", () => {
    it("shows preview message for valid deadline", () => {
      render(<CreateJob />);

      const preview = screen.getByText(
        /Freelancer can claim funds automatically after 7 days if you do not respond/,
      );
      expect(preview).toBeInTheDocument();
    });

    it("updates preview when value changes", async () => {
      render(<CreateJob />);

      const input = screen.getByLabelText("Response Deadline (days)");

      fireEvent.change(input, { target: { value: "30" } });

      await waitFor(() => {
        expect(
          screen.getByText(
            /Freelancer can claim funds automatically after 30 days if you do not respond/,
          ),
        ).toBeInTheDocument();
      });
    });

    it("uses singular 'day' for value of 1", async () => {
      render(<CreateJob />);

      const input = screen.getByLabelText("Response Deadline (days)");

      fireEvent.change(input, { target: { value: "1" } });

      await waitFor(() => {
        expect(
          screen.getByText(
            /Freelancer can claim funds automatically after 1 day if you do not respond/,
          ),
        ).toBeInTheDocument();
      });
    });

    it("hides preview when there's a validation error", async () => {
      render(<CreateJob />);

      const input = screen.getByLabelText("Response Deadline (days)");

      fireEvent.change(input, { target: { value: "500" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(
          screen.queryByText(/Freelancer can claim funds automatically/),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Submit validation", () => {
    it("prevents submission with invalid deadline and shows error", async () => {
      render(<CreateJob />);

      const input = screen.getByLabelText("Response Deadline (days)");
      const submitButton = screen.getByRole("button", { name: /create job/i });

      // Set invalid value
      fireEvent.change(input, { target: { value: "500" } });

      // Try to submit
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Please fix the response deadline before creating a job."),
        ).toBeInTheDocument();
        expect(
          screen.getByText("Must be at most 365 days"),
        ).toBeInTheDocument();
      });
    });

    it("validates empty deadline on submit", async () => {
      render(<CreateJob />);

      const input = screen.getByLabelText("Response Deadline (days)");
      const submitButton = screen.getByRole("button", { name: /create job/i });

      // Clear the field
      fireEvent.change(input, { target: { value: "" } });

      // Try to submit
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("Please fix the response deadline before creating a job."),
        ).toBeInTheDocument();
        expect(
          screen.getByText("Response deadline is required"),
        ).toBeInTheDocument();
      });
    });
  });
});
