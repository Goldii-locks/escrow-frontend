import { describe, expect, it } from "vitest";
import type { Job } from "@/app/lib/api_schemas";
import { deriveJobActions, deriveNeedsActions, sortNeedsActions } from "@/app/lib/needs_action";

const ME = "GME";
const OTHER = "GOTHER";
const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;

function job(id: string, overrides: Partial<Job>): Job {
  return {
    id,
    client: OTHER,
    freelancer: OTHER,
    arbiter: OTHER,
    funded: true,
    milestones: [],
    ...overrides,
  } as Job;
}

function ms(index: number, status: string) {
  return { index, amount: "100", status };
}

/** One wallet acting as client, freelancer and arbiter across several jobs. */
const JOBS: Job[] = [
  job("client-unfunded", { client: ME, funded: false, milestones: [ms(0, "Pending")] }),
  job("client-review", {
    client: ME,
    milestones: [ms(0, "Delivered"), ms(1, "Released")],
  }),
  job("freelancer", {
    freelancer: ME,
    milestones: [
      ms(0, "Pending"),
      ms(1, "Delivered"), // review window passed → claimable
      ms(2, "Delivered"), // still in review → waiting on the client
      ms(3, "Disputed"), // waiting on the arbiter
    ],
  }),
  job("freelancer-unfunded", { freelancer: ME, funded: false, milestones: [ms(0, "Pending")] }),
  job("arbiter", { arbiter: ME, milestones: [ms(0, "Disputed"), ms(1, "Delivered")] }),
  job("unrelated", { milestones: [ms(0, "Delivered"), ms(1, "Disputed")] }),
];

const DEADLINES = {
  "client-review": { 0: NOW + 2 * HOUR },
  freelancer: { 1: NOW - HOUR, 2: NOW + 5 * HOUR },
};

function summary(items: ReturnType<typeof deriveNeedsActions>) {
  return items.map((i) => `${i.role}:${i.kind}:${i.jobId}:${i.milestoneIndex}`);
}

describe("deriveNeedsActions (#888)", () => {
  const items = deriveNeedsActions(JOBS, ME, { now: NOW, deadlines: DEADLINES });

  it("lists the client's unfunded jobs and deliveries to review", () => {
    const client = summary(items.filter((i) => i.role === "client"));
    expect(client).toEqual([
      "client:review_delivery:client-review:0",
      "client:fund:client-unfunded:null",
    ]);
    const review = items.find((i) => i.kind === "review_delivery");
    expect(review?.deadlineMs).toBe(NOW + 2 * HOUR);
  });

  it("lists the freelancer's milestones to deliver and claimable auto-releases", () => {
    const freelancer = summary(items.filter((i) => i.role === "freelancer"));
    expect(freelancer).toEqual([
      "freelancer:claim_auto_release:freelancer:1",
      "freelancer:deliver:freelancer:0",
    ]);
  });

  it("doesn't ask a freelancer to deliver on an unfunded job", () => {
    expect(items.some((i) => i.jobId === "freelancer-unfunded")).toBe(false);
  });

  it("lists the arbiter's open disputes", () => {
    expect(summary(items.filter((i) => i.role === "arbiter"))).toEqual([
      "arbiter:resolve_dispute:arbiter:0",
    ]);
  });

  it("ignores jobs the wallet has no role in", () => {
    expect(items.some((i) => i.jobId === "unrelated")).toBe(false);
  });

  it("sorts by deadline, earliest first, with undated actions after", () => {
    expect(summary(items)).toEqual([
      "freelancer:claim_auto_release:freelancer:1",
      "client:review_delivery:client-review:0",
      "client:fund:client-unfunded:null",
      "freelancer:deliver:freelancer:0",
      "arbiter:resolve_dispute:arbiter:0",
    ]);
  });

  it("offers the claim when the deadline is unknown, as the milestone card does", () => {
    const actions = deriveJobActions(
      job("unknown-deadline", { freelancer: ME, milestones: [ms(0, "Delivered")] }),
      ME,
      { now: NOW }
    );
    expect(actions).toEqual([
      expect.objectContaining({ kind: "claim_auto_release", milestoneIndex: 0, deadlineMs: null }),
    ]);
  });

  it("returns nothing without a connected wallet", () => {
    expect(deriveNeedsActions(JOBS, "", { now: NOW })).toEqual([]);
  });
});

describe("sortNeedsActions", () => {
  it("keeps the original order for equal or missing deadlines", () => {
    const base = { jobId: "j", milestoneIndex: 0, role: "client" as const, kind: "fund" as const };
    const sorted = sortNeedsActions([
      { ...base, key: "a", deadlineMs: null },
      { ...base, key: "b", deadlineMs: 5 },
      { ...base, key: "c", deadlineMs: null },
      { ...base, key: "d", deadlineMs: 5 },
      { ...base, key: "e", deadlineMs: 1 },
    ]);
    expect(sorted.map((i) => i.key)).toEqual(["e", "b", "d", "a", "c"]);
  });
});
