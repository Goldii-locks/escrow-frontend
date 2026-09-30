import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CLIENT_REFUND_ENDPOINT,
  MOCK_REFUND_PAYLOAD,
  fetchRefundEntries,
  mapRefundEntry,
  mapRefundPayload,
} from "@/app/lib/client_refund_panel_mapping";

describe("client_refund_panel data mapping bindings (#503)", () => {
  it("maps snake_case fields correctly from backend mock payload", () => {
    const entry = mapRefundEntry(MOCK_REFUND_PAYLOAD[0]);
    expect(entry).not.toBeNull();
    expect(entry?.id).toBe("ref-1");
    expect(entry?.escrowId).toBe("esc-101");
    expect(entry?.jobTitle).toBe("Fullstack web application");
    expect(entry?.amount).toBe("750.00");
    expect(entry?.token).toBe("USDC");
    expect(entry?.status).toBe("pending");
    expect(entry?.clientAddress).toBe(
      "GCLIENT1111111111111111111111111111111111111111111",
    );
  });

  it("handles missing or unknown fields with defaults", () => {
    const entry = mapRefundEntry({ id: "custom-1", status: "unknown" });
    expect(entry).not.toBeNull();
    expect(entry?.id).toBe("custom-1");
    expect(entry?.status).toBe("pending");
    expect(entry?.jobTitle).toBe("Untitled Escrow");
    expect(entry?.amount).toBe("0.00");
    expect(entry?.token).toBe("USDC");
  });

  it("rejects invalid records without id", () => {
    expect(mapRefundEntry(null)).toBeNull();
    expect(mapRefundEntry({})).toBeNull();
    expect(mapRefundEntry({ amount: "500" })).toBeNull();
  });

  it("maps array or wrapped payload formats", () => {
    expect(mapRefundPayload(MOCK_REFUND_PAYLOAD)).toHaveLength(3);
    expect(
      mapRefundPayload({ refunds: [...MOCK_REFUND_PAYLOAD, {}] }),
    ).toHaveLength(3);
    expect(mapRefundPayload({ data: MOCK_REFUND_PAYLOAD })).toHaveLength(3);
    expect(mapRefundPayload("invalid")).toEqual([]);
  });

  describe("fetchRefundEntries", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("loads and maps backend data via fetch", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => MOCK_REFUND_PAYLOAD,
        }),
      );

      const items = await fetchRefundEntries();
      expect(items).toHaveLength(3);
      expect(items.map((i) => i.id)).toEqual(["ref-1", "ref-2", "ref-3"]);
    });

    it("throws on non-ok HTTP responses", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: async () => ({}),
        }),
      );

      await expect(fetchRefundEntries(CLIENT_REFUND_ENDPOINT)).rejects.toThrow(
        "404",
      );
    });
  });
});
