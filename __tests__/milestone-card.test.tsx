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

  describe("interactive states", () => {
    it("renders card with hover and focus-within classes", () => {
      render(
        <MilestoneCard
          milestone={{ index: 0, amount: "100", status: "Pending" }}
          isClient
          isFreelancer={false}
          onApprove={vi.fn()}
        />
      );

      const card = screen.getByTestId("milestone-card");
      expect(card).toHaveClass("hover:border-accent-soft/40");
      expect(card).toHaveClass("hover:bg-surface-card/80");
      expect(card).toHaveClass("focus-within:ring-2");
    });

    it("disables Mark Delivered button when onMarkDelivered is not provided", () => {
      render(
        <MilestoneCard
          milestone={{ index: 0, amount: "100", status: "Pending" }}
          isFreelancer
          isClient={false}
        />
      );

      const btn = screen.getByRole("button", { name: "Mark Delivered" });
      expect(btn).toBeDisabled();
      expect(btn).toHaveClass("disabled:opacity-40");
      expect(btn).toHaveClass("disabled:cursor-not-allowed");
    });

    it("enables Mark Delivered button when onMarkDelivered is provided", () => {
      render(
        <MilestoneCard
          milestone={{ index: 0, amount: "100", status: "Pending" }}
          isFreelancer
          isClient={false}
          onMarkDelivered={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: "Mark Delivered" })).toBeEnabled();
    });

    it("disables Approve button when onApprove is not provided", () => {
      render(
        <MilestoneCard
          milestone={{ index: 0, amount: "100", status: "Delivered" }}
          isClient
          isFreelancer={false}
        />
      );

      expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    });

    it("disables Dispute button when onDispute is not provided", () => {
      render(
        <MilestoneCard
          milestone={{ index: 0, amount: "100", status: "Pending" }}
          isClient
          isFreelancer={false}
        />
      );

      expect(screen.getByRole("button", { name: "Dispute" })).toBeDisabled();
    });

    it("renders buttons with active scale transform class", () => {
      render(
        <MilestoneCard
          milestone={{ index: 0, amount: "100", status: "Pending" }}
          isFreelancer
          isClient={false}
          onMarkDelivered={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: "Mark Delivered" })).toHaveClass("active:scale-[0.97]");
    });

    it("renders buttons with focus-visible ring classes", () => {
      render(
        <MilestoneCard
          milestone={{ index: 0, amount: "100", status: "Pending" }}
          isFreelancer
          isClient={false}
          onMarkDelivered={vi.fn()}
        />
      );

      const btn = screen.getByRole("button", { name: "Mark Delivered" });
      expect(btn).toHaveClass("focus-visible:ring-2");
      expect(btn).toHaveClass("focus-visible:ring-info-soft");
    });
  });
});
