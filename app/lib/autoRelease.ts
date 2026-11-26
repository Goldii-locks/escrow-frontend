import { z } from "zod";
import { apiGet } from "@/app/lib/api";
import { AutoReleaseResponseDataSchema } from "@/app/lib/api_schemas";

const BatchDeadlinesSchema = z
  .object({
    deadlines: z
      .record(z.string(), z.union([z.number(), z.string(), z.null()]))
      .optional(),
  })
  .passthrough();

/**
 * Auto-release timing for a single milestone, normalized to an absolute
 * deadline in epoch milliseconds so UI components (e.g. CountdownTimer) don't
 * have to reason about clock skew or relative units.
 */
export interface AutoReleaseInfo {
  /** Absolute deadline in epoch ms, or null if the milestone has no timer. */
  deadlineMs: number | null;
  /** True once the deadline has passed and the milestone can be auto-released. */
  eligible: boolean;
}

function toEpochMs(value: number | string): number | null {
  if (typeof value === "number") {
    // Heuristic: treat 10-digit values as seconds, 13-digit as milliseconds.
    return value < 1e12 ? value * 1000 : value;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Fetch auto-release deadlines for all delivered milestones in one request.
 *
 * Endpoint: GET `${BACKEND_URL}/api/jobs/:jobId/deadlines`
 * Expected response shape:
 *   { success: true, data: { deadlines: { [milestoneIndex: number]: number | null } } }
 *
 * Falls back to the individual per-milestone endpoint if the batch endpoint
 * returns a non-OK status, so the UI degrades gracefully when the backend
 * hasn't deployed the new route yet.
 *
 * Returns a map of milestoneIndex → deadlineMs (or null).
 */
export async function fetchAllAutoReleaseDeadlines(
  jobId: string,
  milestoneIndexes: number[],
  options?: { signal?: AbortSignal; now?: () => number }
): Promise<Record<number, number | null>> {
  if (milestoneIndexes.length === 0) return {};

  // Try the batch endpoint first (one request for all milestones).
  try {
    const body = await apiGet(
      `/api/jobs/${encodeURIComponent(jobId)}/deadlines`,
      BatchDeadlinesSchema,
      { signal: options?.signal }
    );
    const rawDeadlines = body.deadlines ?? {};
    const result: Record<number, number | null> = {};

    for (const index of milestoneIndexes) {
      const raw = rawDeadlines[String(index)];
      if (raw === null || raw === undefined) {
        result[index] = null;
      } else {
        result[index] = toEpochMs(raw);
      }
    }
    return result;
  } catch {
    // Fall through to individual fetches on network or parse error.
    if (options?.signal?.aborted) return {};
  }

  // Fallback: fetch each milestone individually (original N+1 behaviour).
  // This keeps the app working if the backend hasn't shipped the batch route.
  const entries = await Promise.all(
    milestoneIndexes.map(async (index) => {
      const info = await fetchAutoReleaseInfo(jobId, index, options);
      return [index, info.deadlineMs] as const;
    })
  );
  return Object.fromEntries(entries);
}
/**
 * Fetch the auto-release deadline for a milestone from the backend.
 *
 * Endpoint: GET `${BACKEND_URL}/api/jobs/:jobId/milestones/:index/auto-release`
 *
 * Validates the response with Zod so an unexpected backend shape is caught
 * explicitly (ApiShapeError) instead of silently ignoring a missing deadline.
 * Returns `{ deadlineMs: null, eligible: false }` on any error or missing data
 * so callers can render gracefully without a timer rather than throwing.
 */
export async function fetchAutoReleaseInfo(
  jobId: string,
  milestoneIndex: number,
  options?: { signal?: AbortSignal; now?: () => number }
): Promise<AutoReleaseInfo> {
  const now = options?.now ?? Date.now;
  try {
    const data = await apiGet(
      `/api/jobs/${encodeURIComponent(jobId)}/milestones/${milestoneIndex}/auto-release`,
      AutoReleaseResponseDataSchema,
      { signal: options?.signal }
    );

    let deadlineMs: number | null = null;
    if (data.deadline !== undefined) {
      deadlineMs = toEpochMs(data.deadline);
    } else if (data.autoReleaseAt !== undefined) {
      deadlineMs = toEpochMs(data.autoReleaseAt);
    } else if (typeof data.secondsRemaining === "number") {
      deadlineMs = now() + data.secondsRemaining * 1000;
    }

    const eligible =
      typeof data.eligible === "boolean"
        ? data.eligible
        : deadlineMs !== null && deadlineMs <= now();

    return { deadlineMs, eligible };
  } catch {
    return { deadlineMs: null, eligible: false };
  }
}
