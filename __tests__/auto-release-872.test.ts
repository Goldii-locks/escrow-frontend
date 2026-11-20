/**
 * Tests for issue #872: remove /deadlines route from fetchAllAutoReleaseDeadlines.
 *
 * Before this fix, every call first attempted GET /api/jobs/:id/deadlines
 * (which does not exist on the backend), received a 404, and that 404 counted
 * against nginx's public read rate limit (60/min). The batch endpoint has been
 * removed; the function now calls /milestones/:i/auto-release directly.
 *
 * Explicit request-count contract (stated here as required by the issue):
 *   - 0 delivered milestones  → 0 requests
 *   - N delivered milestones  → exactly N requests (one per milestone)
 *   For a job with 3 delivered milestones that is 3 requests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchAllAutoReleaseDeadlines } from "@/app/lib/autoRelease";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A well-formed per-milestone success response. */
function okMilestoneResponse(deadlineEpochSeconds: number): Response {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: { deadline: deadlineEpochSeconds, eligible: false },
    }),
  } as Response;
}

/** A non-OK response (simulates a 404, 500, etc.). */
function errorResponse(status = 404): Response {
  return { ok: false, status, json: async () => ({}) } as Response;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("Issue #872 – /deadlines endpoint removed", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. No request to /deadlines is ever made
  // -------------------------------------------------------------------------
  it("never requests a URL containing /deadlines", async () => {
    vi.mocked(fetch).mockResolvedValue(okMilestoneResponse(1700000000));

    await fetchAllAutoReleaseDeadlines("job-1", [0, 1, 2]);

    // /deadlines was never the first argument of any call.
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/deadlines"),
      expect.anything()
    );
  });

  // -------------------------------------------------------------------------
  // 2. Exact request count for 3 delivered milestones = 3
  // -------------------------------------------------------------------------
  it("makes exactly 3 requests for a job with 3 delivered milestones", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okMilestoneResponse(1700000001))
      .mockResolvedValueOnce(okMilestoneResponse(1700000002))
      .mockResolvedValueOnce(okMilestoneResponse(1700000003));

    const result = await fetchAllAutoReleaseDeadlines("job-2", [0, 1, 2]);

    // Exactly 3 requests – one per milestone index.
    expect(fetch).toHaveBeenCalledTimes(3);

    // Each call targets the correct per-milestone URL.
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/milestones/0/auto-release"),
      expect.anything()
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/milestones/1/auto-release"),
      expect.anything()
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/milestones/2/auto-release"),
      expect.anything()
    );

    // Deadlines are populated (10-digit epoch seconds → converted to ms).
    expect(result[0]).toBe(1700000001 * 1000);
    expect(result[1]).toBe(1700000002 * 1000);
    expect(result[2]).toBe(1700000003 * 1000);
  });

  // -------------------------------------------------------------------------
  // 3. Per-milestone request failure → deadlineMs null, other milestones ok
  // -------------------------------------------------------------------------
  it("sets deadlineMs to null for a failed per-milestone request and keeps successful ones", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okMilestoneResponse(1700000010))
      .mockResolvedValueOnce(errorResponse(404))
      .mockResolvedValueOnce(okMilestoneResponse(1700000030));

    const result = await fetchAllAutoReleaseDeadlines("job-3", [0, 1, 2]);

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(result[0]).toBe(1700000010 * 1000);
    expect(result[2]).toBe(1700000030 * 1000);
    // Failed milestone resolves to null, not an exception.
    expect(result[1]).toBeNull();
  });

  it("sets deadlineMs to null when a per-milestone request throws (network error)", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okMilestoneResponse(1700000010))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(okMilestoneResponse(1700000030));

    const result = await fetchAllAutoReleaseDeadlines("job-4", [0, 1, 2]);

    expect(result[0]).toBe(1700000010 * 1000);
    expect(result[1]).toBeNull();
    expect(result[2]).toBe(1700000030 * 1000);
  });

  // -------------------------------------------------------------------------
  // 4. Zero requests for a job with no delivered milestones
  // -------------------------------------------------------------------------
  it("makes zero requests when milestoneIndexes is empty", async () => {
    const result = await fetchAllAutoReleaseDeadlines("job-5", []);

    expect(fetch).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });
});
