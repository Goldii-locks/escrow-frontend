/**
 * CSS micro-animations on the dashboard job list.
 *
 * The animation utilities themselves live in globals.css
 * (`animate-slide-in`, `animate-fade-in`, `animate-shake`); these assertions
 * check the dashboard actually applies them to the list rows, the expanded
 * detail panel, and the error alert.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const JOB = {
  id: "job-1",
  contract_id: "CJOB1",
  title: "Build the thing",
  status: "funded",
  amount: "100",
};

function stubJobsResponse(jobs: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: jobs,
        page: 1,
        limit: 5,
        total: jobs.length,
      }),
    })
  );
}

describe("Dashboard job list micro-animations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({ address: "GCLIENT", signTransaction: vi.fn() });
  });

  it("applies the slide-in animation to each job row", async () => {
    stubJobsResponse([JOB]);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId("dashboard-list-item").length).toBeGreaterThan(0);
    });

    for (const row of screen.getAllByTestId("dashboard-list-item")) {
      expect(row.className).toContain("animate-slide-in");
    }
  });

  it("fades in the expanded detail panel when a row is opened", async () => {
    stubJobsResponse([JOB]);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId("dashboard-list-item").length).toBeGreaterThan(0);
    });

    // A single-job list opens its row on its own, so only click when the row
    // is still collapsed - clicking an open row would close it again.
    const row = screen.getAllByTestId("dashboard-list-item")[0];
    const toggle = row.querySelector("button") as HTMLButtonElement;
    expect(toggle).not.toBeNull();
    if (toggle.getAttribute("aria-expanded") !== "true") {
      fireEvent.click(toggle);
    }

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-expanded-panel")).toBeInTheDocument();
    });
    expect(screen.getByTestId("dashboard-expanded-panel").className).toContain(
      "animate-fade-in"
    );
  });

  it("shakes the error alert when the job fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-error-alert")).toBeInTheDocument();
    });
    expect(screen.getByTestId("dashboard-error-alert").className).toContain(
      "animate-shake"
    );
  });
});
