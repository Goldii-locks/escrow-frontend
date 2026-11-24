/**
 * Tests for issue #671: batch all milestone deadlines in one call
 *
 * Acceptance criteria: expanding a job with N delivered milestones issues
 * at most one deadline request (when the batch endpoint is available).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchAllAutoReleaseDeadlines } from "@/app/lib/autoRelease";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Issue #671 – batch deadline fetches", () => {
  it("issues exactly ONE fetch for N delivered milestones via batch endpoint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          deadlines: {
            "0": 1700000000000,
            "2": 1700000001000,
            "4": null,
          },
        },
      }),
    } as Response);

    const result = await fetchAllAutoReleaseDeadlines("job-abc", [0, 2, 4]);

    // Only ONE network request was made, not three.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/jobs/job-abc/deadlines"),
      expect.anything()
    );

    // All three entries are present in the result.
    expect(result[0]).toBe(1700000000000);
    expect(result[2]).toBe(1700000001000);
    expect(result[4]).toBeNull();
  });

  it("falls back to individual requests when batch endpoint returns non-OK", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      // First call: batch endpoint returns 404
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) } as Response)
      // Subsequent per-milestone fallback calls
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { deadline: 1700000000, eligible: false },
        }),
      } as Response);

    const result = await fetchAllAutoReleaseDeadlines("job-xyz", [1, 3]);

    // 1 batch attempt + 2 individual fallback calls = 3 total
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result[1]).toBeDefined();
    expect(result[3]).toBeDefined();
  });

  it("returns empty object when no milestone indexes supplied", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await fetchAllAutoReleaseDeadlines("job-abc", []);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it("returns empty object when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));

    const result = await fetchAllAutoReleaseDeadlines("job-abc", [0], {
      signal: controller.signal,
    });

    // fetch was called (or not depending on timing), but result is empty
    expect(result).toEqual({});
    fetchSpy.mockRestore();
  });
});
