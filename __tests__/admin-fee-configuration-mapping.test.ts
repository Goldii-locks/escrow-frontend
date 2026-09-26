import { describe, expect, it } from "vitest";
import {
  FEE_CONFIG_ENDPOINT,
  MOCK_FEE_CONFIG,
  loadFeeConfig,
  mapFeeConfigResponse,
  toFeeConfigPayload,
} from "@/app/lib/admin_fee_configuration_mapping";

describe("admin_fee_configuration mapping", () => {
  it("maps backend mock data to form values", () => {
    expect(mapFeeConfigResponse(MOCK_FEE_CONFIG)).toEqual({
      feePercent: "2.5",
      recipient: "GDEXAMPLEFEERECIPIENT",
      updatedAt: "2025-01-01T00:00:00Z",
    });
  });
  it("handles missing or invalid data", () => {
    expect(mapFeeConfigResponse(null)).toEqual({ feePercent: "", recipient: "", updatedAt: null });
    expect(mapFeeConfigResponse({ fee_bps: "abc" }).feePercent).toBe("");
  });
  it("maps form values back to payload", () => {
    expect(toFeeConfigPayload({ feePercent: "1.5", recipient: "GABC" })).toEqual({ fee_bps: 150, fee_recipient: "GABC" });
  });
  it("loads values from the fetcher", async () => {
    let called = "";
    const v = await loadFeeConfig(async (u) => { called = u; return { fee_bps: 100 }; });
    expect(called).toBe(FEE_CONFIG_ENDPOINT);
    expect(v.feePercent).toBe("1");
    expect((await loadFeeConfig()).feePercent).toBe("2.5");
  });
});
