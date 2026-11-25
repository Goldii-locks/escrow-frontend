// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MilestoneCard from "@/app/components/MilestoneCard";

const idle = { phase: "idle" as const, error: null, txHash: null };

describe("MilestoneCard acceptance gate (#802)", () => {
  it("disables Mark Delivered and Dispute with an explanation until both accept", () => {
    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Pending" }}
        isClient={false}
        isFreelancer
        partialReleaseState={idle}
        claimAutoReleaseState={idle}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        onMarkDelivered={vi.fn()}
        onDispute={vi.fn()}
        acceptancePending
        acceptanceMessage="Waiting for the arbiter to accept"
      />
    );

    expect(screen.getByTestId("mark-delivered-button")).toBeDisabled();
    expect(screen.getByTestId("mark-delivered-button")).toHaveAttribute(
      "title",
      "Waiting for the arbiter to accept"
    );
    expect(screen.getByTestId("dispute-button")).toBeDisabled();
    expect(screen.getByTestId("milestone-acceptance-note")).toHaveTextContent(
      "Waiting for the arbiter to accept"
    );
  });

  it("enables delivery and disputes once both parties have accepted", () => {
    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Pending" }}
        isClient={false}
        isFreelancer
        partialReleaseState={idle}
        claimAutoReleaseState={idle}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        onMarkDelivered={vi.fn()}
        onDispute={vi.fn()}
        acceptancePending={false}
        acceptanceMessage={null}
      />
    );

    expect(screen.getByTestId("mark-delivered-button")).not.toBeDisabled();
    expect(screen.getByTestId("dispute-button")).not.toBeDisabled();
    expect(screen.queryByTestId("milestone-acceptance-note")).not.toBeInTheDocument();
  });

  it("keeps client approval available while acceptance is missing", () => {
    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Delivered" }}
        isClient
        isFreelancer={false}
        partialReleaseState={idle}
        claimAutoReleaseState={idle}
        isPartialReleasePending={false}
        isClaimAutoReleasePending={false}
        onApprove={vi.fn()}
        onDispute={vi.fn()}
        acceptancePending
        acceptanceMessage="Waiting for the freelancer to accept"
      />
    );

    expect(screen.getByRole("button", { name: /approve milestone 1/i })).not.toBeDisabled();
    expect(screen.getByTestId("dispute-button")).toBeDisabled();
    expect(screen.getByTestId("milestone-acceptance-note")).toHaveTextContent(
      "Waiting for the freelancer to accept"
    );
  });
});
