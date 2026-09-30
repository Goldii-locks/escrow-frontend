import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ARBITRATION_ESCROW_ENDPOINT,
  MOCK_ARBITRATION_DATASET,
  fetchArbitrationDataset,
  mapArbitrationPayload,
  mapArbitrationRecord,
} from "@/app/lib/arbitration_escrow_details_mapping";

describe("arbitration_escrow_details data mapping bindings (#483)", () => {
  it("maps snake_case backend records to frontend model", () => {
    const record = mapArbitrationRecord(MOCK_ARBITRATION_DATASET[0]);
    expect(record).not.toBeNull();
    expect(record?.escrowId).toBe(
      "ESC-000000000000000000000000000000000000000000000042",
    );
    expect(record?.disputeId).toBe(
      "DIS-000000000000000000000000000000000000000000000117",
    );
    expect(record?.status).toBe("under_review");
    expect(record?.clientAddress).toBe(
      "GCLIENT7HQ2WKM4XPL6TFV3ZB9DCNR8YASEK5",
    );
    expect(record?.arbiterAddress).toBe(
      "GARBITER5PD3XCW8QL0NR6ZTKM2VBHJF4SASEK2",
    );
  });

  it("handles null or missing arbiter safely", () => {
    const record = mapArbitrationRecord(MOCK_ARBITRATION_DATASET[1]);
    expect(record?.arbiterAddress).toBeNull();
  });

  it("rejects invalid records lacking IDs", () => {
    expect(mapArbitrationRecord(null)).toBeNull();
    expect(mapArbitrationRecord({})).toBeNull();
    expect(mapArbitrationRecord({ status: "locked" })).toBeNull();
  });

  it("maps payloads whether in an array or wrapped object", () => {
    expect(mapArbitrationPayload(MOCK_ARBITRATION_DATASET)).toHaveLength(2);
    expect(
      mapArbitrationPayload({ data: MOCK_ARBITRATION_DATASET }),
    ).toHaveLength(2);
    expect(
      mapArbitrationPayload({ escrows: MOCK_ARBITRATION_DATASET }),
    ).toHaveLength(2);
    expect(mapArbitrationPayload("invalid")).toEqual([]);
  });

  describe("fetchArbitrationDataset", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("loads and binds data from backend endpoint", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => MOCK_ARBITRATION_DATASET,
        }),
      );

      const items = await fetchArbitrationDataset();
      expect(items).toHaveLength(2);
      expect(items[0].disputeId).toBe(
        "DIS-000000000000000000000000000000000000000000000117",
      );
    });

    it("throws when endpoint returns non-ok response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({}),
        }),
      );

      await expect(fetchArbitrationDataset()).rejects.toThrow("500");
    });
  });
});
