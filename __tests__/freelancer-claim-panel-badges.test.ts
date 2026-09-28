import { describe, expect, it } from "vitest";
import { deriveClaimBadgeState, getClaimBadge } from "@/app/lib/freelancer_claim_panel_badges";

describe("getClaimBadge", () => {
  it("returns distinct badges per state", () => {
    const states = ["pending", "claimable", "claimed", "failed"];
    const badges = states.map(getClaimBadge);
    expect(new Set(badges.map((b) => b.className)).size).toBe(4);
    expect(new Set(badges.map((b) => b.icon)).size).toBe(4);
    expect(getClaimBadge("claimed").label).toBe("Claimed");
  });
  it("is case-insensitive and falls back to pending", () => {
    expect(getClaimBadge("FAILED").state).toBe("failed");
    expect(getClaimBadge("bogus").state).toBe("pending");
    expect(getClaimBadge(null).state).toBe("pending");
  });
});

describe("deriveClaimBadgeState", () => {
  it("covers varying conditions", () => {
    expect(deriveClaimBadgeState({ claimed: false, releasable: false })).toBe("pending");
    expect(deriveClaimBadgeState({ claimed: false, releasable: true })).toBe("claimable");
    expect(deriveClaimBadgeState({ claimed: true, releasable: true })).toBe("claimed");
    expect(deriveClaimBadgeState({ claimed: false, failed: true, releasable: true })).toBe("failed");
  });
});
