import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchEscrowFunded } from "@/app/lib/admin";

/**
 * fetchEscrowFunded reads the backend job route. The read-only /query route
 * does not allow get_job, so using it would always leave the funded state
 * unknown and the whitelist lock off (#659).
 */

function stubFetch(body: unknown, ok = true) {
  const fn = vi.fn().mockResolvedValue({ ok, json: async () => body });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchEscrowFunded", () => {
  it("GETs the job route for the contract, not the read-only query route", async () => {
    const fetchMock = stubFetch({ success: true, data: { funded: true } });
    await fetchEscrowFunded("CABC");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/jobs\/CABC$/);
    expect(init?.method ?? "GET").toBe("GET");
  });

  it.each([true, false])("returns data.funded = %s", async (funded) => {
    stubFetch({ success: true, data: { id: "CABC", funded, milestones: [] } });
    await expect(fetchEscrowFunded("CABC")).resolves.toBe(funded);
  });

  it("returns null when the state can't be determined", async () => {
    stubFetch({ success: true, data: {} });
    await expect(fetchEscrowFunded("CABC")).resolves.toBeNull();
    stubFetch({ success: false, error: "Job not found" }, false);
    await expect(fetchEscrowFunded("CABC")).resolves.toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(fetchEscrowFunded("CABC")).resolves.toBeNull();
  });
});
