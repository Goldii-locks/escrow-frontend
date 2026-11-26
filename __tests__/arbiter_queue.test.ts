import { describe, it, expect } from "vitest";
import { extractDisputedItems, sortByUrgency, formatTimeLeft } from "@/app/lib/arbiter_queue";

const ARB = "GARB";
const state = (disputedAt: number, status = "Disputed") => ({
  job: {
    arbiter: ARB,
    milestones: [{ index: 0, amount: "10", status, disputed_at: disputedAt }],
  },
});

describe("arbiter queue (#881)", () => {
  it("lists only disputed milestones for the arbiter", () => {
    expect(extractDisputedItems("J1", state(1000), ARB)).toHaveLength(1);
    expect(extractDisputedItems("J1", state(1000, "Delivered"), ARB)).toHaveLength(0);
    expect(extractDisputedItems("J1", state(1000), "GOTHER")).toHaveLength(0);
  });

  it("sorts three jobs by escalation deadline, unknown last", () => {
    const items = [
      ...extractDisputedItems("A", state(3000), ARB),
      ...extractDisputedItems("B", { job: { arbiter: ARB, milestones: [{ index: 0, amount: "1", status: "Disputed" }] } }, ARB),
      ...extractDisputedItems("C", state(1000), ARB),
    ];
    expect(sortByUrgency(items).map((i) => i.jobId)).toEqual(["C", "A", "B"]);
  });

  it("formats time left", () => {
    expect(formatTimeLeft(null, 0)).toBe("Unknown");
    expect(formatTimeLeft(10, 20)).toBe("Escalation open");
    expect(formatTimeLeft(90000 + 3600, 0)).toBe("1d 1h left");
  });
});
