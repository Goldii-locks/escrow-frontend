import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MilestoneCard from "@/app/components/MilestoneCard";

describe("MilestoneCard", () => {
  it("renders empty-state placeholder for null milestone data", () => {
    render(<MilestoneCard milestone={null} isClient={false} isFreelancer={false} />);

    expect(screen.getByTestId("milestone-empty-state")).toBeInTheDocument();
    expect(screen.getByText("No milestones available")).toBeInTheDocument();
  });

  it("renders fallback placeholder when milestone is undefined", () => {
    render(<MilestoneCard isClient={false} isFreelancer={false} />);

    expect(screen.getByTestId("milestone-empty-state")).toBeInTheDocument();
  });

  it("renders action controls for expected statuses", () => {
    const onMarkDelivered = vi.fn();

    render(
      <MilestoneCard
        milestone={{ index: 0, amount: "100", status: "Pending" }}
        isClient={false}
        isFreelancer
        onMarkDelivered={onMarkDelivered}
      />
    );

    expect(screen.getByTestId("milestone-card")).toHaveClass("bg-surface-card");
    expect(screen.getByRole("button", { name: "Mark Delivered" })).toBeInTheDocument();
  });
});
