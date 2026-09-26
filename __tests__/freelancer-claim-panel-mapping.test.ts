import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MOCK_CLAIM_PAYLOAD,
  fetchClaimEntries,
  mapClaimEntry,
  mapClaimPayload,
} from "@/app/lib/freelancer_claim_panel_mapping";

describe("mapClaimEntry", () => {
  it("maps snake_case fields", () => {
    expect(mapClaimEntry(MOCK_CLAIM_PAYLOAD[1])).toEqual({
      id: "c-2", jobTitle: "API integration", amount: "900", token: "XLM",
      status: "claimed", claimedAt: "2026-01-05T10:00:00Z",
    });
  });
  it("defaults unknown status and missing fields", () => {
    const e = mapClaimEntry({ id: 7, status: "weird" });
    expect(e).toMatchObject({ id: "7", status: "pending", jobTitle: "Untitled job", amount: "0", token: "XLM", claimedAt: null });
  });
  it("rejects invalid records", () => {
    expect(mapClaimEntry(null)).toBeNull();
    expect(mapClaimEntry({ amount: "1" })).toBeNull();
  });
});

describe("mapClaimPayload", () => {
  it("accepts arrays and wrapped payloads, skipping bad rows", () => {
    expect(mapClaimPayload(MOCK_CLAIM_PAYLOAD)).toHaveLength(3);
    expect(mapClaimPayload({ claims: [...MOCK_CLAIM_PAYLOAD, {}] })).toHaveLength(3);
    expect(mapClaimPayload("nope")).toEqual([]);
  });
});

describe("fetchClaimEntries", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("loads and maps backend data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => MOCK_CLAIM_PAYLOAD }));
    expect((await fetchClaimEntries()).map((e) => e.id)).toEqual(["c-1", "c-2", "c-3"]);
  });
  it("throws on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    await expect(fetchClaimEntries()).rejects.toThrow("500");
  });
});
