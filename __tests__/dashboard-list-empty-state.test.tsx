import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/app/dashboard/page";

const mockUseWallet = vi.fn();
const mockUseToast = vi.fn();

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => mockUseToast(),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("@/app/components/LoadingSkeleton", () => ({
  default: () => <div data-testid="loading-skeleton" />,
}));

vi.mock("@/app/components/MilestoneCard", () => ({
  default: () => <div data-testid="milestone-card" />,
}));

describe("Dashboard — empty state placeholder UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({
      address: "GCLIENT",
      signTransaction: vi.fn(),
    });
    mockUseToast.mockReturnValue({
      showToast: vi.fn(),
      toasts: [],
      hideToast: vi.fn(),
    });
  });

  describe("Placeholder elements rendering", () => {
    it("displays descriptive empty state card when jobs list is empty", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("dashboard-empty-state")).toBeInTheDocument();
      });
    });

    it("renders with proper briefcase icon for job-related context", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      const { container } = render(<Dashboard />);

      await waitFor(() => {
        const emptyState = screen.getByTestId("dashboard-empty-state");
        expect(emptyState).toBeInTheDocument();
        // Check that SVG icon is rendered
        const icons = container.querySelectorAll("svg");
        expect(icons.length).toBeGreaterThan(0);
      });
    });

    it("displays descriptive title 'No jobs found'", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("No jobs found")).toBeInTheDocument();
      });
    });

    it("displays descriptive subtitle explaining the empty state", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        expect(
          screen.getByText(
            /You don't have any jobs yet. Connect your wallet to see jobs you're involved in as a client, freelancer, or arbiter/
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe("Role badges in empty state", () => {
    it("renders role badges showing available participation options", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Client")).toBeInTheDocument();
        expect(screen.getByText("Freelancer")).toBeInTheDocument();
        expect(screen.getByText("Arbiter")).toBeInTheDocument();
      });
    });

    it("displays all three role badges together in empty state", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const emptyState = screen.getByTestId("dashboard-empty-state");
        const clientBadge = screen.getByText("Client");
        const freelancerBadge = screen.getByText("Freelancer");
        const arbiterBadge = screen.getByText("Arbiter");

        expect(emptyState).toContainElement(clientBadge);
        expect(emptyState).toContainElement(freelancerBadge);
        expect(emptyState).toContainElement(arbiterBadge);
      });
    });
  });

  describe("Accessibility and semantic markup", () => {
    it("renders empty state as an accessible region landmark", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole("region", { name: "No jobs" })).toBeInTheDocument();
      });
    });

    it("has descriptive aria-label for screen reader context", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const region = screen.getByRole("region", { name: "No jobs" });
        expect(region).toHaveAttribute("aria-label", "No jobs");
      });
    });

    it("has proper semantic styling with border and rounded container", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const emptyState = screen.getByTestId("dashboard-empty-state");
        expect(emptyState).toHaveClass("border", "rounded-lg", "bg-surface-card");
      });
    });
  });

  describe("State transitions", () => {
    it("transitions from loading skeleton to empty state", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      // Initially shows loading
      expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();

      // Then transitions to empty state
      await waitFor(() => {
        expect(screen.queryByTestId("loading-skeleton")).not.toBeInTheDocument();
        expect(screen.getByTestId("dashboard-empty-state")).toBeInTheDocument();
      });
    });

    it("hides empty state when jobs load successfully", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [
              {
                id: "job-1",
                client: "GCLIENT",
                freelancer: "GFREELANCER",
                arbiter: "GARBITER",
                funded: true,
                milestones: [],
              },
            ],
            page: 1,
            limit: 5,
            total: 1,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.queryByTestId("dashboard-empty-state")).not.toBeInTheDocument();
      });
    });
  });

  describe("Empty state with different data conditions", () => {
    it("shows empty state when API returns empty data array", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("dashboard-empty-state")).toBeInTheDocument();
        expect(screen.getByText("No jobs found")).toBeInTheDocument();
      });
    });

    it("shows empty state when filtering results in no matches", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("dashboard-empty-state")).toBeInTheDocument();
      });
    });

    it("displays empty state with coherent messaging for disconnected wallet", async () => {
      mockUseWallet.mockReturnValue({
        address: null,
        signTransaction: vi.fn(),
      });

      render(<Dashboard />);

      expect(
        screen.getByText(/Connect your wallet to view your jobs/)
      ).toBeInTheDocument();
    });
  });

  describe("Visual hierarchy and structure", () => {
    it("centers content within the empty state card", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const emptyState = screen.getByTestId("dashboard-empty-state");
        expect(emptyState).toHaveClass("flex", "flex-col", "items-center", "text-center");
      });
    });

    it("spaces content elements properly with gap utility", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: async () => ({
            success: true,
            data: [],
            page: 1,
            limit: 5,
            total: 0,
          }),
        })
      );

      render(<Dashboard />);

      await waitFor(() => {
        const emptyState = screen.getByTestId("dashboard-empty-state");
        expect(emptyState).toHaveClass("gap-4");
      });
    });
  });
});
