/**
 * Normalisation of the backend's job list and job detail payloads into
 * `Job`s. Shared by the dashboard list and the "Needs your action" panel
 * (#888) so both read the same shapes the same way.
 */
import { JobListResponseSchema, JobSchema, type Job } from "@/app/lib/api_schemas";

/** snake_case fields the by-wallet summary sends, mapped to the Job schema (#638). */
const SUMMARY_FIELD_ALIASES: Record<string, string> = {
  contract_id: "id",
  milestone_count: "milestoneCount",
  released_count: "releasedCount",
  latest_event_type: "latestEventType",
  latest_event_at: "latestEventAt",
  latest_ledger: "latestLedger",
};

/**
 * Normalises raw (unknown-typed) data from the backend into a `Job`.
 * Uses Zod's `safeParse` so that a bad shape never silently produces
 * empty data — it returns `null` so the caller can show an error or fall
 * back gracefully.
 */
export function normalizeJob(item: unknown): Job | null {
  let input = item;
  if (typeof item === "object" && item !== null && !Array.isArray(item)) {
    const mapped: Record<string, unknown> = { ...(item as Record<string, unknown>) };
    for (const [from, to] of Object.entries(SUMMARY_FIELD_ALIASES)) {
      if (mapped[to] === undefined && mapped[from] !== undefined) mapped[to] = mapped[from];
    }
    input = mapped;
  }
  const result = JobSchema.safeParse(input);
  return result.success ? result.data : null;
}

/** Reads every known job-list envelope into one shape. */
export function parsePageResponse(payload: ReturnType<typeof JobListResponseSchema.parse>): {
  jobs: Job[];
  page: number;
  limit: number;
  total: number;
} {
  const fallback = { jobs: [] as Job[], page: 1, limit: 5, total: 0 };

  if (!payload || payload.success === false) {
    return fallback;
  }

  let rows: unknown[] = [];
  let page = payload.page ?? payload.pagination?.page ?? 1;
  let limit = payload.limit ?? payload.pagination?.limit ?? 5;
  let total = payload.total ?? payload.totalItems ?? payload.pagination?.total ?? 0;

  if (Array.isArray(payload.data)) {
    rows = payload.data;
  } else if (payload.data && typeof payload.data === "object") {
    const embedded = payload.data as Record<string, unknown>;
    if (Array.isArray(embedded.jobs)) {
      rows = embedded.jobs;
    } else if (Array.isArray(embedded.items)) {
      rows = embedded.items;
    } else if (typeof embedded.id === "string") {
      rows = [embedded];
      page = 1;
      limit = 1;
      total = 1;
    }

    if (typeof embedded.page === "number") page = embedded.page;
    if (typeof embedded.limit === "number") limit = embedded.limit;
    if (typeof embedded.total === "number") total = embedded.total;
    if (typeof embedded.totalItems === "number") total = embedded.totalItems;
  }

  const jobs = rows.map(normalizeJob).filter((job): job is Job => job !== null);

  return {
    jobs,
    page,
    limit,
    total: total || jobs.length,
  };
}
