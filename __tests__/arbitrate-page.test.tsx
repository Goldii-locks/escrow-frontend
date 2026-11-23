import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ArbitratePage from "@/app/arbitrate/page";

const mockUseWallet = vi.hoisted(() => vi.fn());

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock("@/app/components/Navbar", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

const ARBITER = "GARBITER";
const HOUR = 60 * 60 * 1000;

function disputeJob(id: string, deadlineOffsetMs: number) {
  return {
    id,
    client: "GCLIENT",
    freelancer: "GFREELANCER",
    arbiter: ARBITER,
    milestones: [
      {
        index: 0,
        amount: "10000000",
        status: "Disputed",
        escalationDeadline: Date.now() + deadlineOffsetMs,
      },
    ],
  };
}

function stubFetch(payload: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => payload,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseWallet.mockReturnValue({ address: ARBITER });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Arbitrate page (#881)", () => {
  it("shows disputes from three jobs on one page sorted by escalation deadline", async () => {
    const fetchMock = stubFetch({
      success: true,
      data: [
        disputeJob("job-late", 48 * HOUR),
        disputeJob("job-soon", 2 * HOUR),
        disputeJob("job-overdue", -HOUR),
      ],
    });

    render(<ArbitratePage />);

    await waitFor(() => {
      expect(screen.getAllByTestId("arbiter-queue-item")).toHaveLength(3);
    });

    const items = screen.getAllByTestId("arbiter-queue-item");
    expect(items.map((item) => item.getAttribute("data-job-id"))).toEqual([
      "job-overdue",
      "job-soon",
      "job-late",
    ]);

    // The queue must ask the backend for the arbiter role specifically.
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain(`/api/jobs/by-wallet/${ARBITER}`);
    expect(url).toContain("role=arbiter");
  });

  it("shows the empty state when the arbiter has no disputes", async () => {
    stubFetch({
      success: true,
      data: [
        {
          id: "job-calm",
          client: "GCLIENT",
          freelancer: "GFREELANCER",
          arbiter: ARBITER,
          milestones: [{ index: 0, amount: "1", status: "Pending" }],
        },
      ],
    });

    render(<ArbitratePage />);

    await waitFor(() => {
      expect(screen.getByTestId("arbiter-queue-empty")).toBeInTheDocument();
    });
    expect(screen.getByTestId("empty-state-title")).toHaveTextContent(
      /no disputes need your decision/i,
    );
  });

  it("shows the empty state when the arbiter has no jobs at all", async () => {
    stubFetch({ success: true, data: [] });

    render(<ArbitratePage />);

    await waitFor(() => {
      expect(screen.getByTestId("arbiter-queue-empty")).toBeInTheDocument();
    });
  });

  it("asks the user to connect when no wallet is connected", () => {
    mockUseWallet.mockReturnValue({ address: null });
    const fetchMock = stubFetch({ success: true, data: [] });

    render(<ArbitratePage />);

    expect(screen.getByTestId("arbiter-queue-connect")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a fetch error with a retry action", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    render(<ArbitratePage />);

    await waitFor(() => {
      expect(screen.getByTestId("arbiter-queue-error")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});