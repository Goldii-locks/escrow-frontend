// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/app/(app)/dashboard/page";
import NeedsActionPanel from "@/app/components/NeedsActionPanel";

const mockUseWallet = vi.fn();

vi.mock("@/app/context/WalletContext", () => ({
  useWallet: () => mockUseWallet(),
}));

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn(), toasts: [], hideToast: vi.fn() }),
}));

vi.mock("@/app/components/Navbar", () => ({ default: () => <div data-testid="navbar" /> }));
vi.mock("@/app/components/MilestoneCard", () => ({
  default: ({ milestone }: { milestone: { index: number } | null }) => (
    <div data-testid="milestone-card">{milestone ? `card-${milestone.index}` : "empty"}</div>
  ),
}));

vi.mock("@/app/hooks/useActionStates", () => ({
  useActionStates: () => ({
    getState: () => ({ phase: "idle", error: null, txHash: null }),
    isPending: () => false,
    setPhase: vi.fn(),
    setError: vi.fn(),
    setTxHash: vi.fn(),
  }),
}));

const CLIENT = "GCLIENTADDRESS1234567890123456789012345678901234";
const FREELANCER = "GFREELANCERADDRESS12345678901234567890123456";
const ARBITER = "GARBITERADDRESS12345678901234567890123456789012";
const JOB_A = "C" + "A".repeat(55);
const JOB_B = "C" + "B".repeat(55);

const jobA = {
  id: JOB_A,
  client: CLIENT,
  freelancer: FREELANCER,
  arbiter: ARBITER,
  funded: true,
  milestones: [{ index: 0, amount: "100", status: "Pending" }],
};
const jobB = {
  id: JOB_B,
  client: CLIENT,
  freelancer: FREELANCER,
  arbiter: ARBITER,
  funded: true,
  milestones: [
    { index: 0, amount: "100", status: "Released" },
    { index: 1, amount: "100", status: "Delivered" },
  ],
};

function json(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

function stubBackend() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/by-wallet/")) {
      return json({ success: true, data: [jobA, jobB], page: 1, limit: 5, total: 2 });
    }
    if (url.includes("/deadlines")) {
      return json({
        success: true,
        data: { deadlines: { "1": Date.now() + 2 * 24 * 3_600_000 } },
      });
    }
    if (url.includes("/history")) return json({ success: true, events: [], total: 0 });
    const detail = /\/api\/jobs\/([^/?]+)$/.exec(url);
    if (detail) {
      const id = decodeURIComponent(detail[1]);
      return json({ success: true, data: [jobA, jobB].find((j) => j.id === id) });
    }
    return json({ success: true });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("NeedsActionPanel (#888)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBackend();
  });

  it("lists the wallet's pending actions with their deadline", async () => {
    render(<NeedsActionPanel address={CLIENT} onSelect={vi.fn()} />);

    const items = await screen.findAllByTestId("needs-action-item");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Review delivery");
    expect(items[0]).toHaveTextContent("as client");
    expect(items[0]).toHaveTextContent("CBBB…BBBB, milestone 2");
    expect(within(items[0]).getByTestId("needs-action-deadline")).toHaveTextContent(
      /Auto-releases in 2 days/
    );
  });

  it("calls onSelect with the row's job and milestone", async () => {
    const onSelect = vi.fn();
    render(<NeedsActionPanel address={CLIENT} onSelect={onSelect} />);

    fireEvent.click(await screen.findByRole("button", { name: /Open review delivery/ }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: JOB_B }), 1);
  });

  it("says when nothing needs action", async () => {
    render(<NeedsActionPanel address={ARBITER} onSelect={vi.fn()} />);

    expect(await screen.findByTestId("needs-action-empty")).toHaveTextContent(
      "Nothing needs your action right now."
    );
  });
});

describe("Dashboard 'Needs your action' rows (#888)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWallet.mockReturnValue({
      address: CLIENT,
      signTransaction: vi.fn(),
      registerPendingAction: vi.fn(),
    });
    stubBackend();
  });

  it("opens the right job and milestone when a row is clicked", async () => {
    render(<Dashboard />);

    // The first job starts expanded.
    const rowA = await screen.findByRole("button", { name: /Job #CAAAAAAA/ });
    await waitFor(() => expect(rowA).toHaveAttribute("aria-expanded", "true"));

    const panel = await screen.findByTestId("needs-action-panel");
    fireEvent.click(await within(panel).findByRole("button", { name: /Open review delivery/ }));

    const rowB = screen.getByRole("button", { name: /Job #CBBBBBBB/ });
    await waitFor(() => expect(rowB).toHaveAttribute("aria-expanded", "true"));
    expect(screen.getByRole("button", { name: /Job #CAAAAAAA/ })).toHaveAttribute(
      "aria-expanded",
      "false"
    );

    const target = await waitFor(() => {
      const el = document.getElementById(`milestone-${JOB_B}-1`);
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(target).toHaveAttribute("data-focused", "true");
    expect(target).toHaveTextContent("card-1");
    await waitFor(() => expect(document.activeElement).toBe(target));
  });
});
