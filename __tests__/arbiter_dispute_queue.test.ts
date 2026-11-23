import { describe, expect, it } from "vitest";
import {
  DISPUTE_ESCALATION_WINDOW_MS,
  buildArbiterDisputeQueue,
  countArbiterDisputes,
  formatTimeUntilEscalation,
  getArbiterQueueEmptyState,
  getEscalationDeadline,
  parseArbiterJobsPayload,
  type ArbiterQueueJob,
} from "@/app/lib/arbiter_dispute_queue";

const ARBITER = "GARBITER";
const NOW = Date.parse("2026-01-10T00:00:00Z");
const HOUR = 60 * 60 * 1000;

function job(
  id: string,
  overrides: Partial<ArbiterQueueJob> = {},
): ArbiterQueueJob {
  return {
    id,
    client: "GCLIENT",
    freelancer: "GFREELANCER",
    arbiter: ARBITER,
    milestones: [],
    ...overrides,
  };
}

describe("buildArbiterDisputeQueue (#881)", () => {
  it("collects disputed milestones across three jobs sorted by escalation deadline", () => {
    const jobs = [
      job("job-late", {
        milestones: [
          {
            index: 0,
            amount: "10",
            status: "Disputed",
            escalationDeadline: NOW + 48 * HOUR,
          },
        ],
      }),
      job("job-soon", {
        milestones: [
          {
            index: 1,
            amount: "20",
            status: "Disputed",
            escalationDeadline: NOW + 2 * HOUR,
          },
        ],
      }),
      job("job-overdue", {
        milestones: [
          {
            index: 0,
            amount: "30",
            status: "Disputed",
            escalationDeadline: NOW - HOUR,
          },
        ],
      }),
    ];

    const queue = buildArbiterDisputeQueue(jobs, ARBITER, NOW);
    expect(queue.map((e) => e.jobId)).toEqual([
      "job-overdue",
      "job-soon",
      "job-late",
    ]);
    expect(queue[0].msUntilEscalation).toBe(-HOUR);
    expect(queue[1].msUntilEscalation).toBe(2 * HOUR);
  });

  it("only includes Disputed milestones on jobs where the wallet is arbiter", () => {
    const jobs = [
      job("mine", {
        milestones: [
          { index: 0, amount: "1", status: "Pending" },
          { index: 1, amount: "2", status: "Disputed" },
          { index: 2, amount: "3", status: "Released" },
        ],
      }),
      job("someone-elses", {
        arbiter: "GOTHER",
        milestones: [{ index: 0, amount: "4", status: "Disputed" }],
      }),
    ];

    const queue = buildArbiterDisputeQueue(jobs, ARBITER, NOW);
    expect(queue).toHaveLength(1);
    expect(queue[0].jobId).toBe("mine");
    expect(queue[0].milestoneIndex).toBe(1);
  });

  it("returns an empty queue without a connected address", () => {
    const jobs = [
      job("mine", {
        milestones: [{ index: 0, amount: "1", status: "Disputed" }],
      }),
    ];
    expect(buildArbiterDisputeQueue(jobs, null, NOW)).toEqual([]);
  });

  it("estimates the deadline from disputedAt plus the response window", () => {
    const jobs = [
      job("estimated", {
        milestones: [
          {
            index: 0,
            amount: "1",
            status: "Disputed",
            disputedAt: new Date(NOW - 10 * HOUR).toISOString(),
          },
        ],
      }),
    ];

    const queue = buildArbiterDisputeQueue(jobs, ARBITER, NOW);
    expect(queue[0].escalationDeadline).toBe(
      NOW - 10 * HOUR + DISPUTE_ESCALATION_WINDOW_MS,
    );
    expect(queue[0].raisedAt).toBe(NOW - 10 * HOUR);
  });

  it("prefers an explicit deadline over the estimated one", () => {
    const explicit = NOW + 5 * HOUR;
    expect(
      getEscalationDeadline({
        index: 0,
        amount: "1",
        status: "Disputed",
        disputedAt: NOW - HOUR,
        escalationDeadline: explicit,
      }),
    ).toBe(explicit);
  });

  it("sorts entries with unknown deadlines last, oldest-raised first", () => {
    const jobs = [
      job("unknown", {
        milestones: [{ index: 0, amount: "1", status: "Disputed" }],
      }),
      job("older-unknown", {
        milestones: [
          {
            index: 0,
            amount: "1",
            status: "Disputed",
            escalationDeadline: undefined,
            disputedAt: undefined,
          },
        ],
      }),
      job("known", {
        milestones: [
          {
            index: 0,
            amount: "1",
            status: "Disputed",
            escalationDeadline: NOW + HOUR,
          },
        ],
      }),
    ];

    const queue = buildArbiterDisputeQueue(jobs, ARBITER, NOW);
    expect(queue[0].jobId).toBe("known");
    // Both unknown entries fall back to jobId ordering for stability.
    expect(queue.slice(1).map((e) => e.jobId)).toEqual([
      "older-unknown",
      "unknown",
    ]);
    expect(queue[1].msUntilEscalation).toBeNull();
  });

  it("carries job token metadata and dispute provenance onto entries", () => {
    const jobs = [
      job("rich", {
        tokenSymbol: "USDC",
        tokenDecimals: 6,
        milestones: [
          {
            index: 2,
            amount: "1500000",
            status: "Disputed",
            disputedBy: "GCLIENT",
            disputedAt: NOW - HOUR,
          },
        ],
      }),
    ];

    const [entry] = buildArbiterDisputeQueue(jobs, ARBITER, NOW);
    expect(entry.tokenSymbol).toBe("USDC");
    expect(entry.tokenDecimals).toBe(6);
    expect(entry.raisedBy).toBe("GCLIENT");
    expect(entry.amount).toBe("1500000");
  });
});

describe("countArbiterDisputes (#881)", () => {
  it("counts disputed milestones across the arbiter's jobs only", () => {
    const jobs = [
      job("a", {
        milestones: [
          { index: 0, amount: "1", status: "Disputed" },
          { index: 1, amount: "1", status: "Disputed" },
        ],
      }),
      job("b", {
        milestones: [{ index: 0, amount: "1", status: "Disputed" }],
      }),
      job("c", { arbiter: "GOTHER", milestones: [{ index: 0, amount: "1", status: "Disputed" }] }),
      job("d", { milestones: [{ index: 0, amount: "1", status: "Pending" }] }),
    ];
    expect(countArbiterDisputes(jobs, ARBITER)).toBe(3);
    expect(countArbiterDisputes(jobs, null)).toBe(0);
  });
});

describe("formatTimeUntilEscalation (#881)", () => {
  it("formats remaining time at day/hour/minute granularity", () => {
    expect(formatTimeUntilEscalation(2 * 24 * HOUR + 3 * HOUR)).toBe("2d 3h");
    expect(formatTimeUntilEscalation(5 * HOUR + 12 * 60_000)).toBe("5h 12m");
    expect(formatTimeUntilEscalation(9 * 60_000)).toBe("9m");
    expect(formatTimeUntilEscalation(30_000)).toBe("Under a minute");
  });

  it("labels overdue and unknown windows", () => {
    expect(formatTimeUntilEscalation(0)).toBe("Escalatable now");
    expect(formatTimeUntilEscalation(-HOUR)).toBe("Escalatable now");
    expect(formatTimeUntilEscalation(null)).toBe("Escalation window unknown");
  });
});

describe("getArbiterQueueEmptyState (#881)", () => {
  it("provides empty-state copy", () => {
    const empty = getArbiterQueueEmptyState();
    expect(empty.title).toMatch(/no disputes/i);
    expect(empty.description.length).toBeGreaterThan(0);
  });
});

describe("parseArbiterJobsPayload (#881)", () => {
  const row = {
    id: "job-1",
    client: "GCLIENT",
    freelancer: "GFREELANCER",
    arbiter: ARBITER,
    milestones: [{ index: 0, amount: "1", status: "Disputed" }],
  };

  it("accepts data arrays, data.jobs and data.items shapes", () => {
    expect(parseArbiterJobsPayload({ data: [row] })).toHaveLength(1);
    expect(parseArbiterJobsPayload({ data: { jobs: [row] } })).toHaveLength(1);
    expect(parseArbiterJobsPayload({ data: { items: [row] } })).toHaveLength(1);
    expect(parseArbiterJobsPayload({ data: row })).toHaveLength(1);
  });

  it("returns no jobs for failed or malformed payloads", () => {
    expect(parseArbiterJobsPayload({ success: false, data: [row] })).toEqual([]);
    expect(parseArbiterJobsPayload(null)).toEqual([]);
    expect(parseArbiterJobsPayload({ data: [{ nope: true }] })).toEqual([]);
  });
});