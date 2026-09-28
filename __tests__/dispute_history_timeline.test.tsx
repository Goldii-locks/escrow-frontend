import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DisputeHistoryTimeline from "@/app/components/DisputeHistoryTimeline";
import {
  MOCK_DISPUTE_HISTORY,
  fetchDisputeHistory,
  isTimelineViewerAuthorized,
  sanitizeTimelineInput,
} from "@/app/lib/dispute_history_timeline";

const WALLET = "GCKF7J3CLIENT";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isTimelineViewerAuthorized (#440)", () => {
  it("rejects missing or blank wallets", () => {
    expect(isTimelineViewerAuthorized(null)).toBe(false);
    expect(isTimelineViewerAuthorized("   ")).toBe(false);
  });

  it("checks the whitelist case-insensitively", () => {
    expect(isTimelineViewerAuthorized("gabc", ["GABC"])).toBe(true);
    expect(isTimelineViewerAuthorized("GXYZ", ["GABC"])).toBe(false);
  });
});

describe("sanitizeTimelineInput (#442)", () => {
  it("strips script and code tags with their contents", () => {
    expect(sanitizeTimelineInput("<script>alert(1)</script>")).toBe("");
    expect(sanitizeTimelineInput("hi <code>rm -rf</code>there")).toBe("hi there");
    expect(sanitizeTimelineInput("<b>bold</b>")).toBe("bold");
  });
});

describe("fetchDisputeHistory (#443)", () => {
  it("returns backend data when the query succeeds", async () => {
    const data = [{ ...MOCK_DISPUTE_HISTORY[0], id: "backend-1" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    expect(await fetchDisputeHistory("disp-101")).toEqual(data);
  });

  it("falls back to the mock dataset on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await fetchDisputeHistory("disp-101")).toEqual(MOCK_DISPUTE_HISTORY);
  });
});

describe("DisputeHistoryTimeline", () => {
  it("shows the fallback warning for unauthorized wallets (#440)", () => {
    render(
      <DisputeHistoryTimeline
        disputeId="disp-101"
        currentWalletAddress="GSTRANGER"
        authorizedWallets={[WALLET]}
        initialEvents={MOCK_DISPUTE_HISTORY}
      />,
    );
    expect(screen.getByTestId("dispute-timeline-unauthorized-warning")).toBeInTheDocument();
    expect(screen.queryByTestId("dispute-history-timeline")).not.toBeInTheDocument();
  });

  it("shows placeholder frames while the query runs (#441)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<DisputeHistoryTimeline disputeId="disp-101" currentWalletAddress={WALLET} />);
    expect(screen.getByTestId("dispute-timeline-loading-skeletons")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getAllByLabelText("Timeline event placeholder")).toHaveLength(3);
  });

  it("ignores form input made of code tags (#442)", () => {
    render(
      <DisputeHistoryTimeline
        disputeId="disp-101"
        currentWalletAddress={WALLET}
        initialEvents={[]}
      />,
    );
    fireEvent.change(screen.getByLabelText(/add note/i), {
      target: { value: "<script>alert(1)</script>" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    expect(screen.getByText(/no history recorded/i)).toBeInTheDocument();
  });

  it("adds sanitized notes to the timeline (#442)", () => {
    render(
      <DisputeHistoryTimeline
        disputeId="disp-101"
        currentWalletAddress={WALLET}
        initialEvents={[]}
      />,
    );
    fireEvent.change(screen.getByLabelText(/add note/i), {
      target: { value: "hello <code>evil()</code>" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.queryByText(/evil/)).not.toBeInTheDocument();
  });

  it("loads events from the backend mock dataset (#443)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    render(<DisputeHistoryTimeline disputeId="disp-101" currentWalletAddress={WALLET} />);
    await waitFor(() => expect(screen.getByText("Dispute raised")).toBeInTheDocument());
    expect(screen.getByText("Arbiter assigned")).toBeInTheDocument();
  });
});

// Ported from #533 (issues #448, #449), adapted to this component's props.
describe("DisputeHistoryTimeline grid layout and mock data (#448, #449)", () => {
  const renderWith = (events = MOCK_DISPUTE_HISTORY) =>
    render(
      <DisputeHistoryTimeline
        disputeId="disp-101"
        currentWalletAddress={WALLET}
        initialEvents={events}
      />,
    );

  it("lays events out in a responsive grid", () => {
    renderWith();
    const grid = screen.getByTestId("dispute-timeline-grid");
    expect(grid).toHaveClass("grid", "grid-cols-1", "lg:grid-cols-2", "xl:grid-cols-3");
    expect(grid).toHaveClass("gap-4", "lg:gap-6");
    expect(grid.children).toHaveLength(MOCK_DISPUTE_HISTORY.length);
    for (const card of Array.from(grid.children)) {
      expect(card).toHaveClass("min-w-0", "p-4");
    }
  });

  it("renders every mock event title as a heading with its description", () => {
    renderWith();
    for (const event of MOCK_DISPUTE_HISTORY) {
      expect(screen.getByText(event.title).closest("h4")).toBeTruthy();
      expect(screen.getByText(event.description)).toBeInTheDocument();
    }
  });

  it("summarises the event count with singular and plural wording", () => {
    const { unmount } = renderWith();
    expect(screen.getByTestId("dispute-timeline-summary")).toHaveTextContent(
      `Showing ${MOCK_DISPUTE_HISTORY.length} events`,
    );
    unmount();
    renderWith([MOCK_DISPUTE_HISTORY[0]]);
    expect(screen.getByTestId("dispute-timeline-summary")).toHaveTextContent(
      /Showing 1 event(?!s)/,
    );
  });

  it("shows the empty state without a grid when there are no events", () => {
    renderWith([]);
    expect(screen.getByTestId("dispute-timeline-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("dispute-timeline-grid")).not.toBeInTheDocument();
  });

  it("shows skeletons instead of events while an external load is in progress", () => {
    render(
      <DisputeHistoryTimeline
        disputeId="disp-101"
        currentWalletAddress={WALLET}
        initialEvents={MOCK_DISPUTE_HISTORY}
        isLoading
      />,
    );
    expect(screen.getByTestId("dispute-timeline-loading-skeletons")).toBeInTheDocument();
    expect(screen.queryByText(MOCK_DISPUTE_HISTORY[0].title)).not.toBeInTheDocument();
  });
});
