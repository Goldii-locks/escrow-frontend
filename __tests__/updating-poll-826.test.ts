/**
 * Tests for issue #826: the post-action "Updating…" poll must keep going
 * until the indexer actually reflects the transaction, not merely until a
 * refetch succeeds.
 *
 * The poll now compares the job's update fingerprint (latestLedger /
 * releasedCount / funded — see jobUpdateFingerprint in
 * app/(app)/dashboard/page.tsx) captured before the action with the value
 * from each refetch, and stops only when it changed or the 2-minute
 * deadline passed.
 *
 * This is an isolated unit test of the poll logic (replicated from the
 * dashboard) using fake timers, like __tests__/indexer-stale-670.test.ts.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

interface FakeJob {
  id: string;
  latestLedger?: number;
  releasedCount?: number;
  funded?: boolean;
}

interface JobsPage {
  jobs: FakeJob[];
  page: number;
  limit: number;
  total: number;
}

/** Same fingerprint as jobUpdateFingerprint in the dashboard. */
function jobUpdateFingerprint(job: FakeJob): string {
  return `${job.latestLedger ?? ""}:${job.releasedCount ?? ""}:${job.funded ? 1 : 0}`;
}

function pageOf(jobs: FakeJob[]): JobsPage {
  return { jobs, page: 1, limit: 5, total: jobs.length };
}

/**
 * A stripped-down replica of the fixed startUpdatingPoll logic from
 * app/(app)/dashboard/page.tsx: the caller passes the pre-action
 * fingerprint and a fetchJobsData that returns the parsed page.
 */
function makeUpdatingPoller(opts?: { maxMs?: number; backoff?: number[] }) {
  const MAX_POLL_DURATION_MS = opts?.maxMs ?? 120_000;
  const BACKOFF_STEPS_MS = opts?.backoff ?? [2_000, 4_000, 8_000, 15_000];

  const updatingIds = new Set<string>();
  const pollers = new Map<string, () => void>();

  function startUpdatingPoll(
    jobId: string,
    preActionFingerprint: string,
    fetchJobsData: () => Promise<JobsPage | null>,
    now: () => number = Date.now
  ) {
    pollers.get(jobId)?.();
    updatingIds.add(jobId);

    const startedAt = now();
    let stepIndex = 0;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const stop = () => {
      cancelled = true;
      if (timerId !== null) clearTimeout(timerId);
      pollers.delete(jobId);
      updatingIds.delete(jobId);
    };

    const scheduleNext = () => {
      if (cancelled) return;
      if (now() - startedAt >= MAX_POLL_DURATION_MS) {
        stop();
        return;
      }
      const delay = BACKOFF_STEPS_MS[Math.min(stepIndex, BACKOFF_STEPS_MS.length - 1)];
      stepIndex += 1;
      timerId = setTimeout(async () => {
        if (cancelled) return;
        try {
          const result = await fetchJobsData();
          const updatedJob = result?.jobs.find((j) => j.id === jobId) ?? null;
          const newFingerprint = updatedJob ? jobUpdateFingerprint(updatedJob) : null;
          if (newFingerprint !== null && newFingerprint !== preActionFingerprint) {
            stop();
          } else {
            scheduleNext();
          }
        } catch {
          scheduleNext();
        }
      }, delay);
    };

    scheduleNext();
    pollers.set(jobId, stop);
  }

  return { startUpdatingPoll, updatingIds, pollers };
}

const BASE_JOB: FakeJob = { id: "job-1", latestLedger: 1000, releasedCount: 1, funded: true };

describe("Issue #826 – updating poll stops only when the indexer caught up", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the Updating… badge while the job is unchanged across three polls, then clears on the change", async () => {
    const { startUpdatingPoll, updatingIds } = makeUpdatingPoller({
      backoff: [500, 500, 500, 500],
    });

    let call = 0;
    const fetchJobsData = vi.fn().mockImplementation(async (): Promise<JobsPage> => {
      call += 1;
      // Polls 1–3: the indexer still shows the pre-action state.
      // Poll 4: the ledger moved — the indexer caught up.
      const job =
        call <= 3 ? { ...BASE_JOB } : { ...BASE_JOB, latestLedger: 1001, releasedCount: 2 };
      return pageOf([job]);
    });

    startUpdatingPoll("job-1", jobUpdateFingerprint(BASE_JOB), fetchJobsData);

    // Poll 1 — unchanged.
    await vi.advanceTimersByTimeAsync(600);
    expect(fetchJobsData).toHaveBeenCalledTimes(1);
    expect(updatingIds.has("job-1")).toBe(true);

    // Poll 2 — unchanged.
    await vi.advanceTimersByTimeAsync(600);
    expect(fetchJobsData).toHaveBeenCalledTimes(2);
    expect(updatingIds.has("job-1")).toBe(true);

    // Poll 3 — unchanged.
    await vi.advanceTimersByTimeAsync(600);
    expect(fetchJobsData).toHaveBeenCalledTimes(3);
    expect(updatingIds.has("job-1")).toBe(true);

    // Poll 4 — the fingerprint changed: the badge clears.
    await vi.advanceTimersByTimeAsync(600);
    expect(fetchJobsData).toHaveBeenCalledTimes(4);
    expect(updatingIds.has("job-1")).toBe(false);
  });

  it("stops at the 2-minute deadline when the job never changes", async () => {
    const { startUpdatingPoll, updatingIds } = makeUpdatingPoller({
      maxMs: 2_000,
      backoff: [500],
    });

    const fetchJobsData = vi
      .fn()
      .mockImplementation(async (): Promise<JobsPage> => pageOf([{ ...BASE_JOB }]));

    // Mutable clock so we can cross the deadline.
    let fakeNow = 0;
    startUpdatingPoll("job-1", jobUpdateFingerprint(BASE_JOB), fetchJobsData, () => fakeNow);

    fakeNow = 2_500;
    await vi.advanceTimersByTimeAsync(2_500);

    expect(fetchJobsData.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(updatingIds.has("job-1")).toBe(false);
  });

  it("keeps polling when the refetch throws or returns null", async () => {
    const { startUpdatingPoll, updatingIds } = makeUpdatingPoller({
      backoff: [500, 500],
    });

    let call = 0;
    const fetchJobsData = vi.fn().mockImplementation(async (): Promise<JobsPage | null> => {
      call += 1;
      if (call === 1) throw new Error("network down");
      if (call === 2) return null; // 429 / stale response
      return pageOf([{ ...BASE_JOB, latestLedger: 1002 }]);
    });

    startUpdatingPoll("job-1", jobUpdateFingerprint(BASE_JOB), fetchJobsData);

    await vi.advanceTimersByTimeAsync(600);
    expect(updatingIds.has("job-1")).toBe(true);

    await vi.advanceTimersByTimeAsync(600);
    expect(updatingIds.has("job-1")).toBe(true);

    await vi.advanceTimersByTimeAsync(600);
    expect(fetchJobsData).toHaveBeenCalledTimes(3);
    expect(updatingIds.has("job-1")).toBe(false);
  });

  it("keeps polling while the job is missing from the current page", async () => {
    const { startUpdatingPoll, updatingIds } = makeUpdatingPoller({
      maxMs: 10_000,
      backoff: [500, 500],
    });

    let call = 0;
    const fetchJobsData = vi.fn().mockImplementation(async (): Promise<JobsPage> => {
      call += 1;
      // The target job is on a different page than the one fetched.
      if (call === 1) return pageOf([]);
      return pageOf([{ ...BASE_JOB, latestLedger: 1003 }]);
    });

    startUpdatingPoll("job-1", jobUpdateFingerprint(BASE_JOB), fetchJobsData);

    await vi.advanceTimersByTimeAsync(600);
    expect(updatingIds.has("job-1")).toBe(true);

    await vi.advanceTimersByTimeAsync(600);
    expect(updatingIds.has("job-1")).toBe(false);
  });
});
