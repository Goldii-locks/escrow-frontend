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

/** Helper: render with a valid milestone unless overridden */
const renderCard = (
  overrides: Partial<Parameters<typeof MilestoneCard>[0]> = {},
  ...args: [Parameters<typeof MilestoneCard>[0]["milestone"]?]
) => {
  const milestone = args.length > 0 ? args[0] : {
    index: 0,
    amount: "500",
    status: "Pending",
  };
  return render(
    <MilestoneCard {...defaultProps} milestone={milestone} {...overrides} />
  );
};


// ===========================================================================
// 1. Empty / null / malformed milestone — empty-state node rendering
// ===========================================================================

describe("MilestoneCard — empty-state node rendering", () => {
  it("renders the empty-state root node when milestone is null", () => {
    renderCard({}, null);
    expect(screen.getByTestId("milestone-empty-state")).toBeInTheDocument();
  });

  it("does NOT render the card node when milestone is null", () => {
    renderCard({}, null);
    expect(screen.queryByTestId("milestone-card")).not.toBeInTheDocument();
  });

  it("renders the empty-state root node when milestone is undefined", () => {
    renderCard({}, undefined);
    expect(screen.getByTestId("milestone-empty-state")).toBeInTheDocument();
  });

  it("renders the empty-state root node when milestone has no amount", () => {
    renderCard({}, { index: 0 } as never);
    expect(screen.getByTestId("milestone-empty-state")).toBeInTheDocument();
  });

  it("renders the empty-state root node when milestone has no status", () => {
    renderCard({}, { index: 0, amount: "100" } as never);
    expect(screen.getByTestId("milestone-empty-state")).toBeInTheDocument();
  });

  it("renders the empty-state root node when milestone index is not a number", () => {
    renderCard({}, { index: "0", amount: "100", status: "Pending" } as never);
    expect(screen.getByTestId("milestone-empty-state")).toBeInTheDocument();
  });

  it("renders the primary empty-state heading text", () => {
    renderCard({}, null);
    expect(screen.getByText("No milestones available")).toBeInTheDocument();
  });

  it("renders the supporting empty-state description text", () => {
    renderCard({}, null);
    expect(
      screen.getByText(/Add milestones in the create job form/i)
    ).toBeInTheDocument();
  });

  it("renders the 'Waiting for milestones' badge span", () => {
    renderCard({}, null);
    expect(screen.getByText("Waiting for milestones")).toBeInTheDocument();
  });
});


// ===========================================================================
// 2. Empty-state layout / design-token class assertions
// ===========================================================================

describe("MilestoneCard — empty-state layout classes", () => {
  it("has 'border' and 'rounded-lg' on the empty-state wrapper", () => {
    renderCard({}, null);
    expect(screen.getByTestId("milestone-empty-state")).toHaveClass(
      "border",
      "rounded-lg"
    );
  });

  it("has 'p-4' padding on the empty-state wrapper", () => {
    renderCard({}, null);
    expect(screen.getByTestId("milestone-empty-state")).toHaveClass("p-4");
  });

  it("has 'bg-surface-card' design token on the empty-state wrapper", () => {
    renderCard({}, null);
    expect(screen.getByTestId("milestone-empty-state")).toHaveClass(
      "bg-surface-card"
    );
  });

  it("has 'flex' and 'flex-col' on the empty-state wrapper", () => {
    renderCard({}, null);
    expect(screen.getByTestId("milestone-empty-state")).toHaveClass(
      "flex",
      "flex-col"
    );
  });

  it("has responsive sm:flex-row class on the empty-state wrapper", () => {
    renderCard({}, null);
    expect(screen.getByTestId("milestone-empty-state")).toHaveClass(
      "sm:flex-row"
    );
  });

  it("has sm:items-center on the empty-state wrapper", () => {
    renderCard({}, null);
    expect(screen.getByTestId("milestone-empty-state")).toHaveClass(
      "sm:items-center"
    );
  });

  it("has sm:justify-between on the empty-state wrapper", () => {
    renderCard({}, null);
    expect(screen.getByTestId("milestone-empty-state")).toHaveClass(
      "sm:justify-between"
    );
  });

  it("badge span has 'rounded-full' class", () => {
    renderCard({}, null);
    const badge = screen.getByText("Waiting for milestones");
    expect(badge).toHaveClass("rounded-full");
  });

  it("badge span has 'border' class", () => {
    renderCard({}, null);
    const badge = screen.getByText("Waiting for milestones");
    expect(badge).toHaveClass("border");
  });

  it("badge span has 'bg-surface-field' design token", () => {
    renderCard({}, null);
    const badge = screen.getByText("Waiting for milestones");
    expect(badge).toHaveClass("bg-surface-field");
  });

  it("badge span has 'text-text-muted' design token", () => {
    renderCard({}, null);
    const badge = screen.getByText("Waiting for milestones");
    expect(badge).toHaveClass("text-text-muted");
  });
});


// ===========================================================================
// 3. Valid milestone — card root node rendering
// ===========================================================================

describe("MilestoneCard — card root node rendering", () => {
  it("renders the card root node when a valid milestone is supplied", () => {
    renderCard();
    expect(screen.getByTestId("milestone-card")).toBeInTheDocument();
  });

  it("does NOT render the empty-state node when a valid milestone is supplied", () => {
    renderCard();
    expect(screen.queryByTestId("milestone-empty-state")).not.toBeInTheDocument();
  });

  it("displays 'Milestone 1' label for index 0", () => {
    renderCard();
    expect(screen.getByText("Milestone 1")).toBeInTheDocument();
  });

  it("displays 'Milestone 3' label for index 2", () => {
    renderCard({}, { index: 2, amount: "200", status: "Pending" });
    expect(screen.getByText("Milestone 3")).toBeInTheDocument();
  });

  it("renders the amount with 'stroops' unit suffix", () => {
    renderCard();
    expect(screen.getByText("500 stroops")).toBeInTheDocument();
  });

  it("renders the correct amount for a different milestone", () => {
    renderCard({}, { index: 0, amount: "1000", status: "Released" });
    expect(screen.getByText("1000 stroops")).toBeInTheDocument();
  });

  it("renders the status badge text", () => {
    renderCard({}, { index: 0, amount: "100", status: "Released" });
    expect(screen.getByText("Released")).toBeInTheDocument();
  });

  it("renders each supported status text correctly", () => {
    const statuses = ["Pending", "Delivered", "Released", "Disputed", "Refunded"];
    statuses.forEach((status) => {
      const { unmount } = render(
        <MilestoneCard
          {...defaultProps}
          milestone={{ index: 0, amount: "100", status }}
        />
      );
      expect(screen.getByText(status)).toBeInTheDocument();
      unmount();
    });
  });
});


// ===========================================================================
// 4. Card root — layout / design-token class assertions
// ===========================================================================

describe("MilestoneCard — card layout classes", () => {
  it("has 'border' and 'rounded-lg' on the card wrapper", () => {
    renderCard();
    expect(screen.getByTestId("milestone-card")).toHaveClass("border", "rounded-lg");
  });

  it("has 'p-4' padding on the card wrapper", () => {
    renderCard();
    expect(screen.getByTestId("milestone-card")).toHaveClass("p-4");
  });

  it("has 'bg-surface-card' design token on the card wrapper", () => {
    renderCard();
    expect(screen.getByTestId("milestone-card")).toHaveClass("bg-surface-card");
  });

  it("has 'flex' and 'flex-col' on the card wrapper", () => {
    renderCard();
    expect(screen.getByTestId("milestone-card")).toHaveClass("flex", "flex-col");
  });

  it("has responsive 'sm:flex-row' on the card wrapper", () => {
    renderCard();
    expect(screen.getByTestId("milestone-card")).toHaveClass("sm:flex-row");
  });

  it("has 'sm:items-center' on the card wrapper", () => {
    renderCard();
    expect(screen.getByTestId("milestone-card")).toHaveClass("sm:items-center");
  });

  it("has 'sm:justify-between' on the card wrapper", () => {
    renderCard();
    expect(screen.getByTestId("milestone-card")).toHaveClass("sm:justify-between");
  });

  it("has transition classes on the card wrapper", () => {
    renderCard();
    expect(screen.getByTestId("milestone-card")).toHaveClass(
      "transition-all",
      "duration-200"
    );
  });

  it("has hover:border-accent-soft/40 on the card wrapper", () => {
    renderCard();
    expect(screen.getByTestId("milestone-card")).toHaveClass(
      "hover:border-accent-soft/40"
    );
  });

  it("has focus-within ring classes on the card wrapper", () => {
    renderCard();
    expect(screen.getByTestId("milestone-card")).toHaveClass(
      "focus-within:ring-2"
    );
  });
});


// ===========================================================================
// 5. Status badge — colour design-token classes per status
// ===========================================================================

describe("MilestoneCard — status badge colour tokens", () => {
  const statusBadgeClasses: Record<string, string[]> = {
    Pending: ["bg-warning-soft/10", "text-warning-soft", "border-warning-soft/20"],
    Delivered: ["bg-info-soft/10", "text-info-soft", "border-info-soft/20"],
    Released: ["bg-success-soft/10", "text-success-soft", "border-success-soft/20"],
    Disputed: ["bg-danger-soft/10", "text-danger-soft", "border-danger-soft/20"],
    Refunded: ["bg-text-muted/10", "text-text-muted", "border-text-muted/20"],
  };

  Object.entries(statusBadgeClasses).forEach(([status, classes]) => {
    it(`applies correct colour tokens for '${status}' status badge`, () => {
      const { unmount } = render(
        <MilestoneCard
          {...defaultProps}
          milestone={{ index: 0, amount: "100", status }}
        />
      );
      const badge = screen.getByText(status);
      classes.forEach((cls) => expect(badge).toHaveClass(cls));
      unmount();
    });
  });

  it("applies fallback token classes for an unknown status", () => {
    render(
      <MilestoneCard
        {...defaultProps}
        milestone={{ index: 0, amount: "100", status: "Unknown" }}
      />
    );
    const badge = screen.getByText("Unknown");
    expect(badge).toHaveClass("bg-surface-field");
    expect(badge).toHaveClass("text-text-muted");
    expect(badge).toHaveClass("border-border-subtle");
  });

  it("badge always has 'rounded-full' class regardless of status", () => {
    const statuses = ["Pending", "Released", "Disputed"];
    statuses.forEach((status) => {
      const { unmount } = render(
        <MilestoneCard
          {...defaultProps}
          milestone={{ index: 0, amount: "100", status }}
        />
      );
      expect(screen.getByText(status)).toHaveClass("rounded-full");
      unmount();
    });
  });
});


// ===========================================================================
// 6. Action button rendering — correct button nodes per role + status
// ===========================================================================

describe("MilestoneCard — action button node rendering", () => {
  // Mark Delivered button
  it("renders 'Mark Delivered' button when isFreelancer=true and status is Pending", () => {
    renderCard({ isFreelancer: true, onMarkDelivered: vi.fn() });
    expect(
      screen.getByRole("button", { name: /mark milestone \d+ as delivered/i })
    ).toBeInTheDocument();
  });

  it("does NOT render 'Mark Delivered' button when isClient=true and status is Pending", () => {
    renderCard({ isClient: true });
    expect(
      screen.queryByRole("button", { name: /mark milestone \d+ as delivered/i })
    ).not.toBeInTheDocument();
  });

  it("does NOT render 'Mark Delivered' button for Released status", () => {
    renderCard(
      { isFreelancer: true },
      { index: 0, amount: "100", status: "Released" }
    );
    expect(
      screen.queryByRole("button", { name: /mark milestone \d+ as delivered/i })
    ).not.toBeInTheDocument();
  });

  // Approve button
  it("renders 'Approve' button when isClient=true and status is Delivered", () => {
    renderCard(
      { isClient: true, onApprove: vi.fn() },
      { index: 0, amount: "100", status: "Delivered" }
    );
    expect(
      screen.getByRole("button", { name: /approve milestone \d+/i })
    ).toBeInTheDocument();
  });

  it("does NOT render 'Approve' button when isFreelancer=true and status is Delivered", () => {
    renderCard(
      { isFreelancer: true },
      { index: 0, amount: "100", status: "Delivered" }
    );
    expect(
      screen.queryByRole("button", { name: /approve milestone \d+/i })
    ).not.toBeInTheDocument();
  });

  it("does NOT render 'Approve' button when status is Pending", () => {
    renderCard({ isClient: true });
    expect(
      screen.queryByRole("button", { name: /approve milestone \d+/i })
    ).not.toBeInTheDocument();
  });

  // Dispute button
  it("renders 'Dispute' button for isClient + Pending status", () => {
    renderCard({ isClient: true, onDispute: vi.fn() });
    expect(
      screen.getByRole("button", { name: /dispute milestone \d+/i })
    ).toBeInTheDocument();
  });

  it("renders 'Dispute' button for isFreelancer + Pending status", () => {
    renderCard({ isFreelancer: true, onDispute: vi.fn() });
    expect(
      screen.getByRole("button", { name: /dispute milestone \d+/i })
    ).toBeInTheDocument();
  });

  it("renders 'Dispute' button for isClient + Delivered status", () => {
    renderCard(
      { isClient: true, onDispute: vi.fn() },
      { index: 0, amount: "100", status: "Delivered" }
    );
    expect(
      screen.getByRole("button", { name: /dispute milestone \d+/i })
    ).toBeInTheDocument();
  });

  it("does NOT render 'Dispute' button for Released status", () => {
    renderCard(
      { isClient: true },
      { index: 0, amount: "100", status: "Released" }
    );
    expect(
      screen.queryByRole("button", { name: /dispute milestone \d+/i })
    ).not.toBeInTheDocument();
  });

  it("does NOT render 'Dispute' button when neither isClient nor isFreelancer", () => {
    renderCard();
    expect(
      screen.queryByRole("button", { name: /dispute milestone \d+/i })
    ).not.toBeInTheDocument();
  });

  it("does NOT render any action buttons for Released status regardless of role", () => {
    renderCard(
      { isClient: true, isFreelancer: true },
      { index: 0, amount: "100", status: "Released" }
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});


// ===========================================================================
// 7. Action button — disabled state when handler is absent
// ===========================================================================

describe("MilestoneCard — button disabled state", () => {
  it("'Mark Delivered' button is enabled when onMarkDelivered handler is provided", () => {
    renderCard({ isFreelancer: true, onMarkDelivered: vi.fn() });
    expect(
      screen.getByRole("button", { name: /mark milestone \d+ as delivered/i })
    ).not.toBeDisabled();
  });

  it("'Mark Delivered' button is disabled when onMarkDelivered is not provided", () => {
    renderCard({ isFreelancer: true });
    expect(
      screen.getByRole("button", { name: /mark milestone \d+ as delivered/i })
    ).toBeDisabled();
  });

  it("'Approve' button is enabled when onApprove handler is provided", () => {
    renderCard(
      { isClient: true, onApprove: vi.fn() },
      { index: 0, amount: "100", status: "Delivered" }
    );
    expect(
      screen.getByRole("button", { name: /approve milestone \d+/i })
    ).not.toBeDisabled();
  });

  it("'Approve' button is disabled when onApprove is not provided", () => {
    renderCard(
      { isClient: true },
      { index: 0, amount: "100", status: "Delivered" }
    );
    expect(screen.getByRole("button", { name: /approve milestone \d+/i })).toBeDisabled();
  });

  it("'Dispute' button is enabled when onDispute handler is provided", () => {
    renderCard({ isClient: true, onDispute: vi.fn() });
    expect(
      screen.getByRole("button", { name: /dispute milestone \d+/i })
    ).not.toBeDisabled();
  });

  it("'Dispute' button is disabled when onDispute is not provided", () => {
    renderCard({ isClient: true });
    expect(screen.getByRole("button", { name: /dispute milestone \d+/i })).toBeDisabled();
  });

  it("disabled buttons carry 'disabled:opacity-40' class", () => {
    renderCard({ isFreelancer: true });
    expect(
      screen.getByRole("button", { name: /mark milestone \d+ as delivered/i })
    ).toHaveClass("disabled:opacity-40");
  });

  it("disabled buttons carry 'disabled:cursor-not-allowed' class", () => {
    renderCard({ isFreelancer: true });
    expect(
      screen.getByRole("button", { name: /mark milestone \d+ as delivered/i })
    ).toHaveClass("disabled:cursor-not-allowed");
  });
});


// ===========================================================================
// 8. Action button — click handler invocation
// ===========================================================================

describe("MilestoneCard — button click handler invocation", () => {
  it("calls onMarkDelivered with the milestone index when 'Mark Delivered' is clicked", () => {
    const handler = vi.fn();
    renderCard({ isFreelancer: true, onMarkDelivered: handler });
    fireEvent.click(screen.getByRole("button", { name: /mark milestone \d+ as delivered/i }));
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(0);
  });

  it("calls onMarkDelivered with the correct index for a non-zero milestone", () => {
    const handler = vi.fn();
    renderCard(
      { isFreelancer: true, onMarkDelivered: handler },
      { index: 3, amount: "100", status: "Pending" }
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark Milestone 4 as delivered" }));
    expect(handler).toHaveBeenCalledWith(3);
  });

  it("calls onApprove with the milestone index when 'Approve' is clicked", () => {
    const handler = vi.fn();
    renderCard(
      { isClient: true, onApprove: handler },
      { index: 1, amount: "100", status: "Delivered" }
    );
    fireEvent.click(screen.getByRole("button", { name: "Approve Milestone 2" }));
    expect(handler).toHaveBeenCalledWith(1);
  });

  it("calls onDispute with the milestone index when 'Dispute' is clicked", () => {
    const handler = vi.fn();
    renderCard({ isClient: true, onDispute: handler });
    fireEvent.click(screen.getByRole("button", { name: /dispute milestone \d+/i }));
    expect(handler).toHaveBeenCalledWith(0);
  });

  it("does NOT call onMarkDelivered when the button is disabled (no handler)", () => {
    // Clicking a disabled button should not throw and handler should never be called
    renderCard({ isFreelancer: true });
    const btn = screen.getByRole("button", { name: /mark milestone \d+ as delivered/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    // No assertion on mock — we just verify no crash and button is disabled
    expect(btn).toBeDisabled();
  });
});


// ===========================================================================
// 9. Action button — structural CSS design-token classes
// ===========================================================================

describe("MilestoneCard — action button design-token classes", () => {
  it("'Mark Delivered' button has 'bg-info-soft' token", () => {
    renderCard({ isFreelancer: true, onMarkDelivered: vi.fn() });
    expect(
      screen.getByRole("button", { name: /mark milestone \d+ as delivered/i })
    ).toHaveClass("bg-info-soft");
  });

  it("'Mark Delivered' button has 'rounded-lg' class", () => {
    renderCard({ isFreelancer: true, onMarkDelivered: vi.fn() });
    expect(
      screen.getByRole("button", { name: /mark milestone \d+ as delivered/i })
    ).toHaveClass("rounded-lg");
  });

  it("'Mark Delivered' button has focus-visible ring classes", () => {
    renderCard({ isFreelancer: true, onMarkDelivered: vi.fn() });
    expect(
      screen.getByRole("button", { name: /mark milestone \d+ as delivered/i })
    ).toHaveClass("focus-visible:ring-2");
  });

  it("'Approve' button has 'bg-success' token", () => {
    renderCard(
      { isClient: true, onApprove: vi.fn() },
      { index: 0, amount: "100", status: "Delivered" }
    );
    expect(screen.getByRole("button", { name: /approve milestone \d+/i })).toHaveClass(
      "bg-success"
    );
  });

  it("'Approve' button has 'rounded-lg' class", () => {
    renderCard(
      { isClient: true, onApprove: vi.fn() },
      { index: 0, amount: "100", status: "Delivered" }
    );
    expect(screen.getByRole("button", { name: /approve milestone \d+/i })).toHaveClass(
      "rounded-lg"
    );
  });

  it("'Dispute' button has 'bg-danger' token", () => {
    renderCard({ isClient: true, onDispute: vi.fn() });
    expect(screen.getByRole("button", { name: /dispute milestone \d+/i })).toHaveClass(
      "bg-danger"
    );
  });

  it("'Dispute' button has 'rounded-lg' class", () => {
    renderCard({ isClient: true, onDispute: vi.fn() });
    expect(screen.getByRole("button", { name: /dispute milestone \d+/i })).toHaveClass(
      "rounded-lg"
    );
  });

  it("all buttons have 'whitespace-nowrap' to prevent text wrapping", () => {
    render(
      <MilestoneCard
        {...defaultProps}
        milestone={{ index: 0, amount: "100", status: "Delivered" }}
        isClient
        isFreelancer
        onApprove={vi.fn()}
        onDispute={vi.fn()}
      />
    );
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn: HTMLElement) => expect(btn).toHaveClass("whitespace-nowrap"));
  });
});


// ===========================================================================
// 10. Milestone info text — typographic classes
// ===========================================================================

describe("MilestoneCard — milestone info typographic classes", () => {
  it("milestone label has 'text-text-muted' design token", () => {
    renderCard();
    expect(screen.getByText("Milestone 1")).toHaveClass("text-text-muted");
  });

  it("milestone label has 'text-sm' size class", () => {
    renderCard();
    expect(screen.getByText("Milestone 1")).toHaveClass("text-sm");
  });

  it("amount text has 'font-mono' class", () => {
    renderCard();
    expect(screen.getByText("500 stroops")).toHaveClass("font-mono");
  });

  it("amount text has 'text-text-primary' design token", () => {
    renderCard();
    expect(screen.getByText("500 stroops")).toHaveClass("text-text-primary");
  });

  it("amount text has 'truncate' class for overflow handling", () => {
    renderCard();
    expect(screen.getByText("500 stroops")).toHaveClass("truncate");
  });
});

// ===========================================================================
// 11. Accessibility — keyboard focus attributes
// ===========================================================================

describe("MilestoneCard — accessibility attributes", () => {
  it("card wrapper has 'focus-within:outline-none' for custom focus management", () => {
    renderCard();
    expect(screen.getByTestId("milestone-card")).toHaveClass(
      "focus-within:outline-none"
    );
  });

  it("all action buttons have 'focus-visible:outline-none' class", () => {
    render(
      <MilestoneCard
        {...defaultProps}
        milestone={{ index: 0, amount: "100", status: "Delivered" }}
        isClient
        isFreelancer
        onApprove={vi.fn()}
        onDispute={vi.fn()}
      />
    );
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn: HTMLElement) =>
      expect(btn).toHaveClass("focus-visible:outline-none")
    );
  });

  it("action buttons have 'focus-visible:ring-offset-surface-page' token", () => {
    renderCard({ isFreelancer: true, onMarkDelivered: vi.fn() });
    expect(
      screen.getByRole("button", { name: /mark milestone \d+ as delivered/i })
    ).toHaveClass("focus-visible:ring-offset-surface-page");
  });
});


// ===========================================================================
// 12. Error indicators — general alert banner toggle
// ===========================================================================

describe("MilestoneCard — general error alert banner", () => {
  it("does NOT render the error alert when errors prop is omitted", () => {
    renderCard();
    expect(
      screen.queryByTestId("milestone-card-error-alert")
    ).not.toBeInTheDocument();
  });

  it("does NOT render the error alert when errors prop is an empty object", () => {
    renderCard({ errors: {} });
    expect(
      screen.queryByTestId("milestone-card-error-alert")
    ).not.toBeInTheDocument();
  });

  it("does NOT render the error alert when errors.general is undefined", () => {
    renderCard({ errors: { amount: "bad amount" } });
    expect(
      screen.queryByTestId("milestone-card-error-alert")
    ).not.toBeInTheDocument();
  });

  it("renders the error alert when errors.general is set", () => {
    renderCard({ errors: { general: "Something went wrong." } });
    expect(
      screen.getByTestId("milestone-card-error-alert")
    ).toBeInTheDocument();
  });

  it("renders the correct error message text in the alert", () => {
    renderCard({ errors: { general: "This milestone is locked." } });
    expect(screen.getByText("This milestone is locked.")).toBeInTheDocument();
  });

  it("alert element has role='alert' for accessibility", () => {
    renderCard({ errors: { general: "Contract error." } });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("alert has 'bg-danger/10' design token class", () => {
    renderCard({ errors: { general: "Oops." } });
    expect(screen.getByTestId("milestone-card-error-alert")).toHaveClass(
      "bg-danger/10"
    );
  });

  it("alert has 'border-danger/30' design token class", () => {
    renderCard({ errors: { general: "Oops." } });
    expect(screen.getByTestId("milestone-card-error-alert")).toHaveClass(
      "border-danger/30"
    );
  });

  it("alert has 'text-danger-soft' design token class", () => {
    renderCard({ errors: { general: "Oops." } });
    expect(screen.getByTestId("milestone-card-error-alert")).toHaveClass(
      "text-danger-soft"
    );
  });

  it("alert has 'rounded-lg' class", () => {
    renderCard({ errors: { general: "Oops." } });
    expect(screen.getByTestId("milestone-card-error-alert")).toHaveClass(
      "rounded-lg"
    );
  });

  it("alert disappears when errors.general is cleared (re-render without error)", () => {
    const { rerender } = render(
      <MilestoneCard
        {...defaultProps}
        milestone={{ index: 0, amount: "100", status: "Pending" }}
        errors={{ general: "Temporary error." }}
      />
    );
    expect(screen.getByTestId("milestone-card-error-alert")).toBeInTheDocument();

    rerender(
      <MilestoneCard
        {...defaultProps}
        milestone={{ index: 0, amount: "100", status: "Pending" }}
        errors={{}}
      />
    );
    expect(
      screen.queryByTestId("milestone-card-error-alert")
    ).not.toBeInTheDocument();
  });
});


// ===========================================================================
// 13. Error indicators — amount field error toggle
// ===========================================================================

describe("MilestoneCard — amount field error indicator", () => {
  it("does NOT render the amount error when errors.amount is absent", () => {
    renderCard();
    expect(
      screen.queryByTestId("milestone-card-amount-error")
    ).not.toBeInTheDocument();
  });

  it("renders the amount error element when errors.amount is set", () => {
    renderCard({ errors: { amount: "Amount must be greater than 0." } });
    expect(
      screen.getByTestId("milestone-card-amount-error")
    ).toBeInTheDocument();
  });

  it("renders the correct amount error message text", () => {
    renderCard({ errors: { amount: "Amount must be greater than 0." } });
    expect(
      screen.getByText("Amount must be greater than 0.")
    ).toBeInTheDocument();
  });

  it("amount error element has role='alert'", () => {
    renderCard({ errors: { amount: "Invalid amount." } });
    // Multiple alerts may be present; check at least one matches by testid
    const el = screen.getByTestId("milestone-card-amount-error");
    expect(el).toHaveAttribute("role", "alert");
  });

  it("amount error has 'text-danger-soft' design token class", () => {
    renderCard({ errors: { amount: "Bad value." } });
    expect(screen.getByTestId("milestone-card-amount-error")).toHaveClass(
      "text-danger-soft"
    );
  });

  it("amount error has 'text-xs' size class", () => {
    renderCard({ errors: { amount: "Bad value." } });
    expect(screen.getByTestId("milestone-card-amount-error")).toHaveClass(
      "text-xs"
    );
  });

  it("amount error is placed inside the milestone info section (before status area)", () => {
    renderCard({ errors: { amount: "Too low." } });
    const card = screen.getByTestId("milestone-card");
    const amountEl = screen.getByTestId("milestone-card-amount-error");
    expect(card).toContainElement(amountEl);
  });

  it("amount error disappears when errors.amount is cleared on re-render", () => {
    const { rerender } = render(
      <MilestoneCard
        {...defaultProps}
        milestone={{ index: 0, amount: "0", status: "Pending" }}
        errors={{ amount: "Must be > 0." }}
      />
    );
    expect(screen.getByTestId("milestone-card-amount-error")).toBeInTheDocument();

    rerender(
      <MilestoneCard
        {...defaultProps}
        milestone={{ index: 0, amount: "100", status: "Pending" }}
        errors={{}}
      />
    );
    expect(
      screen.queryByTestId("milestone-card-amount-error")
    ).not.toBeInTheDocument();
  });
});


// ===========================================================================
// 14. Error indicators — status field error toggle
// ===========================================================================

describe("MilestoneCard — status field error indicator", () => {
  it("does NOT render the status error when errors.status is absent", () => {
    renderCard();
    expect(
      screen.queryByTestId("milestone-card-status-error")
    ).not.toBeInTheDocument();
  });

  it("renders the status error element when errors.status is set", () => {
    renderCard({ errors: { status: "Unrecognised status value." } });
    expect(
      screen.getByTestId("milestone-card-status-error")
    ).toBeInTheDocument();
  });

  it("renders the correct status error message text", () => {
    renderCard({ errors: { status: "Unrecognised status value." } });
    expect(
      screen.getByText("Unrecognised status value.")
    ).toBeInTheDocument();
  });

  it("status error element has role='alert'", () => {
    renderCard({ errors: { status: "Bad status." } });
    const el = screen.getByTestId("milestone-card-status-error");
    expect(el).toHaveAttribute("role", "alert");
  });

  it("status error has 'text-warning-soft' design token class", () => {
    renderCard({ errors: { status: "Unknown." } });
    expect(screen.getByTestId("milestone-card-status-error")).toHaveClass(
      "text-warning-soft"
    );
  });

  it("status error has 'text-xs' size class", () => {
    renderCard({ errors: { status: "Unknown." } });
    expect(screen.getByTestId("milestone-card-status-error")).toHaveClass(
      "text-xs"
    );
  });

  it("status error is placed adjacent to the status badge", () => {
    renderCard({ errors: { status: "Unknown status." } });
    const card = screen.getByTestId("milestone-card");
    const statusEl = screen.getByTestId("milestone-card-status-error");
    expect(card).toContainElement(statusEl);
  });

  it("status error disappears when errors.status is cleared on re-render", () => {
    const { rerender } = render(
      <MilestoneCard
        {...defaultProps}
        milestone={{ index: 0, amount: "100", status: "WeirdStatus" }}
        errors={{ status: "Unrecognised status." }}
      />
    );
    expect(screen.getByTestId("milestone-card-status-error")).toBeInTheDocument();

    rerender(
      <MilestoneCard
        {...defaultProps}
        milestone={{ index: 0, amount: "100", status: "Pending" }}
        errors={{}}
      />
    );
    expect(
      screen.queryByTestId("milestone-card-status-error")
    ).not.toBeInTheDocument();
  });
});


// ===========================================================================
// 15. Error indicators — combined / simultaneous errors
// ===========================================================================

describe("MilestoneCard — combined error states", () => {
  it("renders all three error nodes simultaneously when all are set", () => {
    renderCard({
      errors: {
        general: "Transaction failed.",
        amount: "Amount is zero.",
        status: "Invalid status.",
      },
    });
    expect(screen.getByTestId("milestone-card-error-alert")).toBeInTheDocument();
    expect(screen.getByTestId("milestone-card-amount-error")).toBeInTheDocument();
    expect(screen.getByTestId("milestone-card-status-error")).toBeInTheDocument();
  });

  it("renders only general + amount errors when status error is absent", () => {
    renderCard({
      errors: { general: "Failed.", amount: "Zero amount." },
    });
    expect(screen.getByTestId("milestone-card-error-alert")).toBeInTheDocument();
    expect(screen.getByTestId("milestone-card-amount-error")).toBeInTheDocument();
    expect(
      screen.queryByTestId("milestone-card-status-error")
    ).not.toBeInTheDocument();
  });

  it("renders only amount + status errors when general error is absent", () => {
    renderCard({
      errors: { amount: "Too low.", status: "Bad status." },
    });
    expect(
      screen.queryByTestId("milestone-card-error-alert")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("milestone-card-amount-error")).toBeInTheDocument();
    expect(screen.getByTestId("milestone-card-status-error")).toBeInTheDocument();
  });

  it("all error nodes carry role='alert' for screen-reader announcement", () => {
    renderCard({
      errors: {
        general: "G error.",
        amount: "A error.",
        status: "S error.",
      },
    });
    const alerts = screen.getAllByRole("alert");
    // Expect exactly 3 alert nodes
    expect(alerts).toHaveLength(3);
  });

  it("card still renders correctly with errors and action buttons at the same time", () => {
    render(
      <MilestoneCard
        {...defaultProps}
        milestone={{ index: 0, amount: "100", status: "Pending" }}
        isFreelancer
        onMarkDelivered={vi.fn()}
        onDispute={vi.fn()}
        errors={{ general: "Warning: unverified amount.", amount: "Check value." }}
      />
    );
    expect(screen.getByTestId("milestone-card-error-alert")).toBeInTheDocument();
    expect(screen.getByTestId("milestone-card-amount-error")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark milestone \d+ as delivered/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dispute milestone \d+/i })).toBeInTheDocument();
  });

  it("errors prop has no effect on the empty-state branch (ignored silently)", () => {
    render(
      <MilestoneCard
        {...defaultProps}
        milestone={null}
        errors={{ general: "This should not appear in empty state." }}
      />
    );
    expect(screen.getByTestId("milestone-empty-state")).toBeInTheDocument();
    expect(
      screen.queryByTestId("milestone-card-error-alert")
    ).not.toBeInTheDocument();
  });
});
