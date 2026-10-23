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

  it("shows an error when the history request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ success: false }) })
    );

    render(<JobActivityTimeline contractId="CJOB" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load activity.");
  });
});
