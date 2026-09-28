import { describe, expect, it } from "vitest";
import {
  REFUND_BADGE_STATES,
  deriveRefundBadgeState,
  getRefundBadge,
} from "@/app/lib/client_refund_panel_badges";

describe("getRefundBadge", () => {
  it("returns distinct badges per state", () => {
    const badges = REFUND_BADGE_STATES.map(getRefundBadge);
    expect(new Set(badges.map((b) => b.className)).size).toBe(4);
    expect(new Set(badges.map((b) => b.icon)).size).toBe(4);
    expect(getRefundBadge("refund_approved").label).toBe("Refund Approved");
  });

  it("is case-insensitive and falls back to pending_refund", () => {
    expect(getRefundBadge("REFUND_APPROVED").state).toBe("refund_approved");
    expect(getRefundBadge("bogus").state).toBe("pending_refund");
    expect(getRefundBadge(null).state).toBe("pending_refund");
    expect(getRefundBadge(undefined).state).toBe("pending_refund");
  });

  it("each badge has non-empty label, icon, className and ariaLabel", () => {
    for (const state of REFUND_BADGE_STATES) {
      const badge = getRefundBadge(state);
      expect(badge.label.length).toBeGreaterThan(0);
      expect(badge.icon.length).toBeGreaterThan(0);
      expect(badge.className.length).toBeGreaterThan(0);
      expect(badge.ariaLabel).toContain(state.replace(/_/g, " "));
    }
  });

  it("uses design token color classes matching MilestoneCard pattern", () => {
    expect(getRefundBadge("pending_refund").className).toContain("bg-warning-soft/10");
    expect(getRefundBadge("pending_refund").className).toContain("text-warning-soft");
    expect(getRefundBadge("refund_approved").className).toContain("bg-success-soft/10");
    expect(getRefundBadge("refund_approved").className).toContain("text-success-soft");
    expect(getRefundBadge("refund_rejected").className).toContain("bg-danger-soft/10");
    expect(getRefundBadge("refund_rejected").className).toContain("text-danger-soft");
    expect(getRefundBadge("refund_processing").className).toContain("bg-info-soft/10");
    expect(getRefundBadge("refund_processing").className).toContain("text-info-soft");
  });
});

describe("deriveRefundBadgeState", () => {
  it("covers varying conditions", () => {
    expect(
      deriveRefundBadgeState({ approved: false, rejected: false }),
    ).toBe("pending_refund");
    expect(
      deriveRefundBadgeState({ approved: true, rejected: false }),
    ).toBe("refund_approved");
    expect(
      deriveRefundBadgeState({ approved: false, rejected: true }),
    ).toBe("refund_rejected");
    expect(
      deriveRefundBadgeState({ approved: true, rejected: false, processing: true }),
    ).toBe("refund_processing");
  });

  it("rejected always wins regardless of approved flag", () => {
    expect(
      deriveRefundBadgeState({ approved: true, rejected: true }),
    ).toBe("refund_rejected");
  });
});
