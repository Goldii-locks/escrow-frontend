import { BACKEND_URL } from "@/app/lib/transactions";
import { fetchAutoReleaseInfo } from "@/app/lib/autoRelease";

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
    const res = await fetch(`${BACKEND_URL}/api/jobs/${encodeURIComponent(jobId)}/deadlines`, {
      signal: options?.signal,
    });

    if (res.ok) {
      interface BatchResponse {
        success?: boolean;
        data?: { deadlines?: Record<string, number | null> };
        error?: string;
      }
      const body = (await res.json()) as BatchResponse;
      const rawDeadlines = body.data?.deadlines ?? {};
      const result: Record<number, number | null> = {};

      for (const index of milestoneIndexes) {
        const raw = rawDeadlines[String(index)];
        result[index] = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
      }

      return result;
    }
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
