import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import JobActivityTimeline from "@/app/components/JobActivityTimeline";

const CLIENT = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

function event(id: number, type: string) {
  return {
    id,
    event_type: type,
    ledger_sequence: id * 100,
    timestamp: Math.floor(Date.now() / 1000) - 3600,
    data_json: JSON.stringify({ client: CLIENT }),
  };
}

function respond(events: ReturnType<typeof event>[], total: number) {
  return { ok: true, json: async () => ({ success: true, events, total, page: 1, limit: 10 }) };
}

describe("JobActivityTimeline", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders events newest first with label, relative time and short actor", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(respond([event(1, "initialized"), event(2, "funded")], 2));
    vi.stubGlobal("fetch", fetchMock);

    render(<JobActivityTimeline contractId="CJOB" />);

    const items = await screen.findAllByTestId("job-activity-event");
    expect(items[0]).toHaveTextContent("Escrow funded");
    expect(items[1]).toHaveTextContent("Job created");
    expect(items[0]).toHaveTextContent("1 hour ago");
    expect(items[0]).toHaveTextContent("by GBRP…OX2H");
    expect(fetchMock.mock.calls[0][0]).toContain("/api/jobs/CJOB/history?page=1&limit=10");
  });

  it("starts on the newest backend page and pages to older events", async () => {
    const oldest = Array.from({ length: 10 }, (_, i) => event(i + 1, "delivered"));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(oldest, 12))
      .mockResolvedValueOnce(respond([event(11, "approved"), event(12, "released")], 12))
      .mockResolvedValueOnce(respond(oldest, 12));
    vi.stubGlobal("fetch", fetchMock);

    render(<JobActivityTimeline contractId="CJOB" />);

    const newest = await screen.findAllByTestId("job-activity-event");
    expect(newest).toHaveLength(2);
    expect(newest[0]).toHaveTextContent("Funds released");
    expect(fetchMock.mock.calls[1][0]).toContain("page=2");
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Older" }));

    await waitFor(() => expect(screen.getByText("Page 2 of 2")).toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByTestId("job-activity-event")).toHaveLength(10));
    expect(fetchMock.mock.calls[2][0]).toContain("page=1");
  });

  it("refetches when refreshKey changes and shows the new event first", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond([event(1, "initialized"), event(2, "funded")], 2))
      .mockResolvedValueOnce(
        respond([event(1, "initialized"), event(2, "funded"), event(3, "delivered")], 3)
      );
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<JobActivityTimeline contractId="CJOB" refreshKey={100} />);
    const before = await screen.findAllByTestId("job-activity-event");
    expect(before[0]).toHaveTextContent("Escrow funded");

    rerender(<JobActivityTimeline contractId="CJOB" refreshKey={200} />);

    await waitFor(() => expect(screen.getAllByTestId("job-activity-event")).toHaveLength(3));
    expect(screen.getAllByTestId("job-activity-event")[0]).toHaveTextContent("Milestone delivered");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not refetch when refreshKey is unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond([event(1, "initialized")], 1));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<JobActivityTimeline contractId="CJOB" refreshKey={100} />);
    await screen.findAllByTestId("job-activity-event");
    rerender(<JobActivityTimeline contractId="CJOB" refreshKey={100} />);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("re-reads the total so legacy paging stays consistent after new events", async () => {
    const page1 = Array.from({ length: 10 }, (_, i) => event(i + 1, "delivered"));
    const page2 = [event(11, "approved"), event(12, "released")];
    const fetchMock = vi
      .fn()
      // Initial load: total 12 → newest is backend page 2.
      .mockResolvedValueOnce(respond(page1, 12))
      .mockResolvedValueOnce(respond(page2, 12))
      // Refresh: guess page 2 from the old total, but the total is now 21 →
      // the newest events moved to backend page 3.
      .mockResolvedValueOnce(respond(page2, 21))
      .mockResolvedValueOnce(respond([event(21, "refunded")], 21));
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<JobActivityTimeline contractId="CJOB" refreshKey={1} />);
    await waitFor(() => expect(screen.getByText("Page 1 of 2")).toBeInTheDocument());

    rerender(<JobActivityTimeline contractId="CJOB" refreshKey={2} />);

    await waitFor(() => expect(screen.getByText("Page 1 of 3")).toBeInTheDocument());
    const items = screen.getAllByTestId("job-activity-event");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Refunded");
    expect(fetchMock.mock.calls[2][0]).toContain("page=2");
    expect(fetchMock.mock.calls[3][0]).toContain("page=3");
  });

  it("uses one request per page when the backend honours order=desc", async () => {
    const newest = Array.from({ length: 10 }, (_, i) => event(12 - i, "delivered"));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, events: newest, total: 12, order: "desc" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          events: [event(2, "funded"), event(1, "initialized")],
          total: 12,
          order: "desc",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<JobActivityTimeline contractId="CJOB" />);

    await waitFor(() => expect(screen.getByText("Page 1 of 2")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("page=1&limit=10&order=desc");

    fireEvent.click(screen.getByRole("button", { name: "Older" }));

    await waitFor(() => expect(screen.getByText("Page 2 of 2")).toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByTestId("job-activity-event")).toHaveLength(2));
    const items = screen.getAllByTestId("job-activity-event");
    expect(items[0]).toHaveTextContent("Escrow funded");
    expect(items[1]).toHaveTextContent("Job created");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("page=2");
  });

  it("shows an error when the history request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ success: false }) })
    );

    render(<JobActivityTimeline contractId="CJOB" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load activity.");
  });
});
