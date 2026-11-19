/**
 * Tests for issue #895: read job state from the contract when the indexer is
 * behind or the backend's /api/jobs/:id endpoint fails.
 *
 * Covers:
 *  - fetchJobStateFromContract maps the get_escrow_state result to a Job.
 *  - fetchJobStateFromContract returns null on backend error or bad shape.
 *  - isIndexerStale returns the right boolean for each ledger gap.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchJobStateFromContract,
  isIndexerStale,
  STALE_LEDGER_THRESHOLD,
} from "@/app/lib/contract_job_state";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONTRACT_ID = "C" + "A".repeat(55);

/** Builds the full /api/jobs/query success body for get_escrow_state. */
function escrowStateEnvelope(overrides: {
  client?: string;
  freelancer?: string;
  arbiter?: string;
  admin?: string;
  funded?: boolean;
  milestones?: Array<{ index: number; amount: string; status: string }>;
}) {
  return {
    success: true,
    data: {
      contractId: CONTRACT_ID,
      method: "get_escrow_state",
      result: {
        admin: overrides.admin ?? "G" + "A".repeat(55),
        job: {
          client: overrides.client ?? "G" + "B".repeat(55),
          freelancer: overrides.freelancer ?? "G" + "C".repeat(55),
          arbiter: overrides.arbiter ?? "G" + "D".repeat(55),
          funded: overrides.funded ?? true,
          tokenSymbol: "XLM",
          tokenDecimals: 7,
          milestones: overrides.milestones ?? [],
        },
      },
    },
  };
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

// ---------------------------------------------------------------------------
// fetchJobStateFromContract
// ---------------------------------------------------------------------------

describe("fetchJobStateFromContract", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls POST /api/jobs/query with get_escrow_state", async () => {
    const fetchMock = stubFetch(escrowStateEnvelope({}));
    await fetchJobStateFromContract(CONTRACT_ID);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/jobs\/query$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      contractId: CONTRACT_ID,
      method: "get_escrow_state",
    });
  });

  it("maps the result to a Job with correct fields", async () => {
    const milestones = [
      { index: 0, amount: "100", status: "Pending" },
      { index: 1, amount: "200", status: "Delivered" },
    ];
    stubFetch(
      escrowStateEnvelope({
        client: "G" + "B".repeat(55),
        freelancer: "G" + "C".repeat(55),
        arbiter: "G" + "D".repeat(55),
        funded: true,
        milestones,
      })
    );

    const job = await fetchJobStateFromContract(CONTRACT_ID);

    expect(job).not.toBeNull();
    expect(job!.id).toBe(CONTRACT_ID);
    expect(job!.client).toBe("G" + "B".repeat(55));
    expect(job!.freelancer).toBe("G" + "C".repeat(55));
    expect(job!.arbiter).toBe("G" + "D".repeat(55));
    expect(job!.funded).toBe(true);
    expect(job!.milestones).toHaveLength(2);
    expect(job!.milestones![1].status).toBe("Delivered");
    expect(job!.tokenSymbol).toBe("XLM");
  });

  it("sets contractFallback: true on the returned job", async () => {
    stubFetch(escrowStateEnvelope({}));
    const job = await fetchJobStateFromContract(CONTRACT_ID);
    expect((job as Record<string, unknown>)?.contractFallback).toBe(true);
  });

  it("returns null on a non-ok HTTP response", async () => {
    stubFetch({ success: false, error: "not found" }, false);
    expect(await fetchJobStateFromContract(CONTRACT_ID)).toBeNull();
  });

  it("returns null when the response does not match EscrowStateResponseSchema", async () => {
    stubFetch({ success: true, data: { result: "wrong shape" } });
    expect(await fetchJobStateFromContract(CONTRACT_ID)).toBeNull();
  });

  it("returns null on a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    expect(await fetchJobStateFromContract(CONTRACT_ID)).toBeNull();
  });

  it("re-throws AbortError so callers can detect intentional cancellation", async () => {
    const abortError = Object.assign(new Error("Aborted"), { name: "AbortError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    await expect(fetchJobStateFromContract(CONTRACT_ID)).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});

// ---------------------------------------------------------------------------
// isIndexerStale
// ---------------------------------------------------------------------------

describe("isIndexerStale", () => {
  it("returns false when either ledger value is undefined", () => {
    expect(isIndexerStale(undefined, 1000)).toBe(false);
    expect(isIndexerStale(900, undefined)).toBe(false);
    expect(isIndexerStale(undefined, undefined)).toBe(false);
  });

  it("returns false when the gap is exactly at the threshold", () => {
    expect(isIndexerStale(1000 - STALE_LEDGER_THRESHOLD, 1000)).toBe(false);
  });

  it("returns true when the gap exceeds the threshold by one", () => {
    expect(isIndexerStale(1000 - STALE_LEDGER_THRESHOLD - 1, 1000)).toBe(true);
  });

  it("returns true for a large gap", () => {
    expect(isIndexerStale(500, 1000)).toBe(true);
  });

  it("returns false when currentLedger is ahead by less than the threshold", () => {
    expect(isIndexerStale(999, 1000)).toBe(false);
  });
});
