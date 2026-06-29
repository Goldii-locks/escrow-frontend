import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWhitelistedTokens, tokenLabel } from "@/app/lib/whitelist";

function stubFetch(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, json: async () => body }),
  );
}

describe("fetchWhitelistedTokens", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("normalizes string addresses and drops blanks", async () => {
    stubFetch({ success: true, data: ["CAAA", "  CBBB  ", ""] });
    expect(await fetchWhitelistedTokens("CID")).toEqual([
      { address: "CAAA" },
      { address: "CBBB" },
    ]);
  });

  it("normalizes object items with symbol/name and address aliases", async () => {
    stubFetch({
      data: [
        { address: "CAAA", symbol: "USDC" },
        { token: "CBBB", name: "Bee" },
      ],
    });
    expect(await fetchWhitelistedTokens("CID")).toEqual([
      { address: "CAAA", symbol: "USDC" },
      { address: "CBBB", name: "Bee" },
    ]);
  });

  it("accepts a bare array and a { tokens } envelope", async () => {
    stubFetch(["CAAA"]);
    expect(await fetchWhitelistedTokens("CID")).toEqual([{ address: "CAAA" }]);
    stubFetch({ tokens: ["CBBB"] });
    expect(await fetchWhitelistedTokens("CID")).toEqual([{ address: "CBBB" }]);
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
