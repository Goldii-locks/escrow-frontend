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

describe("Dashboard empty milestones transition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({ address: "GCLIENT" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          data: {
            id: "job-1",
            client: "GCLIENT",
            freelancer: "GFREELANCER",
            arbiter: "GARBITER",
            funded: true,
            milestones: [],
          },
        }),
      })
    );
  });

  it("transitions from loading to empty-state milestone view", async () => {
    render(<Dashboard />);

    expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("No milestones available")).toBeInTheDocument();
    });
  });
});
