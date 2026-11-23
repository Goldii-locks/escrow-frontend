/**
 * "Needs your action" (#888): every pending action for the connected wallet
 * across all of its jobs, so nobody has to expand each job to find a review
 * deadline before the money auto-releases.
 *
 * The rows are derived from job and milestone state with the same predicates
 * the milestone cards use (`milestone_actions.ts`), so the two can't disagree.
 *
 * Actions derived:
 *  - client: fund an unfunded job; review a Delivered milestone before it
 *    auto-releases (deadline: the auto-release time);
 *  - freelancer: deliver a Pending milestone of a funded job; claim a
 *    Delivered milestone whose review window has passed;
 *  - arbiter: rule on a Disputed milestone.
 *
 * Accepting a job and withdrawing credited funds aren't listed: the job data
 * the backend returns carries no acceptance or credited-balance fields to
 * derive them from.
 */
import { BACKEND_URL } from "@/app/lib/transactions";
import { fetchAllAutoReleaseDeadlines } from "@/app/lib/batchAutoRelease";
import {
  JobDetailResponseSchema,
  JobListResponseSchema,
  validateResponse,
  type Job,
} from "@/app/lib/api_schemas";
import { normalizeJob, parsePageResponse } from "@/app/lib/job_list_response";
import { reportApiResponse } from "@/app/lib/errorReporter";
import {
  canApprove,
  canClaimAutoRelease,
  canFund,
  canMarkDelivered,
  canResolveDispute,
  milestoneClaimEligibility,
  type MilestoneLike,
} from "@/app/lib/milestone_actions";

export type NeedsActionRole = "client" | "freelancer" | "arbiter";

export type NeedsActionKind =
  "fund" | "review_delivery" | "deliver" | "claim_auto_release" | "resolve_dispute";

export interface NeedsActionItem {
  /** Stable React key. */
  key: string;
  jobId: string;
  /** Milestone to open, or null for job-level actions (funding). */
  milestoneIndex: number | null;
  role: NeedsActionRole;
  kind: NeedsActionKind;
  /** Epoch ms (ledger time) the action is due by, or null when there is none. */
  deadlineMs: number | null;
}

/** Auto-release deadlines per job, as returned by `fetchAllAutoReleaseDeadlines`. */
export type JobDeadlines = Record<string, Record<number, number | null>>;

export const NEEDS_ACTION_LABELS: Record<NeedsActionKind, string> = {
  fund: "Fund escrow",
  review_delivery: "Review delivery",
  deliver: "Deliver milestone",
  claim_auto_release: "Claim auto-release",
  resolve_dispute: "Resolve dispute",
};

function milestonesOf(job: Job): MilestoneLike[] {
  return Array.isArray(job.milestones) ? (job.milestones as MilestoneLike[]) : [];
}

/** Pending actions on one job for `address`. */
export function deriveJobActions(
  job: Job,
  address: string,
  { now, deadlines = {} }: { now: number; deadlines?: Record<number, number | null> }
): NeedsActionItem[] {
  if (!address) return [];
  const isClient = job.client === address;
  const isFreelancer = job.freelancer === address;
  const isArbiter = job.arbiter === address;
  const items: NeedsActionItem[] = [];

  const push = (
    role: NeedsActionRole,
    kind: NeedsActionKind,
    milestoneIndex: number | null,
    deadlineMs: number | null
  ) => {
    items.push({
      key: `${job.id}:${milestoneIndex ?? "job"}:${kind}`,
      jobId: job.id,
      milestoneIndex,
      role,
      kind,
      deadlineMs,
    });
  };

  if (canFund(job, isClient)) push("client", "fund", null, null);

  for (const milestone of milestonesOf(job)) {
    const backendDeadline = deadlines[milestone.index];

    if (canApprove(milestone, isClient)) {
      const { deadlineMs } = milestoneClaimEligibility(milestone, backendDeadline, now);
      push("client", "review_delivery", milestone.index, deadlineMs);
    }
    // Nothing can be delivered until the client has funded the escrow.
    if (job.funded && canMarkDelivered(milestone, isFreelancer)) {
      push("freelancer", "deliver", milestone.index, null);
    }
    if (canClaimAutoRelease(milestone, isFreelancer, backendDeadline, now)) {
      const { deadlineMs } = milestoneClaimEligibility(milestone, backendDeadline, now);
      push("freelancer", "claim_auto_release", milestone.index, deadlineMs);
    }
    if (canResolveDispute(milestone, isArbiter)) {
      push("arbiter", "resolve_dispute", milestone.index, null);
    }
  }

  return items;
}

/** Earliest deadline first; actions without a deadline after, in job order. */
export function sortNeedsActions(items: NeedsActionItem[]): NeedsActionItem[] {
  return items
    .map((item, order) => ({ item, order }))
    .sort((a, b) => {
      const da = a.item.deadlineMs;
      const db = b.item.deadlineMs;
      if (da !== null && db !== null && da !== db) return da - db;
      if (da === null && db !== null) return 1;
      if (da !== null && db === null) return -1;
      return a.order - b.order;
    })
    .map(({ item }) => item);
}

/** Every pending action for `address` across `jobs`, sorted by deadline. */
export function deriveNeedsActions(
  jobs: Job[],
  address: string,
  { now, deadlines = {} }: { now: number; deadlines?: JobDeadlines }
): NeedsActionItem[] {
  return sortNeedsActions(
    jobs.flatMap((job) => deriveJobActions(job, address, { now, deadlines: deadlines[job.id] }))
  );
}

// =============================================================================
// Loading
// =============================================================================

const LIST_PAGE_SIZE = 50;
const MAX_LIST_PAGES = 10;
const DETAIL_CONCURRENCY = 4;

/** A job whose every milestone is released has nothing left to do. */
function isSettled(job: Job): boolean {
  return (
    job.funded &&
    typeof job.milestoneCount === "number" &&
    job.milestoneCount > 0 &&
    job.releasedCount === job.milestoneCount
  );
}

async function fetchJson(url: string, route: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal });
  reportApiResponse(res, route);
  if (res.ok === false) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Every job summary for `address`, across pages. */
async function fetchAllJobSummaries(address: string, signal?: AbortSignal): Promise<Job[]> {
  const jobs: Job[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
    const raw = await fetchJson(
      `${BACKEND_URL}/api/jobs/by-wallet/${encodeURIComponent(address)}?page=${page}&limit=${LIST_PAGE_SIZE}`,
      "/api/jobs/by-wallet/:address",
      signal
    );
    const data = validateResponse(JobListResponseSchema, raw, `/api/jobs/by-wallet/${address}`);
    if (data.success === false) throw new Error(data.error || "Failed to fetch jobs");
    const parsed = parsePageResponse(data);
    let added = 0;
    for (const job of parsed.jobs) {
      if (seen.has(job.id)) continue;
      seen.add(job.id);
      jobs.push(job);
      added += 1;
    }
    if (added === 0 || parsed.jobs.length < LIST_PAGE_SIZE || jobs.length >= parsed.total) break;
  }
  return jobs;
}

async function fetchJobDetail(jobId: string, signal?: AbortSignal): Promise<Job | null> {
  const raw = await fetchJson(
    `${BACKEND_URL}/api/jobs/${encodeURIComponent(jobId)}`,
    "/api/jobs/:contractId",
    signal
  );
  const payload = validateResponse(JobDetailResponseSchema, raw, `/api/jobs/${jobId}`);
  return normalizeJob(payload.data);
}

/** Runs `fn` over `items`, at most `limit` at a time. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Loads every job for `address` with its milestones and auto-release
 * deadlines, then derives the pending actions. A job whose detail can't be
 * loaded is skipped rather than failing the whole list.
 */
export async function loadNeedsActions(
  address: string,
  { signal, now = Date.now }: { signal?: AbortSignal; now?: () => number } = {}
): Promise<{ items: NeedsActionItem[]; jobs: Job[] }> {
  const summaries = (await fetchAllJobSummaries(address, signal)).filter((j) => !isSettled(j));

  const details = await mapLimit(summaries, DETAIL_CONCURRENCY, async (summary) => {
    try {
      const detail = await fetchJobDetail(summary.id, signal);
      return detail ? { ...summary, ...detail } : null;
    } catch (err) {
      if (signal?.aborted) throw err;
      return null;
    }
  });
  const jobs = details.filter((job): job is Job => job !== null);

  const deadlines: JobDeadlines = {};
  await mapLimit(jobs, DETAIL_CONCURRENCY, async (job) => {
    if (job.client !== address && job.freelancer !== address) return;
    const delivered = milestonesOf(job)
      .filter((m) => m.status === "Delivered")
      .map((m) => m.index);
    if (delivered.length === 0) return;
    try {
      deadlines[job.id] = await fetchAllAutoReleaseDeadlines(job.id, delivered, { signal });
    } catch {
      // Fall back to the on-chain fields, or an unknown deadline.
    }
  });

  return { items: deriveNeedsActions(jobs, address, { now: now(), deadlines }), jobs };
}
