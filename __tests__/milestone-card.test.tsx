import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MilestoneCard from "@/app/components/MilestoneCard";

const idleActionState = {
  phase: "idle" as const,
  error: null,
  txHash: null,
};

describe("MilestoneCard", () => {
  const renderCard = (milestone?: { index: number; amount: string; status: string } | null) =>
    render(
      <MilestoneCard
        milestone={milestone}
        isClient={false}
        isFreelancer={false}
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
      />
    );

  it("renders empty-state placeholder for null milestone data", () => {
    renderCard(null);

    expect(screen.getByTestId("milestone-empty-state")).toBeInTheDocument();
    expect(screen.getByText("No milestones available")).toBeInTheDocument();
  });

  it("renders fallback placeholder when milestone is undefined", () => {
    renderCard();

    expect(screen.getByTestId("milestone-empty-state")).toBeInTheDocument();
  });

  it("renders fallback placeholder when milestone data is malformed", () => {
    renderCard({ index: 0 } as unknown as { index: number; amount: string; status: string });

    expect(screen.getByTestId("milestone-empty-state")).toBeInTheDocument();
    expect(screen.getByText("Waiting for milestones")).toBeInTheDocument();
  });

  it("renders action controls for expected statuses", () => {
    const onMarkDelivered = vi.fn();

    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Pending" }}
        isClient={false}
        isFreelancer
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        onMarkDelivered={onMarkDelivered}
      />
    );

    expect(screen.getByTestId("milestone-card")).toHaveClass("bg-surface-card");
    expect(screen.getByRole("button", { name: /mark milestone \d+ as delivered/i })).toBeInTheDocument();
  });

  it("renders the Dispute button for client on a PartiallyReleased milestone", () => {
    const onDispute = vi.fn();

    render(
      <MilestoneCard
        milestone={{ index: 2, amount: "1000", status: "PartiallyReleased", releasedAmount: "400" }}
        isClient
        isFreelancer={false}
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        onDispute={onDispute}
      />
    );

    const disputeButton = screen.getByRole("button", { name: /dispute milestone 3/i });
    expect(disputeButton).toBeInTheDocument();
    expect(disputeButton).not.toBeDisabled();
  });

  it("renders the Dispute button for freelancer on a PartiallyReleased milestone", () => {
    const onDispute = vi.fn();

    render(
      <MilestoneCard
        milestone={{ index: 2, amount: "1000", status: "PartiallyReleased", releasedAmount: "400" }}
        isClient={false}
        isFreelancer
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        onDispute={onDispute}
      />
    );

    const disputeButton = screen.getByRole("button", { name: /dispute milestone 3/i });
    expect(disputeButton).toBeInTheDocument();
    expect(disputeButton).not.toBeDisabled();
  });

  it("does NOT render the Dispute button for a Released milestone", () => {
    const onDispute = vi.fn();

    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Released" }}
        isClient
        isFreelancer={false}
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        onDispute={onDispute}
      />
    );

    expect(
      screen.queryByRole("button", { name: /dispute milestone 1/i })
    ).not.toBeInTheDocument();
  });

  it("disables the Dispute button when onDispute is absent on a PartiallyReleased milestone", () => {
    render(
      <MilestoneCard
        milestone={{ index: 1, amount: "100", status: "PartiallyReleased" }}
        isClient
        isFreelancer={false}
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
      />
    );

    expect(
      screen.getByRole("button", { name: /dispute milestone 2/i })
    ).toBeDisabled();
  });

  describe("Approve / partial release confirmation", () => {
    it("opens the ReleaseConfirmModal when Approve is clicked and does not call onApprove until confirmed", () => {
      const onApprove = vi.fn();
      const onPartialRelease = vi.fn();

      render(
        <MilestoneCard
          milestone={{ index: 0, amount: "100", status: "Delivered" }}
          isClient
          isFreelancer={false}
          freelancerAddress="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
          partialReleaseState={idleActionState}
          claimAutoReleaseState={idleActionState}
          isPartialReleasePending={false}
          isClaimAutoReleasePending={false}
          onApprove={onApprove}
          onPartialRelease={onPartialRelease}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /approve milestone 1/i }));

      expect(
        screen.getByRole("dialog", { name: /confirm approve & release/i })
      ).toBeInTheDocument();
      expect(onApprove).not.toHaveBeenCalled();
      expect(onPartialRelease).not.toHaveBeenCalled();
    });

    it("calls onApprove with the milestone index when Approve is confirmed", () => {
      const onApprove = vi.fn();
      const onPartialRelease = vi.fn();

      render(
        <MilestoneCard
          milestone={{ index: 2, amount: "100", status: "Delivered" }}
          isClient
          isFreelancer={false}
          freelancerAddress="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
          partialReleaseState={idleActionState}
          claimAutoReleaseState={idleActionState}
          isPartialReleasePending={false}
          isClaimAutoReleasePending={false}
          onApprove={onApprove}
          onPartialRelease={onPartialRelease}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /approve milestone 3/i }));
      fireEvent.click(screen.getByRole("button", { name: /approve & release/i }));

      expect(onApprove).toHaveBeenCalledWith(2);
      expect(onPartialRelease).not.toHaveBeenCalled();
    });

    it("does not call onApprove when Approve confirmation is cancelled", () => {
      const onApprove = vi.fn();

      render(
        <MilestoneCard
          milestone={{ index: 0, amount: "100", status: "Delivered" }}
          isClient
          isFreelancer={false}
          freelancerAddress="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
          partialReleaseState={idleActionState}
          claimAutoReleaseState={idleActionState}
          isPartialReleasePending={false}
          isClaimAutoReleasePending={false}
          onApprove={onApprove}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /approve milestone 1/i }));
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(onApprove).not.toHaveBeenCalled();
      expect(
        screen.queryByRole("dialog", { name: /confirm approve & release/i })
      ).not.toBeInTheDocument();
    });

    it("opens the ReleaseConfirmModal for partial release and shows the amount in human units", () => {
      const onPartialRelease = vi.fn();

      render(
        <MilestoneCard
          milestone={{
            index: 1,
            amount: "100000000",
            status: "PartiallyReleased",
            releasedAmount: "40000000",
          }}
          isClient
          isFreelancer={false}
          freelancerAddress="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
          partialReleaseState={idleActionState}
          claimAutoReleaseState={idleActionState}
          isPartialReleasePending={false}
          isClaimAutoReleasePending={false}
          amountDecimals={7}
          amountSymbol="XLM"
          onPartialRelease={onPartialRelease}
        />
      );

      const input = screen.getByTestId("partial-amount-input");
      fireEvent.change(input, { target: { value: "30000000" } });
      fireEvent.click(screen.getByRole("button", { name: /release partial amount/i }));

      expect(
        screen.getByRole("dialog", { name: /confirm partial release/i })
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("release-confirm-modal-amount")
      ).toHaveTextContent("3 XLM");
      expect(onPartialRelease).not.toHaveBeenCalled();
    });

    it("calls onPartialRelease with the validated amount when partial release is confirmed", () => {
      const onPartialRelease = vi.fn();

      render(
        <MilestoneCard
          milestone={{
            index: 1,
            amount: "100000000",
            status: "Delivered",
          }}
          isClient
          isFreelancer={false}
          freelancerAddress="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
          partialReleaseState={idleActionState}
          claimAutoReleaseState={idleActionState}
          isPartialReleasePending={false}
          isClaimAutoReleasePending={false}
          amountDecimals={7}
          amountSymbol="XLM"
          onPartialRelease={onPartialRelease}
        />
      );

      const input = screen.getByTestId("partial-amount-input");
      fireEvent.change(input, { target: { value: "30000000" } });
      fireEvent.click(screen.getByRole("button", { name: /release partial amount/i }));
      fireEvent.click(screen.getByRole("button", { name: /release amount/i }));

      expect(onPartialRelease).toHaveBeenCalledWith(1, "30000000");
    });

    it("does not call onPartialRelease when partial release confirmation is cancelled", () => {
      const onPartialRelease = vi.fn();

      render(
        <MilestoneCard
          milestone={{
            index: 1,
            amount: "100000000",
            status: "Delivered",
          }}
          isClient
          isFreelancer={false}
          freelancerAddress="GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
          partialReleaseState={idleActionState}
          claimAutoReleaseState={idleActionState}
          isPartialReleasePending={false}
          isClaimAutoReleasePending={false}
          amountDecimals={7}
          amountSymbol="XLM"
          onPartialRelease={onPartialRelease}
        />
      );

      const input = screen.getByTestId("partial-amount-input");
      fireEvent.change(input, { target: { value: "30000000" } });
      fireEvent.click(screen.getByRole("button", { name: /release partial amount/i }));
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(onPartialRelease).not.toHaveBeenCalled();
    });
  });

  it("keeps empty-state layout spacing stable across breakpoints", () => {
    renderCard(null);

    expect(screen.getByTestId("milestone-empty-state")).toHaveClass(
      "rounded-lg",
      "p-4",
      "sm:flex-row",
      "sm:items-center",
      "sm:justify-between"
    );
  });

  it("renders 'Claim Auto-Release' button for freelancer when deadline has elapsed", () => {
    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Delivered" }}
        isClient={false}
        isFreelancer
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        onClaimAutoRelease={vi.fn()}
        autoReleaseDeadline={Date.now() - 1}
      />
    );

    expect(
      screen.getByRole("button", { name: /claim auto-release/i })
    ).toBeInTheDocument();
  });

  it("does NOT render 'Claim Auto-Release' for client when deadline has elapsed", () => {
    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Delivered" }}
        isClient
        isFreelancer={false}
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        onClaimAutoRelease={vi.fn()}
        autoReleaseDeadline={Date.now() - 1}
      />
    );

    expect(
      screen.queryByRole("button", { name: /claim auto-release/i })
    ).not.toBeInTheDocument();
  });

  it("does NOT render 'Claim Auto-Release' when deadline has NOT elapsed", () => {
    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Delivered" }}
        isClient={false}
        isFreelancer
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        onClaimAutoRelease={vi.fn()}
        autoReleaseDeadline={Date.now() + 100_000}
      />
    );

    expect(
      screen.queryByRole("button", { name: /claim auto-release/i })
    ).not.toBeInTheDocument();
  });

  it("disables 'Claim Auto-Release' button when handler is absent", () => {
    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Delivered" }}
        isClient={false}
        isFreelancer
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        autoReleaseDeadline={Date.now() - 1}
      />
    );

    expect(
      screen.getByRole("button", { name: /claim auto-release/i })
    ).toBeDisabled();
  });

  it("shows 'Claiming...' text when claim is pending", () => {
    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Delivered" }}
        isClient={false}
        isFreelancer
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending
        onClaimAutoRelease={vi.fn()}
        autoReleaseDeadline={Date.now() - 1}
      />
    );

    expect(screen.getByText("Claiming...")).toBeInTheDocument();
  });

  it("does NOT render 'Claim Auto-Release' for non-Delivered status", () => {
    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Released" }}
        isClient={false}
        isFreelancer
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        onClaimAutoRelease={vi.fn()}
        autoReleaseDeadline={Date.now() - 1}
      />
    );

    expect(
      screen.queryByRole("button", { name: /claim auto-release/i })
    ).not.toBeInTheDocument();
  });

  it("renders the deadline warning badge when within 24 hours of the deadline", () => {
    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Delivered" }}
        isClient={false}
        isFreelancer
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        autoReleaseDeadline={Date.now() + 60_000}
      />
    );

    expect(screen.getByTestId("milestone-deadline-warning")).toBeInTheDocument();
  });

  it("does NOT render the deadline warning badge when more than 24 hours remain", () => {
    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Delivered" }}
        isClient={false}
        isFreelancer
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        autoReleaseDeadline={Date.now() + 25 * 60 * 60 * 1000}
      />
    );

    expect(screen.queryByTestId("milestone-deadline-warning")).not.toBeInTheDocument();
  });

  it("does NOT render the deadline warning badge when no deadline is set", () => {
    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Delivered" }}
        isClient={false}
        isFreelancer
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
      />
    );

    expect(screen.queryByTestId("milestone-deadline-warning")).not.toBeInTheDocument();
  });

  it("does NOT render the deadline warning badge once the deadline has elapsed", () => {
    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Delivered" }}
        isClient={false}
        isFreelancer
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        autoReleaseDeadline={Date.now() - 1}
      />
    );

    expect(screen.queryByTestId("milestone-deadline-warning")).not.toBeInTheDocument();
  });

  it("does NOT render the deadline warning badge for a non-Delivered status", () => {
    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Released" }}
        isClient={false}
        isFreelancer
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        autoReleaseDeadline={Date.now() + 60_000}
      />
    );

    expect(screen.queryByTestId("milestone-deadline-warning")).not.toBeInTheDocument();
  });

  it("uses 10% of autoReleaseWindowMs when that exceeds the 24h floor", () => {
    const tenDays = 10 * 24 * 60 * 60 * 1000;
    // 10% of 10 days = 1 day; remaining 36h is outside the 10% window
    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Delivered" }}
        isClient={false}
        isFreelancer
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        autoReleaseDeadline={Date.now() + 36 * 60 * 60 * 1000}
        autoReleaseWindowMs={tenDays}
      />
    );

    expect(screen.queryByTestId("milestone-deadline-warning")).not.toBeInTheDocument();
  });

  it("renders the deadline warning badge when remaining time is inside the final 10% of the window", () => {
    const tenDays = 10 * 24 * 60 * 60 * 1000;
    // 10% of 10 days = 1 day; remaining 12h is inside the final 10%
    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Delivered" }}
        isClient={false}
        isFreelancer
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        autoReleaseDeadline={Date.now() + 12 * 60 * 60 * 1000}
        autoReleaseWindowMs={tenDays}
      />
    );

    expect(screen.getByTestId("milestone-deadline-warning")).toBeInTheDocument();
  });
});

describe("MilestoneCard claim eligibility from on-chain data", () => {
  const DAY = 86_400;
  const renderDelivered = (extra: Record<string, unknown>) =>
    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Delivered", ...extra }}
        isClient={false}
        isFreelancer
        partialReleaseState={idleActionState}
        claimAutoReleaseState={idleActionState}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        onClaimAutoRelease={vi.fn()}
        autoReleaseDeadline={null}
      />
    );

  it("shows the claim button when delivered 10 days ago with a 7-day window and no backend deadline", () => {
    renderDelivered({
      deliveredAt: Math.floor(Date.now() / 1000) - 10 * DAY,
      autoReleaseSeconds: 7 * DAY,
    });
    expect(screen.getByRole("button", { name: /claim auto-release/i })).toBeInTheDocument();
  });

  it("hides the claim button while the on-chain window is still open", () => {
    renderDelivered({
      deliveredAt: Math.floor(Date.now() / 1000) - 1 * DAY,
      autoReleaseSeconds: 7 * DAY,
    });
    expect(screen.queryByRole("button", { name: /claim auto-release/i })).not.toBeInTheDocument();
  });

  it("shows the button with a note when the deadline can't be determined", () => {
    renderDelivered({});
    expect(screen.getByRole("button", { name: /claim auto-release/i })).toBeInTheDocument();
    expect(screen.getByText(/contract will reject this/i)).toBeInTheDocument();
  });
});
