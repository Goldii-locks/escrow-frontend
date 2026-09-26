import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ResolutionVoteForm from "@/app/components/ResolutionVoteForm";

describe("ResolutionVoteForm", () => {
  const mockHandlers = {
    onVoteFreelancer: vi.fn(),
    onVoteClient: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Access Control - Unauthorized Users (#450)", () => {
    it("displays unauthorized warning for non-arbiters", () => {
      render(
        <ResolutionVoteForm
          isAuthorizedArbiter={false}
          isLoading={false}
        />
      );
      expect(screen.getByText("Access Restricted")).toBeInTheDocument();
      expect(
        screen.getByText(/only authorized arbiters/i)
      ).toBeInTheDocument();
    });

    it("renders warning with lock icon for non-arbiters", () => {
      const { container } = render(
        <ResolutionVoteForm
          isAuthorizedArbiter={false}
          isLoading={false}
        />
      );
      expect(container.textContent).toContain("🔒");
    });

    it("displays support message in unauthorized warning", () => {
      render(
        <ResolutionVoteForm
          isAuthorizedArbiter={false}
          isLoading={false}
        />
      );
      expect(
        screen.getByText(/contact support/i)
      ).toBeInTheDocument();
    });

    it("does not render vote options when unauthorized", () => {
      render(
        <ResolutionVoteForm
          isAuthorizedArbiter={false}
          isLoading={false}
        />
      );
      expect(
        screen.queryByText("Release to Freelancer")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Refund to Client")
      ).not.toBeInTheDocument();
    });

    it("applies danger styling to unauthorized warning", () => {
      const { container } = render(
        <ResolutionVoteForm
          isAuthorizedArbiter={false}
          isLoading={false}
        />
      );
      const warningBox = container.querySelector("[class*='danger-soft']");
      expect(warningBox).toBeInTheDocument();
    });
  });

  describe("Loading State Skeletons (#451)", () => {
    it("displays loading skeletons when isLoading is true", () => {
      const { container } = render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={true}
        />
      );
      const skeletons = container.querySelectorAll("[class*='animate-pulse']");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("shows header skeleton while loading", () => {
      const { container } = render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={true}
        />
      );
      const skeletons = container.querySelectorAll(".animate-pulse");
      // Should have header and content skeletons
      expect(skeletons.length).toBeGreaterThanOrEqual(3);
    });

    it("shows vote option placeholders while loading", () => {
      const { container } = render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={true}
        />
      );
      const skeletons = container.querySelectorAll(".animate-pulse");
      // Two vote option skeletons
      const optionSkeletons = Array.from(skeletons).filter((el) =>
        el.parentElement?.className.includes("space-y")
      );
      expect(optionSkeletons.length).toBeGreaterThanOrEqual(2);
    });

    it("displays button skeleton while loading", () => {
      const { container } = render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={true}
        />
      );
      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("does not render interactive form elements while loading", () => {
      render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={true}
        />
      );
      expect(
        screen.queryByText("Release to Freelancer")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("Refund to Client")
      ).not.toBeInTheDocument();
    });

    it("shows loading skeletons even during auth check", () => {
      const { container } = render(
        <ResolutionVoteForm
          isAuthorizedArbiter={false}
          isLoading={true}
        />
      );
      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("Authorized User Interface", () => {
    it("renders vote options for authorized arbiters", () => {
      render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={false}
        />
      );
      expect(screen.getByText("Release to Freelancer")).toBeInTheDocument();
      expect(screen.getByText("Refund to Client")).toBeInTheDocument();
    });

    it("renders form header with instructions", () => {
      render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={false}
        />
      );
      expect(screen.getByText("Resolution Vote")).toBeInTheDocument();
      expect(
        screen.getByText(/select who should receive/i)
      ).toBeInTheDocument();
    });

    it("disables submit button initially", () => {
      render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={false}
        />
      );
      const submitButton = screen.getByText("Submit Vote").closest("button");
      expect(submitButton).toBeDisabled();
    });

    it("enables submit button after selecting vote", () => {
      render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={false}
        />
      );
      const freelancerButton = screen.getByText("Release to Freelancer").closest("button");
      fireEvent.click(freelancerButton);

      const submitButton = screen.getByText("Submit Vote");
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe("Vote Selection", () => {
    it("calls onVoteFreelancer when freelancer option is selected", () => {
      render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={false}
          onVoteFreelancer={mockHandlers.onVoteFreelancer}
        />
      );
      const freelancerButton = screen.getByText("Release to Freelancer");
      fireEvent.click(freelancerButton);
      expect(mockHandlers.onVoteFreelancer).toHaveBeenCalled();
    });

    it("calls onVoteClient when client option is selected", () => {
      render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={false}
          onVoteClient={mockHandlers.onVoteClient}
        />
      );
      const clientButton = screen.getByText("Refund to Client").closest("button")!;
      fireEvent.click(clientButton);
      expect(mockHandlers.onVoteClient).toHaveBeenCalled();
    });

    it("shows checkmark when freelancer option is selected", () => {
      const { container } = render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={false}
        />
      );
      const freelancerButton = screen.getByText("Release to Freelancer").closest("button")!;
      fireEvent.click(freelancerButton);

      const buttons = container.querySelectorAll("button");
      expect(freelancerButton.textContent).toContain("✓");
    });

    it("allows changing vote selection", () => {
      render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={false}
          onVoteFreelancer={mockHandlers.onVoteFreelancer}
          onVoteClient={mockHandlers.onVoteClient}
        />
      );
      const freelancerButton = screen.getByText("Release to Freelancer").closest("button")!;
      const clientButton = screen.getByText("Refund to Client").closest("button")!;

      fireEvent.click(freelancerButton);
      fireEvent.click(clientButton);

      expect(mockHandlers.onVoteClient).toHaveBeenCalledTimes(1);
    });
  });

  describe("Submission State", () => {
    it("disables vote buttons while submitting", () => {
      render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={false}
          isSubmitting={true}
        />
      );
      const freelancerButton = screen.getByText("Release to Freelancer").closest("button");
      const clientButton = screen.getByText("Refund to Client").closest("button");

      expect(freelancerButton).toBeDisabled();
      expect(clientButton).toBeDisabled();
    });

    it("shows loading indicator on submit button", () => {
      render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={false}
          isSubmitting={true}
        />
      );
      expect(screen.getByText(/submitting vote/i)).toBeInTheDocument();
    });

    it("updates button text while submitting", () => {
      render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={false}
          isSubmitting={true}
        />
      );
      expect(screen.getByText("Submitting Vote...")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("displays error message when provided", () => {
      render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={false}
          error="Failed to submit vote"
        />
      );
      expect(screen.getByText("Failed to submit vote")).toBeInTheDocument();
    });

    it("applies danger styling to error message", () => {
      const { container } = render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={false}
          error="Failed to submit vote"
        />
      );
      const errorBox = container.querySelector("[class*='danger-soft']");
      expect(errorBox).toBeInTheDocument();
    });
  });

  describe("Grid Layout", () => {
    it("uses grid layout for vote options", () => {
      const { container } = render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={false}
        />
      );
      const gridContainer = container.querySelector(".grid");
      expect(gridContainer).toHaveClass("grid-cols-1");
    });

    it("maintains consistent spacing between options", () => {
      const { container } = render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={false}
        />
      );
      const gridContainer = container.querySelector(".grid");
      expect(gridContainer).toHaveClass("gap-3");
    });
  });

  describe("Warning Message", () => {
    it("displays irreversible action warning", () => {
      render(
        <ResolutionVoteForm
          isAuthorizedArbiter={true}
          isLoading={false}
        />
      );
      expect(screen.getByText(/permanent.*cannot be reversed/i)).toBeInTheDocument();
    });
  });
});
