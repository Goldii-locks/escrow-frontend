import { describe, expect, it } from "vitest";
import {
  deriveArbitrationBadgeState,
  getArbitrationBadge,
} from "@/app/lib/arbitration_escrow_details_badges";

describe("arbitration_escrow_details state badges (#484)", () => {
  it("returns distinct badges for each active state", () => {
    const states = [
      "locked",
      "under_review",
      "resolved",
      "pending",
      "appealed",
    ] as const;
    const badges = states.map((s) => getArbitrationBadge(s));

    expect(new Set(badges.map((b) => b.className)).size).toBe(5);
    expect(new Set(badges.map((b) => b.label)).size).toBe(5);
    expect(new Set(badges.map((b) => b.icon)).size).toBe(5);

    expect(getArbitrationBadge("locked").label).toBe("Locked in Escrow");
    expect(getArbitrationBadge("under_review").label).toBe("Under Review");
    expect(getArbitrationBadge("resolved").label).toBe("Resolved");
  });

  it("handles case-insensitivity and formatting variations", () => {
    expect(getArbitrationBadge("LOCKED").state).toBe("locked");
    expect(getArbitrationBadge("under-review").state).toBe("under_review");
    expect(getArbitrationBadge("Under Review").state).toBe("under_review");
    expect(getArbitrationBadge("unknown").state).toBe("pending");
    expect(getArbitrationBadge(null).state).toBe("pending");
    expect(getArbitrationBadge(undefined).state).toBe("pending");
  });

  it("derives badge state under varying conditions", () => {
    expect(deriveArbitrationBadgeState({ isLocked: true })).toBe("locked");
    expect(
      deriveArbitrationBadgeState({ isLocked: true, isUnderReview: true }),
    ).toBe("under_review");
    expect(deriveArbitrationBadgeState({ isResolved: true })).toBe("resolved");
    expect(deriveArbitrationBadgeState({ isAppealed: true })).toBe("appealed");
    expect(deriveArbitrationBadgeState({})).toBe("pending");
  });
});
