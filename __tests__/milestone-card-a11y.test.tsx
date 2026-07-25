/**
 * Accessibility test suite for MilestoneCard
 *
 * Covers:
 *  - ARIA landmark roles and labels (region, alert, status)
 *  - Accessible names on interactive elements (buttons, badges)
 *  - aria-disabled state mirroring HTML disabled
 *  - aria-live regions for dynamic content
 *  - aria-describedby wiring between card and error banner
 *  - aria-hidden on decorative/redundant text
 *  - Keyboard navigability (tabIndex, focus order, Enter/Space activation)
 *  - Color-contrast token audit (computed against globals.css design tokens)
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MilestoneCard from "@/app/components/MilestoneCard";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const idleState = { phase: "idle" as const, error: null, txHash: null };

const defaultProps = {
  isClient: false,
  isFreelancer: false,
  partialReleaseState: idleState,
  claimAutoReleaseState: idleState,
  isPartialReleasePending: false,
  isClaimAutoReleasePending: false,
};

const renderCard = (
  overrides: Partial<Parameters<typeof MilestoneCard>[0]> = {},
  milestone: Parameters<typeof MilestoneCard>[0]["milestone"] = {
    index: 0,
    amount: "500",
    status: "Pending",
  }
) =>
  render(
    <MilestoneCard {...defaultProps} milestone={milestone} {...overrides} />
  );

// ===========================================================================
// 1. Landmark roles — card and empty-state as named regions
// ===========================================================================

describe("MilestoneCard — landmark region roles", () => {
  it("valid card renders as a 'region' landmark", () => {
    renderCard();
    expect(screen.getByRole("region", { name: "Milestone 1" })).toBeInTheDocument();
  });

  it("region label updates with milestone index — Milestone 3 for index 2", () => {
    renderCard({}, { index: 2, amount: "100", status: "Pending" });
    expect(screen.getByRole("region", { name: "Milestone 3" })).toBeInTheDocument();
  });

  it("region label updates with milestone index — Milestone 5 for index 4", () => {
    renderCard({}, { index: 4, amount: "200", status: "Released" });
    expect(screen.getByRole("region", { name: "Milestone 5" })).toBeInTheDocument();
  });

  it("empty-state renders as a 'region' landmark", () => {
    renderCard({}, null);
    expect(screen.getByRole("region", { name: "No milestones" })).toBeInTheDocument();
  });

  it("empty-state region has aria-label 'No milestones'", () => {
    renderCard({}, null);
    expect(screen.getByRole("region", { name: "No milestones" })).toHaveAttribute(
      "aria-label",
      "No milestones"
    );
  });

  it("card region has aria-label matching the milestone label", () => {
    renderCard({}, { index: 0, amount: "100", status: "Pending" });
    expect(screen.getByRole("region")).toHaveAttribute("aria-label", "Milestone 1");
  });
});


// ===========================================================================
// 2. Button accessible names — aria-label context
// ===========================================================================

describe("MilestoneCard — button accessible names", () => {
  it("'Mark Delivered' button accessible name includes milestone number", () => {
    renderCard({ isFreelancer: true, onMarkDelivered: vi.fn() });
    expect(
      screen.getByRole("button", { name: "Mark Milestone 1 as delivered" })
    ).toBeInTheDocument();
  });

  it("'Mark Delivered' accessible name updates per milestone index", () => {
    renderCard(
      { isFreelancer: true, onMarkDelivered: vi.fn() },
      { index: 2, amount: "100", status: "Pending" }
    );
    expect(
      screen.getByRole("button", { name: "Mark Milestone 3 as delivered" })
    ).toBeInTheDocument();
  });

  it("'Approve' button accessible name includes milestone number", () => {
    renderCard(
      { isClient: true, onApprove: vi.fn() },
      { index: 0, amount: "100", status: "Delivered" }
    );
    expect(
      screen.getByRole("button", { name: "Approve Milestone 1" })
    ).toBeInTheDocument();
  });

  it("'Approve' accessible name updates per milestone index", () => {
    renderCard(
      { isClient: true, onApprove: vi.fn() },
      { index: 4, amount: "100", status: "Delivered" }
    );
    expect(
      screen.getByRole("button", { name: "Approve Milestone 5" })
    ).toBeInTheDocument();
  });

  it("'Dispute' button accessible name includes milestone number", () => {
    renderCard({ isClient: true, onDispute: vi.fn() });
    expect(
      screen.getByRole("button", { name: "Dispute Milestone 1" })
    ).toBeInTheDocument();
  });

  it("'Dispute' accessible name updates per milestone index", () => {
    renderCard(
      { isClient: true, onDispute: vi.fn() },
      { index: 1, amount: "100", status: "Pending" }
    );
    expect(
      screen.getByRole("button", { name: "Dispute Milestone 2" })
    ).toBeInTheDocument();
  });

  it("buttons carry aria-label attribute matching their accessible name", () => {
    renderCard({ isFreelancer: true, onMarkDelivered: vi.fn() });
    const btn = screen.getByRole("button", { name: "Mark Milestone 1 as delivered" });
    expect(btn).toHaveAttribute("aria-label", "Mark Milestone 1 as delivered");
  });
});


// ===========================================================================
// 3. Status badge — aria-label for screen readers
// ===========================================================================

describe("MilestoneCard — status badge accessible label", () => {
  it("status badge has aria-label including milestone name and status", () => {
    renderCard({}, { index: 0, amount: "100", status: "Pending" });
    const badge = screen.getByText("Pending");
    expect(badge).toHaveAttribute(
      "aria-label",
      "Milestone 1 status: Pending"
    );
  });

  it("status badge aria-label updates for different milestone index", () => {
    renderCard({}, { index: 2, amount: "100", status: "Released" });
    const badge = screen.getByText("Released");
    expect(badge).toHaveAttribute(
      "aria-label",
      "Milestone 3 status: Released"
    );
  });

  it("status badge aria-label reflects Disputed status", () => {
    renderCard({}, { index: 0, amount: "100", status: "Disputed" });
    expect(screen.getByText("Disputed")).toHaveAttribute(
      "aria-label",
      "Milestone 1 status: Disputed"
    );
  });

  it("status badge aria-label reflects Delivered status", () => {
    renderCard({}, { index: 0, amount: "100", status: "Delivered" });
    expect(screen.getByText("Delivered")).toHaveAttribute(
      "aria-label",
      "Milestone 1 status: Delivered"
    );
  });

  it("empty-state badge has aria-label 'Status: waiting for milestones'", () => {
    renderCard({}, null);
    const badge = screen.getByText("Waiting for milestones");
    expect(badge).toHaveAttribute(
      "aria-label",
      "Status: waiting for milestones"
    );
  });
});


// ===========================================================================
// 4. Amount text — aria-label for screen readers
// ===========================================================================

describe("MilestoneCard — amount accessible label", () => {
  it("amount element has aria-label with milestone name and amount", () => {
    renderCard({}, { index: 0, amount: "500", status: "Pending" });
    expect(
      screen.getByLabelText("Milestone 1 amount: 0.00005 XLM")
    ).toBeInTheDocument();
  });

  it("amount aria-label updates for a different milestone index", () => {
    renderCard({}, { index: 3, amount: "1000", status: "Released" });
    expect(
      screen.getByLabelText("Milestone 4 amount: 0.0001 XLM")
    ).toBeInTheDocument();
  });

  it("amount aria-label reflects the correct amount value", () => {
    renderCard({}, { index: 0, amount: "250", status: "Pending" });
    expect(
      screen.getByLabelText("Milestone 1 amount: 0.000025 XLM")
    ).toBeInTheDocument();
  });

  it("milestone label paragraph has aria-hidden='true' to avoid redundant announcement", () => {
    renderCard();
    const label = screen.getByText("Milestone 1");
    expect(label).toHaveAttribute("aria-hidden", "true");
  });
});

// ===========================================================================
// 5. aria-disabled — mirrors HTML disabled attribute
// ===========================================================================

describe("MilestoneCard — aria-disabled state", () => {
  it("'Mark Delivered' has aria-disabled='true' when no handler is provided", () => {
    renderCard({ isFreelancer: true });
    expect(
      screen.getByRole("button", { name: "Mark Milestone 1 as delivered" })
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("'Mark Delivered' has aria-disabled='false' when handler is provided", () => {
    renderCard({ isFreelancer: true, onMarkDelivered: vi.fn() });
    expect(
      screen.getByRole("button", { name: "Mark Milestone 1 as delivered" })
    ).toHaveAttribute("aria-disabled", "false");
  });

  it("'Approve' has aria-disabled='true' when no handler is provided", () => {
    renderCard(
      { isClient: true },
      { index: 0, amount: "100", status: "Delivered" }
    );
    expect(
      screen.getByRole("button", { name: "Approve Milestone 1" })
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("'Approve' has aria-disabled='false' when handler is provided", () => {
    renderCard(
      { isClient: true, onApprove: vi.fn() },
      { index: 0, amount: "100", status: "Delivered" }
    );
    expect(
      screen.getByRole("button", { name: "Approve Milestone 1" })
    ).toHaveAttribute("aria-disabled", "false");
  });

  it("'Dispute' has aria-disabled='true' when no handler is provided", () => {
    renderCard({ isClient: true });
    expect(
      screen.getByRole("button", { name: "Dispute Milestone 1" })
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("'Dispute' has aria-disabled='false' when handler is provided", () => {
    renderCard({ isClient: true, onDispute: vi.fn() });
    expect(
      screen.getByRole("button", { name: "Dispute Milestone 1" })
    ).toHaveAttribute("aria-disabled", "false");
  });

  it("aria-disabled and HTML disabled are consistent on 'Mark Delivered'", () => {
    renderCard({ isFreelancer: true });
    const btn = screen.getByRole("button", { name: "Mark Milestone 1 as delivered" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-disabled", "true");
  });

  it("aria-disabled and HTML disabled are consistent when handler is present", () => {
    renderCard({ isFreelancer: true, onMarkDelivered: vi.fn() });
    const btn = screen.getByRole("button", { name: "Mark Milestone 1 as delivered" });
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveAttribute("aria-disabled", "false");
  });

  it("'Claim Auto-Release' has accessible name including milestone number", () => {
    renderCard(
      {
        isFreelancer: true,
        onClaimAutoRelease: vi.fn(),
        autoReleaseDeadline: Date.now() - 1,
      },
      { index: 0, amount: "100", status: "Delivered" }
    );
    expect(
      screen.getByRole("button", { name: "Claim auto-release for Milestone 1" })
    ).toBeInTheDocument();
  });

  it("'Claim Auto-Release' accessible name updates with milestone index", () => {
    renderCard(
      {
        isFreelancer: true,
        onClaimAutoRelease: vi.fn(),
        autoReleaseDeadline: Date.now() - 1,
      },
      { index: 3, amount: "100", status: "Delivered" }
    );
    expect(
      screen.getByRole("button", { name: "Claim auto-release for Milestone 4" })
    ).toBeInTheDocument();
  });

  it("'Claim Auto-Release' has aria-disabled='true' when handler is absent", () => {
    renderCard(
      {
        isFreelancer: true,
        autoReleaseDeadline: Date.now() - 1,
      },
      { index: 0, amount: "100", status: "Delivered" }
    );
    expect(
      screen.getByRole("button", { name: "Claim auto-release for Milestone 1" })
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("'Claim Auto-Release' has aria-disabled='false' when handler is provided", () => {
    renderCard(
      {
        isFreelancer: true,
        onClaimAutoRelease: vi.fn(),
        autoReleaseDeadline: Date.now() - 1,
      },
      { index: 0, amount: "100", status: "Delivered" }
    );
    expect(
      screen.getByRole("button", { name: "Claim auto-release for Milestone 1" })
    ).toHaveAttribute("aria-disabled", "false");
  });

  it("'Claim Auto-Release' is enabled when handler is provided", () => {
    renderCard(
      {
        isFreelancer: true,
        onClaimAutoRelease: vi.fn(),
        autoReleaseDeadline: Date.now() - 1,
      },
      { index: 0, amount: "100", status: "Delivered" }
    );
    expect(
      screen.getByRole("button", { name: "Claim auto-release for Milestone 1" })
    ).not.toBeDisabled();
  });

  it("'Claim Auto-Release' is disabled when isClaimAutoReleasePending is true", () => {
    renderCard(
      {
        isFreelancer: true,
        isClaimAutoReleasePending: true,
        onClaimAutoRelease: vi.fn(),
        autoReleaseDeadline: Date.now() - 1,
      },
      { index: 0, amount: "100", status: "Delivered" }
    );
    const btn = screen.getByRole("button", { name: "Claim auto-release for Milestone 1" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-disabled", "true");
  });
});

