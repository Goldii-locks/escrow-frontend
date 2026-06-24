/**
 * Tests for MilestoneCard — validation messages and alert rendering.
 *
 * Covers:
 *  - validateMilestone() pure function
 *  - Alert banner toggling (shown / hidden)
 *  - Per-field inline error indicators
 *  - Correct role=alert aria attributes
 *  - Action button suppression on role conflict
 *  - External validationErrors prop merging
 *  - Happy-path renders with no errors
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import MilestoneCard, { validateMilestone } from "./MilestoneCard";
import type { MilestoneValidationErrors } from "./MilestoneCard";

// ─── helpers ────────────────────────────────────────────────────────────────

const validMilestone = { index: 0, amount: "1000000", status: "Pending" };

function renderCard(
  overrides: Partial<Parameters<typeof MilestoneCard>[0]> = {}
) {
  const defaults = {
    milestone: validMilestone,
    isClient: false,
    isFreelancer: false,
  };
  return render(<MilestoneCard {...defaults} {...overrides} />);
}

// ─── validateMilestone() unit tests ─────────────────────────────────────────

describe("validateMilestone()", () => {
  it("returns null for a fully valid milestone with no role conflict", () => {
    expect(validateMilestone(validMilestone, true, false)).toBeNull();
    expect(validateMilestone(validMilestone, false, true)).toBeNull();
    expect(validateMilestone(validMilestone, false, false)).toBeNull();
  });

  describe("invalidAmount", () => {
    it("flags an empty amount string", () => {
      const errors = validateMilestone(
        { ...validMilestone, amount: "" },
        false,
        false
      );
      expect(errors?.invalidAmount).toBeTruthy();
    });

    it("flags a whitespace-only amount", () => {
      const errors = validateMilestone(
        { ...validMilestone, amount: "   " },
        false,
        false
      );
      expect(errors?.invalidAmount).toBeTruthy();
    });

    it("flags a zero amount", () => {
      const errors = validateMilestone(
        { ...validMilestone, amount: "0" },
        false,
        false
      );
      expect(errors?.invalidAmount).toBeTruthy();
    });

    it("flags a negative amount", () => {
      const errors = validateMilestone(
        { ...validMilestone, amount: "-500" },
        false,
        false
      );
      expect(errors?.invalidAmount).toBeTruthy();
    });

    it("flags a decimal amount (stroops must be integers)", () => {
      const errors = validateMilestone(
        { ...validMilestone, amount: "100.5" },
        false,
        false
      );
      expect(errors?.invalidAmount).toBeTruthy();
    });

    it("flags a non-numeric amount", () => {
      const errors = validateMilestone(
        { ...validMilestone, amount: "abc" },
        false,
        false
      );
      expect(errors?.invalidAmount).toBeTruthy();
    });

    it("accepts a valid positive integer string", () => {
      const errors = validateMilestone(
        { ...validMilestone, amount: "5000000" },
        false,
        false
      );
      expect(errors?.invalidAmount).toBeUndefined();
    });
  });

  describe("unknownStatus", () => {
    it("flags an unrecognised status value", () => {
      const errors = validateMilestone(
        { ...validMilestone, status: "Bogus" },
        false,
        false
      );
      expect(errors?.unknownStatus).toBeTruthy();
    });

    it("flags an empty status", () => {
      const errors = validateMilestone(
        { ...validMilestone, status: "" },
        false,
        false
      );
      expect(errors?.unknownStatus).toBeTruthy();
    });

    it.each(["Pending", "Delivered", "Released", "Disputed", "Refunded"])(
      "accepts known status '%s'",
      (status) => {
        const errors = validateMilestone({ ...validMilestone, status }, false, false);
        expect(errors?.unknownStatus).toBeUndefined();
      }
    );
  });

  describe("unauthorizedAction", () => {
    it("flags when isClient and isFreelancer are both true", () => {
      const errors = validateMilestone(validMilestone, true, true);
      expect(errors?.unauthorizedAction).toBeTruthy();
    });

    it("does not flag when only isClient is true", () => {
      const errors = validateMilestone(validMilestone, true, false);
      expect(errors?.unauthorizedAction).toBeUndefined();
    });

    it("does not flag when only isFreelancer is true", () => {
      const errors = validateMilestone(validMilestone, false, true);
      expect(errors?.unauthorizedAction).toBeUndefined();
    });
  });

  it("returns multiple errors at once when several fields are invalid", () => {
    const errors = validateMilestone(
      { index: 0, amount: "", status: "Bogus" },
      true,
      true
    );
    expect(errors?.invalidAmount).toBeTruthy();
    expect(errors?.unknownStatus).toBeTruthy();
    expect(errors?.unauthorizedAction).toBeTruthy();
  });
});

// ─── Alert banner rendering ──────────────────────────────────────────────────

describe("MilestoneCard — alert banner", () => {
  it("does NOT render an alert when the milestone is valid", () => {
    renderCard({ isClient: true });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders the alert banner when amount is invalid", () => {
    renderCard({ milestone: { ...validMilestone, amount: "" } });
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });

  it("renders the alert banner when status is unknown", () => {
    renderCard({ milestone: { ...validMilestone, status: "UNKNOWN" } });
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });

  it("shows 'Invalid configuration' heading inside banner", () => {
    renderCard({ milestone: { ...validMilestone, amount: "-1" } });
    expect(
      screen.getByText(/invalid configuration/i)
    ).toBeInTheDocument();
  });

  it("lists all error messages inside the banner", () => {
    renderCard({
      milestone: { index: 0, amount: "", status: "Bad" },
      isClient: true,
      isFreelancer: true,
    });
    // All three error categories should be in the document
    expect(screen.getByText(/must be a positive whole number/i)).toBeInTheDocument();
    expect(screen.getByText(/unknown status/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot be both client and freelancer/i)).toBeInTheDocument();
  });

  it("applies red border to card container when errors exist", () => {
    const { container } = renderCard({
      milestone: { ...validMilestone, amount: "0" },
    });
    const card = container.firstChild as HTMLElement;
    expect(card.className).toMatch(/border-red-500/);
  });

  it("does NOT apply red border when there are no errors", () => {
    const { container } = renderCard({ isClient: true });
    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toMatch(/border-red-500/);
  });
});

// ─── Inline field error indicators ──────────────────────────────────────────

describe("MilestoneCard — inline field errors", () => {
  it("renders inline amount error below the amount value", () => {
    renderCard({ milestone: { ...validMilestone, amount: "abc" } });
    expect(
      screen.getByText(/must be a positive whole number/i)
    ).toBeInTheDocument();
  });

  it("marks amount element as aria-invalid when amount is bad", () => {
    renderCard({ milestone: { ...validMilestone, amount: "" } });
    const amountEl = screen.getByText(/stroops/i).closest("[aria-invalid]");
    expect(amountEl).toHaveAttribute("aria-invalid", "true");
  });

  it("does NOT mark amount as aria-invalid when amount is good", () => {
    renderCard({ milestone: validMilestone });
    // aria-invalid should not be true
    const amountEl = screen.getByText(/stroops/i).closest("[aria-invalid]");
    expect(amountEl).toHaveAttribute("aria-invalid", "false");
  });

  it("renders inline status error next to the badge when status is unknown", () => {
    renderCard({ milestone: { ...validMilestone, status: "Weird" } });
    expect(screen.getByText(/unknown status/i)).toBeInTheDocument();
  });

  it("marks the status badge as aria-invalid when status is unknown", () => {
    renderCard({ milestone: { ...validMilestone, status: "Weird" } });
    const badge = screen.getByText("Weird");
    expect(badge).toHaveAttribute("aria-invalid", "true");
  });

  it("does NOT mark status badge as aria-invalid for known statuses", () => {
    renderCard({ milestone: { ...validMilestone, status: "Released" } });
    const badge = screen.getByText("Released");
    expect(badge).toHaveAttribute("aria-invalid", "false");
  });

  it("shows role-conflict inline error when both roles are true", () => {
    renderCard({ isClient: true, isFreelancer: true });
    expect(
      screen.getByText(/cannot be both client and freelancer/i)
    ).toBeInTheDocument();
  });
});

// ─── Action button suppression ───────────────────────────────────────────────

describe("MilestoneCard — action button suppression on role conflict", () => {
  it("hides all action buttons when isClient and isFreelancer are both true", () => {
    renderCard({
      milestone: { ...validMilestone, status: "Pending" },
      isClient: true,
      isFreelancer: true,
    });
    expect(screen.queryByText("Mark Delivered")).toBeNull();
    expect(screen.queryByText("Dispute")).toBeNull();
  });

  it("shows Mark Delivered for freelancer with Pending milestone (no conflict)", () => {
    renderCard({
      milestone: { ...validMilestone, status: "Pending" },
      isFreelancer: true,
    });
    expect(screen.getByText("Mark Delivered")).toBeInTheDocument();
  });

  it("shows Approve for client with Delivered milestone (no conflict)", () => {
    renderCard({
      milestone: { ...validMilestone, status: "Delivered" },
      isClient: true,
    });
    expect(screen.getByText("Approve")).toBeInTheDocument();
  });

  it("shows Dispute for client with Pending milestone (no conflict)", () => {
    renderCard({
      milestone: { ...validMilestone, status: "Pending" },
      isClient: true,
    });
    expect(screen.getByText("Dispute")).toBeInTheDocument();
  });
});

// ─── External validationErrors prop ─────────────────────────────────────────

describe("MilestoneCard — external validationErrors prop", () => {
  it("renders an externally injected configError message", () => {
    const externalErrors: MilestoneValidationErrors = {
      configError: "Contract not initialised yet.",
    };
    renderCard({ validationErrors: externalErrors });
    expect(screen.getByText("Contract not initialised yet.")).toBeInTheDocument();
  });

  it("merges external errors with derived errors", () => {
    const externalErrors: MilestoneValidationErrors = {
      configError: "Extra error from parent.",
    };
    renderCard({
      milestone: { ...validMilestone, amount: "" },
      validationErrors: externalErrors,
    });
    // Both the derived amount error and the external config error appear
    expect(screen.getByText(/must be a positive whole number/i)).toBeInTheDocument();
    expect(screen.getByText("Extra error from parent.")).toBeInTheDocument();
  });

  it("external error alone (valid milestone) still triggers the alert banner", () => {
    const externalErrors: MilestoneValidationErrors = {
      configError: "Something went wrong.",
    };
    renderCard({ validationErrors: externalErrors });
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });
});

// ─── Button callback wiring ──────────────────────────────────────────────────

describe("MilestoneCard — button callbacks", () => {
  it("calls onMarkDelivered with correct index when clicked", async () => {
    const handler = vi.fn();
    renderCard({
      milestone: { ...validMilestone, status: "Pending" },
      isFreelancer: true,
      onMarkDelivered: handler,
    });
    await userEvent.click(screen.getByText("Mark Delivered"));
    expect(handler).toHaveBeenCalledWith(0);
  });

  it("calls onApprove with correct index when clicked", async () => {
    const handler = vi.fn();
    renderCard({
      milestone: { ...validMilestone, status: "Delivered" },
      isClient: true,
      onApprove: handler,
    });
    await userEvent.click(screen.getByText("Approve"));
    expect(handler).toHaveBeenCalledWith(0);
  });

  it("calls onDispute with correct index when clicked", async () => {
    const handler = vi.fn();
    renderCard({
      milestone: { ...validMilestone, status: "Pending" },
      isClient: true,
      onDispute: handler,
    });
    await userEvent.click(screen.getByText("Dispute"));
    expect(handler).toHaveBeenCalledWith(0);
  });
});

// ─── Happy-path / no errors ──────────────────────────────────────────────────

describe("MilestoneCard — happy path (no errors)", () => {
  it.each([
    { status: "Pending", isClient: false, isFreelancer: false },
    { status: "Delivered", isClient: true, isFreelancer: false },
    { status: "Released", isClient: false, isFreelancer: false },
    { status: "Disputed", isClient: false, isFreelancer: false },
    { status: "Refunded", isClient: false, isFreelancer: false },
  ])("renders cleanly for status=%s", ({ status, isClient, isFreelancer }) => {
    renderCard({
      milestone: { ...validMilestone, status },
      isClient,
      isFreelancer,
    });
    expect(screen.queryByText(/invalid configuration/i)).toBeNull();
    expect(screen.queryByText(/must be a positive whole number/i)).toBeNull();
    expect(screen.queryByText(/unknown status/i)).toBeNull();
  });

  it("displays the milestone index correctly", () => {
    renderCard({ milestone: { ...validMilestone, index: 2 } });
    expect(screen.getByText("Milestone 3")).toBeInTheDocument();
  });

  it("displays the amount in stroops", () => {
    renderCard({ milestone: { ...validMilestone, amount: "5000000" } });
    expect(screen.getByText(/5000000/)).toBeInTheDocument();
  });
});
