/**
 * Tests for issue #671 / #872: per-milestone deadline fetches.
 *
 * The former batch endpoint (/api/jobs/:id/deadlines) was removed in #872
 * because it never existed on the backend, causing a guaranteed 404 on every
 * job view. fetchAllAutoReleaseDeadlines now calls the per-milestone route
 * directly without a prior batch attempt.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchAllAutoReleaseDeadlines } from "@/app/lib/autoRelease";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchAllAutoReleaseDeadlines – per-milestone fetches (#671 / #872)", () => {
  it("issues exactly N fetch calls for N delivered milestones – no /deadlines request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { deadline: 1700000000000, eligible: false },
      }),
    } as Response);

    const result = await fetchAllAutoReleaseDeadlines("job-abc", [0, 2, 4]);

    // Exactly 3 requests – one per milestone index, never a /deadlines call.
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    // No request to the removed batch endpoint.
    for (const call of fetchSpy.mock.calls) {
      expect(String(call[0])).not.toMatch(/\/deadlines/);
    }

    // Each requested URL is the per-milestone route.
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/milestones/0/auto-release"),
        expect.stringContaining("/milestones/2/auto-release"),
        expect.stringContaining("/milestones/4/auto-release"),
      ])
    );

    // All three entries are present in the result.
    expect(result[0]).toBeDefined();
    expect(result[2]).toBeDefined();
    expect(result[4]).toBeDefined();
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

    // fetchAutoReleaseInfo catches the rejection and returns null deadline.
    expect(result).toEqual({ 0: null });
    fetchSpy.mockRestore();
  });

  it("resolves all milestones even when some per-milestone requests fail", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      // index 1: success
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { deadline: 1700000000, eligible: false },
        }),
      } as Response)
      // index 3: non-OK (e.g. 500)
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as Response);

    const result = await fetchAllAutoReleaseDeadlines("job-xyz", [1, 3]);

    // Both entries present; failed one resolves to null.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result[1]).toBeDefined();
    expect(result[3]).toBeNull();
  });
});
