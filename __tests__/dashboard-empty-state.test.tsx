/**
 * Issue #276 – Design empty list display views for loading_spinner_skeleton
 *
 * Verifies that the Dashboard job list renders a descriptive EmptyState
 * placeholder (not a bare line of text) once loading finishes with zero
 * jobs, and that it steps aside once jobs are present.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/app/dashboard/page";

const mockUseWallet = vi.fn();

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock("@/app/components/LoadingSkeleton", () => ({
  default: () => <div data-testid="loading-skeleton" />,
}));

describe("Dashboard – empty job list view (issue #276)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({ address: "GCLIENT", signTransaction: vi.fn() });
  });

  it("renders the EmptyState placeholder when the wallet has zero jobs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ success: true, data: [], page: 1, limit: 5, total: 0 }),
      })
    );

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
  });

  it("shows a descriptive title and supporting description, not bare text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ success: true, data: [], page: 1, limit: 5, total: 0 }),
      })
    );

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("empty-state-title")).toHaveTextContent("No jobs found");
      expect(screen.getByTestId("empty-state-description")).toHaveTextContent(
        /create one to get started/i
      );
    });
  });

  it("does NOT render the EmptyState placeholder once jobs are present", async () => {
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
      expect(screen.queryByTestId("loading-skeleton")).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });

  it("does NOT render the EmptyState placeholder while no wallet is connected", () => {
    mockUseWallet.mockReturnValue({ address: null, signTransaction: vi.fn() });
    render(<Dashboard />);
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });
});
