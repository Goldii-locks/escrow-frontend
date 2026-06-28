import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const CONTRACT = "CBBRYWY6ROXCM6AHP4COM3AL6UDPTY66FXF43Q7PNEIPU53RZOGHBYP3";

describe("Dashboard real-time contract state (#2)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({ address: "GCLIENT", signTransaction: vi.fn() });
    fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          id: "job-1",
          client: "GCLIENT",
          freelancer: "GFREELANCER",
          arbiter: "GARBITER",
          funded: true,
          milestones: [{ index: 0, amount: "100", status: "Delivered" }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fetches job state by contract id on load and renders the milestone status", async () => {
    render(<Dashboard />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain(`/api/jobs/${CONTRACT}`);
    expect(screen.getByText("Delivered")).toBeInTheDocument();
  });

  it("auto-refreshes the job state every 30 seconds", async () => {
    render(<Dashboard />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("renders a Stellar Expert transaction-history link for the contract", async () => {
    render(<Dashboard />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const link = screen.getByRole("link", { name: /Stellar Expert/i });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining(`/contract/${CONTRACT}`)
    );
  });

  it("shows an error state when the contract fetch fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    render(<Dashboard />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByRole("alert")).toHaveTextContent("network down");
  });
});
