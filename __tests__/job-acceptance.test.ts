import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACCEPTANCE_SCAN_LIMIT,
  acceptanceBlockedMessage,
  acceptanceFromEvents,
  fetchJobAcceptance,
  isJobAccepted,
  mergeAcceptance,
} from "@/app/lib/job_acceptance";

const CONTRACT_ID = "C" + "A".repeat(55);

function historyEnvelope(events: unknown[], overrides: Record<string, unknown> = {}) {
  return { success: true, events, total: events.length, page: 1, limit: 100, ...overrides };
}

function stubFetch(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("acceptanceFromEvents (#802)", () => {
  it("treats an empty history as not accepted", () => {
    expect(acceptanceFromEvents([])).toEqual({
      freelancerAccepted: false,
      arbiterAccepted: false,
    });
  });

  it("maps the acceptjob and acceptarb topics", () => {
    expect(acceptanceFromEvents([{ event_type: "acceptjob" }])).toEqual({
      freelancerAccepted: true,
      arbiterAccepted: false,
    });
    expect(acceptanceFromEvents([{ event_type: "acceptarb" }])).toEqual({
      freelancerAccepted: false,
      arbiterAccepted: true,
    });
    expect(
      acceptanceFromEvents([{ event_type: "acceptjob" }, { event_type: "acceptarb" }])
    ).toEqual({ freelancerAccepted: true, arbiterAccepted: true });
  });

  it("reads the cumulative mask from the event payload", () => {
    const accepted = acceptanceFromEvents([
      { event_type: "other", data_json: JSON.stringify({ acceptance_mask: 3 }) },
    ]);
    expect(accepted).toEqual({ freelancerAccepted: true, arbiterAccepted: true });
  });

  it("accepts the camelCase mask older rows may carry", () => {
    const accepted = acceptanceFromEvents([
      { event_type: "other", data_json: JSON.stringify({ acceptanceMask: 2 }) },
    ]);
    expect(accepted).toEqual({ freelancerAccepted: false, arbiterAccepted: true });
  });

  it("ignores malformed payloads and unknown event types", () => {
    expect(
      acceptanceFromEvents([
        { event_type: "deliver", data_json: "{not json" },
        { event_type: "fund", data_json: JSON.stringify({ acceptance_mask: "3" }) },
      ])
    ).toEqual({ freelancerAccepted: false, arbiterAccepted: false });
  });
});

describe("mergeAcceptance (#802)", () => {
  it("keeps the bits already read, because acceptance never reverses", () => {
    expect(
      mergeAcceptance(
        { freelancerAccepted: true, arbiterAccepted: false },
        { freelancerAccepted: false, arbiterAccepted: false }
      )
    ).toEqual({ freelancerAccepted: true, arbiterAccepted: false });
  });

  it("adds newly read bits", () => {
    expect(
      mergeAcceptance(
        { freelancerAccepted: true, arbiterAccepted: false },
        { freelancerAccepted: true, arbiterAccepted: true }
      )
    ).toEqual({ freelancerAccepted: true, arbiterAccepted: true });
  });

  it("keeps whichever side is known when the other is unreadable", () => {
    const known = { freelancerAccepted: true, arbiterAccepted: false };
    expect(mergeAcceptance(null, known)).toEqual(known);
    expect(mergeAcceptance(known, null)).toEqual(known);
  });
});

describe("isJobAccepted / acceptanceBlockedMessage (#802)", () => {
  it("requires both parties", () => {
    expect(isJobAccepted(null)).toBe(false);
    expect(isJobAccepted({ freelancerAccepted: true, arbiterAccepted: false })).toBe(false);
    expect(isJobAccepted({ freelancerAccepted: true, arbiterAccepted: true })).toBe(true);
  });

  it("explains which acceptance is missing", () => {
    expect(acceptanceBlockedMessage(null)).toBeNull();
    expect(
      acceptanceBlockedMessage({ freelancerAccepted: true, arbiterAccepted: true })
    ).toBeNull();
    expect(acceptanceBlockedMessage({ freelancerAccepted: false, arbiterAccepted: false })).toBe(
      "Waiting for the freelancer and the arbiter to accept"
    );
    expect(acceptanceBlockedMessage({ freelancerAccepted: true, arbiterAccepted: false })).toBe(
      "Waiting for the arbiter to accept"
    );
    expect(acceptanceBlockedMessage({ freelancerAccepted: false, arbiterAccepted: true })).toBe(
      "Waiting for the freelancer to accept"
    );
  });
});

describe("fetchJobAcceptance (#802)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads the oldest page of the job history", async () => {
    const fetchMock = stubFetch(historyEnvelope([{ event_type: "fund" }]));

    await fetchJobAcceptance(CONTRACT_ID);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain(`/api/jobs/${CONTRACT_ID}/history?page=1&limit=${ACCEPTANCE_SCAN_LIMIT}`);
  });

  it("maps acceptance events from the response", async () => {
    stubFetch(historyEnvelope([{ event_type: "acceptjob" }, { event_type: "acceptarb" }]));

    expect(await fetchJobAcceptance(CONTRACT_ID)).toEqual({
      freelancerAccepted: true,
      arbiterAccepted: true,
    });
  });

  it("returns null on a non-ok response", async () => {
    stubFetch({ success: false }, false);
    expect(await fetchJobAcceptance(CONTRACT_ID)).toBeNull();
  });

  it("returns null on an unexpected shape", async () => {
    stubFetch({ success: true, noEvents: [] });
    expect(await fetchJobAcceptance(CONTRACT_ID)).toBeNull();
  });

  it("returns null on a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    expect(await fetchJobAcceptance(CONTRACT_ID)).toBeNull();
  });

  it("re-throws AbortError so callers can detect cancellation", async () => {
    const abortError = Object.assign(new Error("Aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    await expect(fetchJobAcceptance(CONTRACT_ID)).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
