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
    expect(screen.getByRole("button", { name: "Mark Delivered" })).toBeInTheDocument();
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
});
