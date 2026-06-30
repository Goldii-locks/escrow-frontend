import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAdminAddress, isAdmin } from "@/app/lib/admin";

function stubFetch(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  );
}

describe("fetchAdminAddress", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns admin address from direct string response", async () => {
    stubFetch("GADMIN123");
    const result = await fetchAdminAddress("CONTRACT_ID");
    expect(result).toBe("GADMIN123");
  });

  it("returns admin address from success wrapper", async () => {
    stubFetch({ success: true, data: "GADMIN456" });
    const result = await fetchAdminAddress("CONTRACT_ID");
    expect(result).toBe("GADMIN456");
  });

  it("returns admin address from result field", async () => {
    stubFetch({ result: "GADMIN789" });
    const result = await fetchAdminAddress("CONTRACT_ID");
    expect(result).toBe("GADMIN789");
  });

  it("returns null on non-ok response", async () => {
    stubFetch({ error: "Not found" }, false, 404);
    const result = await fetchAdminAddress("CONTRACT_ID");
    expect(result).toBeNull();
  });

  it("returns null when admin address is not found in response", async () => {
    stubFetch({ success: true, data: null });
    const result = await fetchAdminAddress("CONTRACT_ID");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error"))
    );
    const result = await fetchAdminAddress("CONTRACT_ID");
    expect(result).toBeNull();
  });

  it("ignores non-Stellar addresses", async () => {
    stubFetch({ data: "not-an-address" });
    const result = await fetchAdminAddress("CONTRACT_ID");
    expect(result).toBeNull();
  });
});

describe("isAdmin", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns true when wallet matches admin address", async () => {
    stubFetch("GADMIN123");
    const result = await isAdmin("GADMIN123", "CONTRACT_ID");
    expect(result).toBe(true);
  });

  it("returns false when wallet does not match admin address", async () => {
    stubFetch("GADMIN123");
    const result = await isAdmin("GUSER456", "CONTRACT_ID");
    expect(result).toBe(false);
  });

  it("returns false when wallet is null", async () => {
    stubFetch("GADMIN123");
    const result = await isAdmin(null, "CONTRACT_ID");
    expect(result).toBe(false);
  });

  it("returns false when admin address cannot be fetched", async () => {
    stubFetch({}, false, 500);
    const result = await isAdmin("GUSER456", "CONTRACT_ID");
    expect(result).toBe(false);
  });
});
