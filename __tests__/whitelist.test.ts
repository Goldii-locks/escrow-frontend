import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiShapeError, fetchWhitelistedTokens, tokenLabel } from "@/app/lib/whitelist";

function stubFetch(body: unknown, ok = true, status = 200) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok, status, json: async () => body }));
}

describe("fetchWhitelistedTokens", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads tokens from the backend's { success, data: { tokens } } body", async () => {
    stubFetch({ success: true, data: { tokens: ["CAAA"] } });
    expect(await fetchWhitelistedTokens("CID")).toEqual([{ address: "CAAA" }]);
  });

  it("normalizes string addresses and drops blanks", async () => {
    stubFetch({ success: true, data: { tokens: ["CAAA", "  CBBB  ", ""] } });
    expect(await fetchWhitelistedTokens("CID")).toEqual([{ address: "CAAA" }, { address: "CBBB" }]);
  });

  it("normalizes object items with symbol/name and address aliases", async () => {
    stubFetch({
      success: true,
      data: {
        tokens: [
          { address: "CAAA", symbol: "USDC" },
          { token: "CBBB", name: "Bee" },
        ],
      },
    });
    expect(await fetchWhitelistedTokens("CID")).toEqual([
      { address: "CAAA", symbol: "USDC" },
      { address: "CBBB", name: "Bee" },
    ]);
  });

  // An unexpected body is an error, not an empty whitelist (#678).
  it("throws ApiShapeError for unexpected shapes instead of returning []", async () => {
    stubFetch(["CAAA"]);
    await expect(fetchWhitelistedTokens("CID")).rejects.toBeInstanceOf(ApiShapeError);
    stubFetch({ success: true, data: ["CAAA"] });
    await expect(fetchWhitelistedTokens("CID")).rejects.toBeInstanceOf(ApiShapeError);
  });

  it("throws on a non-ok response", async () => {
    stubFetch({}, false, 500);
    await expect(fetchWhitelistedTokens("CID")).rejects.toThrow();
  });
});

describe("tokenLabel", () => {
  it("prefers symbol, then name, then a truncated address", () => {
    expect(tokenLabel({ address: "CABCDEFGHIJKLMNOP", symbol: "USDC" })).toBe("USDC");
    expect(tokenLabel({ address: "CABCDEFGHIJKLMNOP", name: "Bee Token" })).toBe("Bee Token");
    expect(tokenLabel({ address: "CABCDEFGHIJKLMNOP" })).toBe("CABC…MNOP");
  });

  it("returns short addresses unchanged", () => {
    expect(tokenLabel({ address: "CSHORT" })).toBe("CSHORT");
  });
});
