import { describe, it, expect } from "vitest";
import {
  MAX_MILESTONES,
  isMilestoneCapReached,
  milestoneLimitHint,
} from "../app/lib/milestone_limits";

describe("milestone limits", () => {
  it("matches the contract's MAX_MILESTONES", () => {
    expect(MAX_MILESTONES).toBe(50);
  });

  it("disables adding at the cap", () => {
    expect(isMilestoneCapReached(MAX_MILESTONES - 1)).toBe(false);
    expect(isMilestoneCapReached(MAX_MILESTONES)).toBe(true);
  });

  it("renders the hint with the cap", () => {
    expect(milestoneLimitHint()).toBe("Up to 50 milestones per escrow");
    expect(milestoneLimitHint(5)).toBe("Up to 5 milestones per escrow");
  });
});
