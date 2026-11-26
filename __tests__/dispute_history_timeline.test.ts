import { describe, it, expect, vi, afterEach } from "vitest";
import { MOCK_DISPUTE_HISTORY } from "@/__tests__/fixtures/dispute_history_timeline";
import {
  fetchDisputeHistory,
  isTimelineViewerAuthorized,
  sanitizeTimelineInput,
} from "@/app/lib/dispute_history_timeline";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isTimelineViewerAuthorized (#440)", () => {
  it("rejects missing or blank wallets", () => {
    expect(isTimelineViewerAuthorized(null)).toBe(false);
    expect(isTimelineViewerAuthorized("   ")).toBe(false);
  });

  it("checks the whitelist case-insensitively", () => {
    expect(isTimelineViewerAuthorized("gabc", ["GABC"])).toBe(true);
    expect(isTimelineViewerAuthorized("GXYZ", ["GABC"])).toBe(false);
  });
});

describe("sanitizeTimelineInput (#442)", () => {
  it("strips script and code tags with their contents", () => {
    expect(sanitizeTimelineInput("<script>alert(1)</script>")).toBe("");
    expect(sanitizeTimelineInput("hi <code>rm -rf</code>there")).toBe("hi there");
    expect(sanitizeTimelineInput("<b>bold</b>")).toBe("bold");
  });
});

describe("fetchDisputeHistory (#443)", () => {
  it("returns backend data when the query succeeds", async () => {
    const data = [{ ...MOCK_DISPUTE_HISTORY[0], id: "backend-1" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    expect(await fetchDisputeHistory("disp-101")).toEqual(data);
  });

  it("throws when the backend is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    await expect(fetchDisputeHistory("disp-101")).rejects.toThrow(/down/);
  });
});
