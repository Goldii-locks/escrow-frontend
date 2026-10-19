import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

vi.mock("@/app/hooks/useActionStates", () => ({
  useActionStates: () => mockUseActionStates(),
}));

/**
 * Issue #682 — The dashboard list error has no retry action.
 *
 * When `fetchJobs` fails, the dashboard should render an error state with a
 * Retry button that calls `fetchJobs()`, disabled while a fetch is in progress.
 * Clicking Retry after a transient failure should reload the jobs.
 */
describe("Dashboard — error retry button (issue #682)", () => {
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

  it("shows a Retry button when the fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Failed to connect to backend"))
    );

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-error-alert")).toBeInTheDocument();
    });
    expect(screen.getByTestId("dashboard-retry-button")).toBeInTheDocument();
    expect(screen.getByText("Error loading jobs")).toBeInTheDocument();
    expect(
      screen.getByText("Failed to connect to backend")
    ).toBeInTheDocument();
  });

  it("clicking Retry reloads jobs after a transient failure", async () => {
    const successResponse = {
      json: async () => ({
        success: true,
        data: [
          {
            id: "job-retry-success",
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
    };

    const failureResponse = {
      json: async () => ({
        success: false,
        error: "Backend unavailable",
      }),
    };

    let fetchCallCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        fetchCallCount += 1;
        if (fetchCallCount === 1) {
          // Auto-fire on mount: failure triggers error state.
          return Promise.resolve(failureResponse);
        }
        // Subsequent calls (retry, polling) succeed.
        return Promise.resolve(successResponse);
      })
    );

    render(<Dashboard />);

    // Wait for the initial error state.
    await waitFor(() => {
      expect(screen.getByTestId("dashboard-error-alert")).toBeInTheDocument();
    });

    // Click Retry.
    const retryButton = screen.getByTestId("dashboard-retry-button");
    fireEvent.click(retryButton);

    // The error should clear and the job list should render.
    await waitFor(() => {
      expect(screen.queryByTestId("dashboard-error-alert")).not.toBeInTheDocument();
      expect(
        screen.getAllByTestId("dashboard-list-item").length
      ).toBeGreaterThan(0);
    });
  });

  it("Retry button is disabled while a fetch is in progress", async () => {
    // First call: fails immediately to show the error state.
    // Second call (retry): hangs so the button stays disabled.
    let resolveSecondCall!: (value: unknown) => void;
    const secondCallPromise = new Promise((resolve) => {
      resolveSecondCall = resolve;
    });

    const failureResponse = {
      json: async () => ({
        success: false,
        error: "Backend unavailable",
      }),
    };

    let fetchCallCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        fetchCallCount += 1;
        if (fetchCallCount === 1) {
          return Promise.resolve(failureResponse);
        }
        return secondCallPromise;
      })
    );

    render(<Dashboard />);

    // Wait for the initial error.
    await waitFor(() => {
      expect(screen.getByTestId("dashboard-error-alert")).toBeInTheDocument();
    });

    // Click Retry — the fetch hangs.
    const retryButton = screen.getByTestId(
      "dashboard-retry-button"
    ) as HTMLButtonElement;
    fireEvent.click(retryButton);

    // While the fetch is in-flight, the button should be disabled and show
    // a "Retrying…" label.
    await waitFor(() => {
      expect(retryButton).toBeDisabled();
      expect(retryButton).toHaveTextContent("Retrying…");
    });

    // Resolve the fetch so the test doesn't leak timers.
    resolveSecondCall({
      json: async () => ({
        success: true,
        data: [],
        page: 1,
        limit: 5,
        total: 0,
      }),
    });
  });

  it("shows Retry button for a 429 rate-limit response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 429, json: async () => ({}) })
    );

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-error-alert")).toBeInTheDocument();
    });
    expect(screen.getByTestId("dashboard-retry-button")).toBeInTheDocument();
  });
});
