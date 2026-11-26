import { BACKEND_URL } from "@/app/lib/transactions";
import { AutoReleaseResponseSchema, validateResponse } from "@/app/lib/api_schemas";

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

/**
 * Read the backend's remaining seconds for one milestone. The UI receives an
 * absolute deadline in epoch milliseconds.
 */
export async function fetchAutoReleaseInfo(
  jobId: string,
  milestoneIndex: number,
  { signal, now = Date.now }: { signal?: AbortSignal; now?: () => number } = {}
): Promise<AutoReleaseInfo> {
  const endpoint = `/api/jobs/${encodeURIComponent(jobId)}/milestones/${milestoneIndex}/time-remaining`;
  try {
    const res = await fetch(`${BACKEND_URL}${endpoint}`, { signal });
    if (!res.ok) return { deadlineMs: null, eligible: false };

    const { data } = validateResponse(AutoReleaseResponseSchema, await res.json(), endpoint);
    return {
      deadlineMs: now() + data.secondsRemaining * 1000,
      eligible: data.secondsRemaining === 0,
    };
  } catch {
    return { deadlineMs: null, eligible: false };
  }
}
