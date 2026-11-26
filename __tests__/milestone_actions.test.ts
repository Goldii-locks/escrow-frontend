import { describe, expect, it } from "vitest";
import {
  canFund,
  canFundMilestone,
  getReclaimOverdueEligibility,
  getWithdrawUnacceptedEligibility,
} from "@/app/lib/milestone_actions";

const now = 1_700_000_000_000;
const oneDay = 24 * 60 * 60 * 1000;
const sevenDays = 7 * oneDay;

describe("getWithdrawUnacceptedEligibility (#821)", () => {
  it("is eligible when funded, not fully accepted, and the 7-day window has passed", () => {
    const result = getWithdrawUnacceptedEligibility({
      funded: true,
      acceptedCount: 0,
      milestoneCount: 3,
      fundedAt: now - sevenDays - oneDay,
      now,
    });
    expect(result.eligible).toBe(true);
    expect(result.funded).toBe(true);
    expect(result.fullyAccepted).toBe(false);
    expect(result.windowPassed).toBe(true);
    expect(result.msRemaining).toBe(0);
  });

  it("is not eligible before the 7-day window passes", () => {
    const result = getWithdrawUnacceptedEligibility({
      funded: true,
      acceptedCount: 0,
      milestoneCount: 3,
      fundedAt: now - oneDay,
      now,
    });
    expect(result.eligible).toBe(false);
    expect(result.windowPassed).toBe(false);
    expect(result.msRemaining).toBeGreaterThan(0);
  });

  it("is not eligible when every milestone has been accepted", () => {
    const result = getWithdrawUnacceptedEligibility({
      funded: true,
      acceptedCount: 3,
      milestoneCount: 3,
      fundedAt: now - sevenDays - oneDay,
      now,
    });
    expect(result.eligible).toBe(false);
    expect(result.fullyAccepted).toBe(true);
  });

  it("is not eligible when the escrow is not funded", () => {
    const result = getWithdrawUnacceptedEligibility({
      funded: false,
      acceptedCount: 0,
      milestoneCount: 3,
      fundedAt: now - sevenDays - oneDay,
      now,
    });
    expect(result.eligible).toBe(false);
    expect(result.funded).toBe(false);
  });

  it("reports ms remaining until the window opens", () => {
    const result = getWithdrawUnacceptedEligibility({
      funded: true,
      acceptedCount: 0,
      milestoneCount: 3,
      fundedAt: now - oneDay,
      now,
    });
    expect(result.msRemaining).toBeCloseTo(sevenDays - oneDay, -2);
  });
});

describe("getReclaimOverdueEligibility (#821)", () => {
  it("is eligible for a funded Pending milestone past due + grace", () => {
    const result = getReclaimOverdueEligibility({
      status: "Pending",
      funded: true,
      dueAt: now - twoDaysMs(),
      now,
    });
    expect(result.eligible).toBe(true);
    expect(result.msRemaining).toBe(0);
  });

  it("is not eligible before due + grace has passed", () => {
    const result = getReclaimOverdueEligibility({
      status: "Pending",
      funded: true,
      dueAt: now - oneDay / 2,
      now,
    });
    expect(result.eligible).toBe(false);
    expect(result.msRemaining).toBeGreaterThan(0);
  });

  it("is not eligible for a non-Pending milestone", () => {
    const result = getReclaimOverdueEligibility({
      status: "Delivered",
      funded: true,
      dueAt: now - twoDaysMs(),
      now,
    });
    expect(result.eligible).toBe(false);
  });

  it("is not eligible for an unfunded milestone", () => {
    const result = getReclaimOverdueEligibility({
      status: "Pending",
      funded: false,
      dueAt: now - twoDaysMs(),
      now,
    });
    expect(result.eligible).toBe(false);
  });

  it("returns null msRemaining when due is unknown", () => {
    const result = getReclaimOverdueEligibility({
      status: "Pending",
      funded: true,
      dueAt: null,
      now,
    });
    expect(result.eligible).toBe(false);
    expect(result.msRemaining).toBeNull();
  });
});

describe("canFundMilestone / canFund (#822)", () => {
  it("offers per-milestone funding only for PerMilestone jobs", () => {
    const milestone = { index: 0, status: "Pending", funded: false } as const;
    expect(canFundMilestone(milestone, true, "PerMilestone")).toBe(true);
    expect(canFundMilestone(milestone, true, "Upfront")).toBe(false);
    expect(canFundMilestone(milestone, true, undefined)).toBe(false);
    expect(canFundMilestone(milestone, false, "PerMilestone")).toBe(false);
  });

  it("does not offer funding for an already-funded milestone", () => {
    const milestone = { index: 0, status: "Pending", funded: true } as const;
    expect(canFundMilestone(milestone, true, "PerMilestone")).toBe(false);
  });

  it("does not offer funding for a non-Pending milestone", () => {
    const milestone = { index: 0, status: "Delivered", funded: false } as const;
    expect(canFundMilestone(milestone, true, "PerMilestone")).toBe(false);
  });

  it("keeps job-level funding for Upfront jobs", () => {
    expect(canFund({ funded: false }, true)).toBe(true);
    expect(canFund({ funded: true }, true)).toBe(false);
    expect(canFund({ funded: false }, false)).toBe(false);
  });
});

function twoDaysMs(): number {
  return now - 2 * oneDay;
}
