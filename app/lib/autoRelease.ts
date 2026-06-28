import { BACKEND_URL } from "@/app/lib/transactions";

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

interface RawAutoReleaseResponse {
  success?: boolean;
  data?: {
    // The backend may express the deadline in any of these shapes; we accept
    // whichever is present and normalize to epoch ms.
    deadline?: number | string;
    autoReleaseAt?: number | string;
    secondsRemaining?: number;
    eligible?: boolean;
  };
  error?: string;
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
 * Fetch the auto-release deadline for a milestone from the backend.
 *
 * Endpoint: GET `${BACKEND_URL}/api/jobs/:jobId/milestones/:index/auto-release`
 *
 * Returns `{ deadlineMs: null, eligible: false }` on any error or missing data
 * so callers can render gracefully without a timer rather than throwing.
 */
export async function fetchAutoReleaseInfo(
  jobId: string,
  milestoneIndex: number,
  options?: { signal?: AbortSignal; now?: () => number },
): Promise<AutoReleaseInfo> {
  const now = options?.now ?? Date.now;
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/jobs/${encodeURIComponent(jobId)}/milestones/${milestoneIndex}/auto-release`,
      { signal: options?.signal },
    );
    if (!res.ok) {
      return { deadlineMs: null, eligible: false };
    }

    const body = (await res.json()) as RawAutoReleaseResponse;
    const data = body.data ?? {};

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
