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
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { deadline: 1700000000000, eligible: false },
      }),
    } as Response);

    const result = await fetchAllAutoReleaseDeadlines("job-abc", [0, 2, 4]);

    // Exactly 3 requests – one per milestone index.
    expect(fetch).toHaveBeenCalledTimes(3);

    // No request to the removed batch endpoint.
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/deadlines"),
      expect.anything()
    );

    // Each call targets the correct per-milestone URL.
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/milestones/0/auto-release"),
      expect.anything()
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/milestones/2/auto-release"),
      expect.anything()
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/milestones/4/auto-release"),
      expect.anything()
    );

    expect(result[0]).toBeDefined();
    expect(result[2]).toBeDefined();
    expect(result[4]).toBeDefined();
  });

  it("returns empty object when no milestone indexes supplied", async () => {
    vi.spyOn(globalThis, "fetch");
    const result = await fetchAllAutoReleaseDeadlines("job-abc", []);

    expect(fetch).not.toHaveBeenCalled();
    expect(result).toEqual({});
  });

  it("returns null deadline when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new DOMException("Aborted", "AbortError")
    );

    const result = await fetchAllAutoReleaseDeadlines("job-abc", [0], {
      signal: controller.signal,
    });

    // fetchAutoReleaseInfo catches the rejection and returns null deadline.
    expect(result).toEqual({ 0: null });
  });

  it("resolves all milestones even when some per-milestone requests fail", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { deadline: 1700000000, eligible: false },
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as Response);

    const result = await fetchAllAutoReleaseDeadlines("job-xyz", [1, 3]);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result[1]).toBeDefined();
    expect(result[3]).toBeNull();
  });
});
