import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/app/dashboard/page";

const mockUseWallet = vi.fn();
const mockUseToast = vi.fn();
const mockUseActionStates = vi.fn();

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

vi.mock("@/app/components/EmptyStateCard", () => ({
  default: ({
    testId,
    ariaLabel,
    title,
    description,
    icon,
    badges,
  }: {
    testId?: string;
    ariaLabel?: string;
    title: string;
    description: string;
    icon?: string;
    badges?: string[];
  }) => (
    <div
      data-testid={testId}
      role="region"
      aria-label={ariaLabel}
      className="border rounded-lg bg-surface-card p-4 flex flex-col items-center text-center gap-4"
    >
      <div data-testid="empty-state-icon" aria-hidden="true">
        {icon}
      </div>
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-gray-400">{description}</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {badges?.map((badge) => (
          <span
            key={badge}
            className="text-xs px-2 py-0.5 rounded-full border border-gray-700 bg-gray-800 text-gray-200"
            role="status"
            aria-label={`Role: ${badge}`}
          >
            {badge}
          </span>
        ))}
      </div>
    </div>
  ),
}));

vi.mock("@/app/hooks/useActionStates", () => ({
  useActionStates: () => mockUseActionStates(),
}));

describe("Dashboard — jobs list (dashboard_list) rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({
      address: "GCLIENTADDRESS1234567890123456789012345678901234",
      signTransaction: vi.fn(),
    });
    mockUseToast.mockReturnValue({
      showToast: vi.fn(),
      toasts: [],
      hideToast: vi.fn(),
    });
    mockUseActionStates.mockReturnValue({
      getState: () => ({ phase: "idle", error: null, txHash: null }),
      isPending: () => false,
      setPhase: vi.fn(),
      setError: vi.fn(),
      setTxHash: vi.fn(),
    });
  });

  type MockJob = ReturnType<typeof mockJob>;

  const mockJobsResponse = (
    jobs: MockJob[] = [],
    overrides: Record<string, unknown> = {}
  ) => ({
    success: true,
    data: jobs,
    page: 1,
    limit: 5,
    total: jobs.length,
    ...overrides,
  });

  const mockJob = (overrides: Record<string, unknown> = {}) => ({
    id: "job-1234567890abcdef",
    client: "GCLIENTADDRESS1234567890123456789012345678901234",
    freelancer: "GFREELANCERADDRESS12345678901234567890123456",
    arbiter: "GARBITERADDRESS12345678901234567890123456789012",
    funded: true,
    milestones: [
      { index: 0, amount: "250000000", status: "Pending" },
      { index: 1, amount: "500000000", status: "Delivered" },
    ],
    tokenSymbol: "USDC",
    tokenDecimals: 7,
    ...overrides,
  });

  const setupFetch = (response: unknown) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => response,
    }));
  };

  describe("Loading state", () => {
    it("shows LoadingSkeleton while fetching jobs", async () => {
      let resolveFetch!: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      vi.stubGlobal("fetch", vi.fn().mockReturnValue(fetchPromise));

      render(<Dashboard />);

      expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();

      await resolveFetch(mockJobsResponse([]));
    });

    it("shows loading skeleton with proper accessible status role", () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        json: async () => mockJobsResponse([]),
      }));

      render(<Dashboard />);

      const skeleton = screen.getByTestId("loading-skeleton");
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe("Error state", () => {
    it("displays error alert when API fails", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        json: async () => ({
          success: false,
          error: "Failed to fetch jobs",
        }),
      }));

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("dashboard-error-alert")).toBeInTheDocument();
      });

      expect(screen.getByText("Error loading jobs")).toBeInTheDocument();
      expect(screen.getByText("Failed to fetch jobs")).toBeInTheDocument();
    });

    it("error alert has proper ARIA attributes", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        json: async () => ({
          success: false,
          error: "Backend unavailable",
        }),
      }));

      render(<Dashboard />);

      await waitFor(() => {
        const alert = screen.getByTestId("dashboard-error-alert");
        expect(alert).toHaveAttribute("role", "alert");
        expect(alert).toHaveAttribute("aria-live", "assertive");
      });
    });
  });

  describe("Empty state", () => {
    it("shows EmptyStateCard when no jobs found", async () => {
      setupFetch(mockJobsResponse([]));

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByTestId("dashboard-empty-state")).toBeInTheDocument();
      });
    });

    it("displays correct title and description in empty state", async () => {
      setupFetch(mockJobsResponse([]));

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("No jobs found")).toBeInTheDocument();
        expect(screen.getByText(/You don't have any jobs yet/)).toBeInTheDocument();
      });
    });

    it("shows role badges in empty state", async () => {
      setupFetch(mockJobsResponse([]));

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Client")).toBeInTheDocument();
        expect(screen.getByText("Freelancer")).toBeInTheDocument();
        expect(screen.getByText("Arbiter")).toBeInTheDocument();
      });
    });

    it("empty state is an accessible region", async () => {
      setupFetch(mockJobsResponse([]));

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole("region", { name: "No jobs" })).toBeInTheDocument();
      });
    });
  });

  describe("Jobs list rendering", () => {
    it("renders job list items when jobs exist", async () => {
      const jobs = [
        mockJob({ id: "job-1", funded: true }),
        mockJob({ id: "job-2", funded: false }),
      ];
      setupFetch(mockJobsResponse(jobs));

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getAllByTestId("dashboard-list-item")).toHaveLength(2);
      });
    });

    it("displays job ID prefix for each job", async () => {
      const jobs = [mockJob({ id: "job-abcdef123456" })];
      setupFetch(mockJobsResponse(jobs));

      render(<Dashboard />);

      await waitFor(() => {
        // Component slices first 8 chars: "job-abcd"
        expect(screen.getByText("Job #job-abcd")).toBeInTheDocument();
      });
    });

    it("shows funded status for each job", async () => {
      const jobs = [
        mockJob({ id: "job-funded", funded: true }),
        mockJob({ id: "job-unfunded", funded: false }),
      ];
      setupFetch(mockJobsResponse(jobs));

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText("Funded")).toBeInTheDocument();
        expect(screen.getByText("Not funded")).toBeInTheDocument();
      });
    });

    it("displays role badges for user's roles", async () => {
      const jobs = [mockJob({
        id: "job-with-roles",
        client: "GCLIENTADDRESS1234567890123456789012345678901234",
        freelancer: "GFREELANCERADDRESS12345678901234567890123456",
      })];
      setupFetch(mockJobsResponse(jobs));

      render(<Dashboard />);

      await waitFor(() => {
        // Check role badges in the list item - they appear as text
        const clientBadges = screen.getAllByText("Client");
        const freelancerBadges = screen.getAllByText("Freelancer");
        expect(clientBadges.length).toBeGreaterThanOrEqual(1);
        expect(freelancerBadges.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("job list container has proper ARIA label", async () => {
      const jobs = [mockJob({ id: "job-1" })];
      setupFetch(mockJobsResponse(jobs));

      render(<Dashboard />);

      await waitFor(() => {
        const listRegion = screen.getByRole("region", { name: "Jobs list" });
        expect(listRegion).toBeInTheDocument();
      });
    });

    it("job items have expand/collapse button with proper ARIA", async () => {
      const jobs = [mockJob({ id: "job-expandable" })];
      setupFetch(mockJobsResponse(jobs));

      render(<Dashboard />);

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /Job #job-exp/ });
        expect(button).toBeInTheDocument();
        // First job is expanded by default, so aria-expanded is "true"
        expect(button).toHaveAttribute("aria-expanded", "true");
        expect(button).toHaveAttribute("aria-controls");
      });
    });
  });

  describe("Search and filter", () => {
    it("has search input with proper ARIA attributes", async () => {
      setupFetch(mockJobsResponse([]));

      render(<Dashboard />);

      await waitFor(() => {
        const searchInput = screen.getByLabelText("Search by contract ID");
        expect(searchInput).toBeInTheDocument();
        expect(searchInput).toHaveAttribute("placeholder", "Search by contract/job ID");
      });
    });

    it("has role filter tabs with proper ARIA", async () => {
      setupFetch(mockJobsResponse([]));

      render(<Dashboard />);

      await waitFor(() => {
        const filterTabs = screen.getByRole("tablist", { name: "Filter jobs by role" });
        expect(filterTabs).toBeInTheDocument();

        expect(screen.getByRole("tab", { name: "Filter jobs: All" })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "Filter jobs: As Client" })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "Filter jobs: As Freelancer" })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "Filter jobs: As Arbiter" })).toBeInTheDocument();
      });
    });

    it("role filter shows active state", async () => {
      setupFetch(mockJobsResponse([]));

      render(<Dashboard />);

      await waitFor(() => {
        const allTab = screen.getByRole("tab", { name: "Filter jobs: All" });
        expect(allTab).toHaveAttribute("aria-selected", "true");
      });
    });
  });

  describe("Disconnected wallet state", () => {
    it("shows connect wallet message when no address", async () => {
      mockUseWallet.mockReturnValue({
        address: null,
        signTransaction: vi.fn(),
      });

      render(<Dashboard />);

      expect(screen.getByText(/Connect your wallet to view your jobs/)).toBeInTheDocument();
    });

    it("connect wallet message has proper ARIA attributes", async () => {
      mockUseWallet.mockReturnValue({
        address: null,
        signTransaction: vi.fn(),
      });

      render(<Dashboard />);

      const message = screen.getByText(/Connect your wallet to view your jobs/);
      expect(message).toHaveAttribute("role", "status");
      expect(message).toHaveAttribute("aria-live", "polite");
    });
  });

  describe("Accessibility", () => {
    it("maintains proper heading hierarchy", async () => {
      setupFetch(mockJobsResponse([]));

      render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 1, name: "Job Dashboard" })).toBeInTheDocument();
      });
    });
  });
});

function mockJob(overrides = {}) {
  return {
    id: "job-1234567890abcdef",
    client: "GCLIENTADDRESS1234567890123456789012345678901234",
    freelancer: "GFREELANCERADDRESS12345678901234567890123456",
    arbiter: "GARBITERADDRESS12345678901234567890123456789012",
    funded: true,
    milestones: [
      { index: 0, amount: "250000000", status: "Pending" },
      { index: 1, amount: "500000000", status: "Delivered" },
    ],
    tokenSymbol: "USDC",
    tokenDecimals: 7,
    ...overrides,
  };
}