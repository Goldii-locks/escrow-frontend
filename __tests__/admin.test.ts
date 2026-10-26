import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_QUERY_METHOD, fetchAdminAddress, isAdmin } from "@/app/lib/admin";

const ADMIN = "G" + "A".repeat(55);
const USER = "G" + "B".repeat(55);

/** The backend's `sendSuccess` envelope for a `get_escrow_state` query. */
function stateEnvelope(admin: unknown) {
  return {
    success: true,
    data: {
      contractId: "CCONTRACT",
      method: ADMIN_QUERY_METHOD,
      result: { admin, job: { funded: true } },
    },
  };
}

function stubFetch(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status, json: async () => body });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fetchAdminAddress", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("queries get_escrow_state through the backend's read-only query route", async () => {
    const fetchMock = stubFetch(stateEnvelope(ADMIN));
    await fetchAdminAddress("CONTRACT_ID");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/jobs\/query$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      contractId: "CONTRACT_ID",
      method: "get_escrow_state",
    });
  });

  it("returns the admin from the standard { success, data } envelope", async () => {
    stubFetch(stateEnvelope(ADMIN));
    expect(await fetchAdminAddress("CONTRACT_ID")).toBe(ADMIN);
  });

  it.each([
    ["a bare address string", ADMIN],
    ["an address directly in data", { success: true, data: ADMIN }],
    ["a top-level result field", { result: ADMIN }],
    ["a failed envelope", { success: false, data: { result: { admin: ADMIN } } }],
  ])("rejects %s instead of guessing the shape", async (_label, body) => {
    stubFetch(body);
    expect(await fetchAdminAddress("CONTRACT_ID")).toBeNull();
  });

  it("returns null on non-ok response", async () => {
    stubFetch({ success: false, error: "Unsupported query method" }, false, 400);
    expect(await fetchAdminAddress("CONTRACT_ID")).toBeNull();
  });

  it("returns null when the state has no admin", async () => {
    stubFetch({ success: true, data: { result: {} } });
    expect(await fetchAdminAddress("CONTRACT_ID")).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    expect(await fetchAdminAddress("CONTRACT_ID")).toBeNull();
  });

  it("ignores non-Stellar addresses", async () => {
    stubFetch(stateEnvelope("not-an-address"));
    expect(await fetchAdminAddress("CONTRACT_ID")).toBeNull();
  });
});

describe("isAdmin", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns true when wallet matches admin address", async () => {
    stubFetch(stateEnvelope(ADMIN));
    expect(await isAdmin(ADMIN, "CONTRACT_ID")).toBe(true);
  });

  it("returns false when wallet does not match admin address", async () => {
    stubFetch(stateEnvelope(ADMIN));
    expect(await isAdmin(USER, "CONTRACT_ID")).toBe(false);
  });

  it("returns false when wallet is null", async () => {
    stubFetch(stateEnvelope(ADMIN));
    expect(await isAdmin(null, "CONTRACT_ID")).toBe(false);
  });

  it("returns false when admin address cannot be fetched", async () => {
    stubFetch({}, false, 500);
    expect(await isAdmin(USER, "CONTRACT_ID")).toBe(false);
  });
});
