import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/app/(app)/dashboard/page";

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

vi.mock("@/app/hooks/useActionStates", () => ({
  useActionStates: () => mockUseActionStates(),
}));

/**
 * Issue #684 — The dashboard search accepts free text but only exact contract
 * IDs can match.
 *
 * The search should filter loaded jobs client-side by substring across
 * contract ID, counterparty addresses, and token symbol. Typing a partial ID
 * should filter visible rows, never a silently unfiltered list.
 */
describe("Dashboard — client-side search filter (issue #684)", () => {
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
    mockUseActionStates.mockReturnValue({
      getState: () => ({ phase: "idle", error: null, txHash: null }),
      isPending: () => false,
      setPhase: vi.fn(),
      setError: vi.fn(),
      setTxHash: vi.fn(),
    });
  });

  const jobs = [
    {
      id: "CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH",
      client: "GCLIENTADDR1234567890123456789012345678901234567890AB",
      freelancer: "GFREELANCERADDR12345678901234567890123456789012345",
      arbiter: "GARBITERADDR1234567890123456789012345678901234567890",
      funded: true,
      milestones: [],
      tokenSymbol: "USDC",
    },
    {
      id: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASOMETHING",
      client: "GDIFFERENTCLIENT1234567890123456789012345678901234567",
      freelancer: "GOTHERFREELANCER12345678901234567890123456789012345",
      arbiter: "GARBITERADDR1234567890123456789012345678901234567890",
      funded: false,
      milestones: [],
      tokenSymbol: "XLM",
    },
  ];

  const stubJobsResponse = (jobList: typeof jobs) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          data: jobList,
          page: 1,
          limit: 5,
          total: jobList.length,
        }),
      })
    );
  };

  const typeAndSearch = async (query: string) => {
    const input = screen.getByLabelText("Search by contract ID");
    fireEvent.change(input, { target: { value: query } });
    fireEvent.click(screen.getByRole("button", { name: "Submit search query" }));
  };

  it("shows all jobs when no search query is entered", async () => {
    stubJobsResponse(jobs);
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId("dashboard-list-item")).toHaveLength(2);
    });
  });

  it("filters jobs by partial contract ID substring", async () => {
    stubJobsResponse(jobs);
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId("dashboard-list-item")).toHaveLength(2);
    });

    await typeAndSearch("CDD5");

    await waitFor(() => {
      expect(screen.getAllByTestId("dashboard-list-item")).toHaveLength(1);
    });
  });

  it("filters jobs by freelancer address substring", async () => {
    stubJobsResponse(jobs);
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId("dashboard-list-item")).toHaveLength(2);
    });

    await typeAndSearch("GFREELANCER");

    await waitFor(() => {
      expect(screen.getAllByTestId("dashboard-list-item")).toHaveLength(1);
    });
  });

  it("filters jobs by token symbol substring", async () => {
    stubJobsResponse(jobs);
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId("dashboard-list-item")).toHaveLength(2);
    });

    await typeAndSearch("USDC");

    await waitFor(() => {
      expect(screen.getAllByTestId("dashboard-list-item")).toHaveLength(1);
    });
  });

  it("filters jobs by client address substring", async () => {
    stubJobsResponse(jobs);
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId("dashboard-list-item")).toHaveLength(2);
    });

    await typeAndSearch("GDIFFERENT");

    await waitFor(() => {
      expect(screen.getAllByTestId("dashboard-list-item")).toHaveLength(1);
    });
  });

  it("shows 'Filtering this page' hint when filtering is active", async () => {
    stubJobsResponse(jobs);
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId("dashboard-list-item")).toHaveLength(2);
    });

    expect(screen.queryByTestId("dashboard-filter-hint")).not.toBeInTheDocument();

    await typeAndSearch("USDC");

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-filter-hint")).toBeInTheDocument();
      expect(screen.getByTestId("dashboard-filter-hint")).toHaveTextContent(/Filtering this page/);
    });
  });

  it("shows empty filter state when no jobs match the search", async () => {
    stubJobsResponse(jobs);
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId("dashboard-list-item")).toHaveLength(2);
    });

    await typeAndSearch("NONEXISTENT_QUERY_XYZ");

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-filter-empty-state")).toBeInTheDocument();
      expect(screen.getByText("No matching jobs")).toBeInTheDocument();
    });
  });

  it("does not send contractId as a backend parameter", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: jobs,
        page: 1,
        limit: 5,
        total: jobs.length,
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId("dashboard-list-item")).toHaveLength(2);
    });

    // The initial fetch should not include a contractId param
    const initialCall = fetchSpy.mock.calls[0][0] as string;
    expect(initialCall).not.toContain("contractId");
  });

  it("restores full list when search is cleared", async () => {
    stubJobsResponse(jobs);
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId("dashboard-list-item")).toHaveLength(2);
    });

    // Filter down to one
    await typeAndSearch("USDC");
    await waitFor(() => {
      expect(screen.getAllByTestId("dashboard-list-item")).toHaveLength(1);
    });

    // Clear the search
    const input = screen.getByLabelText("Search by contract ID");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit search query" }));

    await waitFor(() => {
      expect(screen.getAllByTestId("dashboard-list-item")).toHaveLength(2);
    });
  });
});
