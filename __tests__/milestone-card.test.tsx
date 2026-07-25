import { render, screen } from "@testing-library/react";
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

  it("uses 20% of autoReleaseWindowMs when that exceeds the 24h floor", () => {
    const tenDays = 10 * 24 * 60 * 60 * 1000;
    // 20% of 10 days = 2 days; remaining 36h is within that window
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

    expect(screen.getByTestId("milestone-deadline-warning")).toBeInTheDocument();
  });
});
