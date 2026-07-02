/**
 * Issue #40 – A11y ARIA attribute compliance for create_job_form
 *
 * Validates proper ARIA attributes, keyboard navigability markers, and
 * semantic structure for screen-reader users.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateJob from "@/app/create/page";

const mockPush = vi.fn();
const mockUseWallet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

describe("Create form – a11y ARIA compliance (issue #40)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({
      address: "GCLIENTADDRESS",
      signTransaction: vi.fn(),
    });
  });

  it("form has an accessible name via aria-label", () => {
    render(<CreateJob />);
    expect(
      screen.getByRole("form", { name: "Create new escrow job" })
    ).toBeInTheDocument();
  });

  it("form carries aria-busy=false while idle", () => {
    render(<CreateJob />);
    const form = screen.getByRole("form", { name: "Create new escrow job" });
    expect(form).toHaveAttribute("aria-busy", "false");
  });

  it("required inputs carry aria-required='true'", () => {
    render(<CreateJob />);
    expect(screen.getByLabelText("Freelancer Address")).toHaveAttribute(
      "aria-required",
      "true"
    );
    expect(screen.getByLabelText("Arbiter Address")).toHaveAttribute(
      "aria-required",
      "true"
    );
    expect(
      screen.getByLabelText("Token Contract Address", { selector: "input" })
    ).toHaveAttribute("aria-required", "true");
  });

  it("milestone inputs carry aria-required='true'", () => {
    render(<CreateJob />);
    const m1 = screen.getByLabelText("Milestone 1 amount in stroops");
    expect(m1).toHaveAttribute("aria-required", "true");
  });

  it("deadline input has a visible hint linked via aria-describedby", () => {
    render(<CreateJob />);
    const deadlineInput = screen.getByLabelText("Response Deadline (days)");
    const hintId = deadlineInput.getAttribute("aria-describedby");
    expect(hintId).toBe("deadline-hint");
    expect(document.getElementById(hintId!)).toBeInTheDocument();
  });

  it("milestones are grouped in a fieldset with a legend", () => {
    render(<CreateJob />);
    const fieldset = screen
      .getByRole("group", { name: "Milestones" });
    expect(fieldset.tagName).toBe("FIELDSET");
  });

  it("milestone list has aria-label for screen readers", () => {
    render(<CreateJob />);
    expect(
      screen.getByRole("list", { name: "Milestone amounts" })
    ).toBeInTheDocument();
  });

  it("remove milestone button has a descriptive aria-label", () => {
    render(<CreateJob />);
    const removeBtn = screen.getByRole("button", { name: "Remove milestone 1" });
    expect(removeBtn).toBeInTheDocument();
  });

  it("partial milestone warning is a polite live region", () => {
    render(<CreateJob />);
    // Default render has one empty milestone so warning is shown
    const warning = screen.getByText("Complete each milestone amount to continue.");
    expect(warning).toHaveAttribute("aria-live", "polite");
    expect(warning).toHaveAttribute("role", "status");
  });

  it("no-wallet message uses role=status", () => {
    mockUseWallet.mockReturnValue({ address: null, signTransaction: vi.fn() });
    render(<CreateJob />);
    const message = screen.getByText(/connect your wallet/i);
    expect(message).toHaveAttribute("role", "status");
  });

  it("submit button is keyboard-focusable and has focus-visible ring classes", () => {
    render(<CreateJob />);
    const submitBtn = screen.getByRole("button", { name: "Create Job" });
    expect(submitBtn).toHaveClass("focus-visible:outline-none");
    expect(submitBtn).toHaveClass("focus-visible:ring-2");
    expect(submitBtn).toHaveClass("focus-visible:ring-accent-soft");
  });

  it("all text inputs have visible focus ring classes for keyboard navigation", () => {
    render(<CreateJob />);
    const inputs = [
      screen.getByLabelText("Freelancer Address"),
      screen.getByLabelText("Arbiter Address"),
      screen.getByLabelText("Token Contract Address", { selector: "input" }),
    ];
    for (const input of inputs) {
      expect(input).toHaveClass("focus-visible:ring-2");
      expect(input).toHaveClass("focus-visible:ring-accent-soft");
    }
  });

  it("main content area has an id for skip-link targeting", () => {
    render(<CreateJob />);
    const main = document.getElementById("main-content");
    expect(main).toBeInTheDocument();
  });

  it("decorative icons are aria-hidden so they're skipped by screen readers", () => {
    render(<CreateJob />);
    // The ✕ span inside remove button should be aria-hidden
    const hiddenSpans = document
      .querySelectorAll('[aria-hidden="true"]');
    // At least the ✕ decorative span should be present
    expect(hiddenSpans.length).toBeGreaterThan(0);
  });
});
