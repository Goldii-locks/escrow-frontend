/**
 * Tests for issue #670: indexer-stale "Updating…" indicator after actions.
 *
 * Acceptance criteria (updated for issue #826): the row shows "Updating…"
 * until a refetched list response shows the job has actually changed
 * (fingerprint compare), then clears. A refetch that merely succeeds no
 * longer clears the badge.
 *
 * Uses fake timers so the backoff delays don't slow down the test suite.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// ---------------------------------------------------------------------------

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

const BASE_JOB: FakeJob = { id: "job-1", latestLedger: 1000, releasedCount: 1, funded: true };

// ---------------------------------------------------------------------------
// Isolated unit test for the backoff-poll logic (no React/DOM needed)
// ---------------------------------------------------------------------------

/**
 * A stripped-down replica of the startUpdatingPoll logic from
 * app/(app)/dashboard/page.tsx, extracted so we can test it without a full
 * React render. Mirrors the #826 fix: the caller passes the pre-action
 * fingerprint and fetchJobsData returns the parsed page.
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
    // Cancel existing poller for this job.
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
          // Issue #826: stop only when the job fingerprint changed.
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

// ---------------------------------------------------------------------------

describe("Issue #670/#826 – Updating… indicator after actions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows Updating… immediately after startUpdatingPoll is called", () => {
    const { startUpdatingPoll, updatingIds } = makeUpdatingPoller();
    const fetchJobsData = vi.fn().mockResolvedValue(pageOf([{ ...BASE_JOB }]));

    startUpdatingPoll("job-1", jobUpdateFingerprint(BASE_JOB), fetchJobsData);

    expect(updatingIds.has("job-1")).toBe(true);
  });

  it("does NOT clear Updating… after a refetch that still shows the old state", async () => {
    const { startUpdatingPoll, updatingIds } = makeUpdatingPoller({
      maxMs: 30_000,
      backoff: [500, 500, 500],
    });
    const fetchJobsData = vi
      .fn()
      .mockImplementation(async (): Promise<JobsPage> => pageOf([{ ...BASE_JOB }]));

    startUpdatingPoll("job-1", jobUpdateFingerprint(BASE_JOB), fetchJobsData);

    // Advance past three backoff delays — the job never changed.
    await vi.advanceTimersByTimeAsync(1_700);

    expect(fetchJobsData).toHaveBeenCalledTimes(3);
    expect(updatingIds.has("job-1")).toBe(true);
  });

  it("clears Updating… once the refetched job state changed", async () => {
    const { startUpdatingPoll, updatingIds } = makeUpdatingPoller({
      backoff: [500],
    });
    const fetchJobsData = vi
      .fn()
      .mockImplementation(async (): Promise<JobsPage> =>
        pageOf([{ ...BASE_JOB, latestLedger: 1001, releasedCount: 2 }])
      );

    startUpdatingPoll("job-1", jobUpdateFingerprint(BASE_JOB), fetchJobsData);

    // Advance past the first backoff delay.
    await vi.advanceTimersByTimeAsync(600);

    expect(fetchJobsData).toHaveBeenCalledTimes(1);
    expect(updatingIds.has("job-1")).toBe(false);
  });

  it("keeps Updating… and retries when the refetch rejects, then stops on the change", async () => {
    const { startUpdatingPoll, updatingIds } = makeUpdatingPoller({
      backoff: [500, 500, 500],
    });

    let callCount = 0;
    const fetchJobsData = vi.fn().mockImplementation(async (): Promise<JobsPage> => {
      callCount += 1;
      if (callCount < 3) throw new Error("indexer not ready");
      return pageOf([{ ...BASE_JOB, latestLedger: 1002 }]);
    });

    startUpdatingPoll("job-1", jobUpdateFingerprint(BASE_JOB), fetchJobsData);

    // After first delay — still failing.
    await vi.advanceTimersByTimeAsync(600);
    expect(updatingIds.has("job-1")).toBe(true);

    // After second delay — still failing.
    await vi.advanceTimersByTimeAsync(600);
    expect(updatingIds.has("job-1")).toBe(true);

    // After third delay — succeeds with a changed job.
    await vi.advanceTimersByTimeAsync(600);
    expect(updatingIds.has("job-1")).toBe(false);
    expect(fetchJobsData).toHaveBeenCalledTimes(3);
  });

  it("automatically stops after the max poll duration (2 minutes)", async () => {
    const { startUpdatingPoll, updatingIds } = makeUpdatingPoller({
      maxMs: 5_000,
      backoff: [1_000],
    });

    // The job never changes — only the deadline can clear the badge.
    const fetchJobsData = vi
      .fn()
      .mockImplementation(async (): Promise<JobsPage> => pageOf([{ ...BASE_JOB }]));

    // Use a mutable clock to control what now() returns.
    let fakeNow = 0;
    startUpdatingPoll("job-1", jobUpdateFingerprint(BASE_JOB), fetchJobsData, () => fakeNow);

    // Advance past max duration.
    fakeNow = 6_000;
    await vi.advanceTimersByTimeAsync(6_000);

    // The indicator is cleared by the deadline even though nothing changed.
    expect(updatingIds.has("job-1")).toBe(false);
  });

  it("cancels the previous poll when startUpdatingPoll is called again for same job", async () => {
    const { startUpdatingPoll, updatingIds } = makeUpdatingPoller({
      backoff: [500],
    });

    const firstFetch = vi.fn().mockImplementation(
      () =>
        new Promise<JobsPage>(() => {
          /* never resolves */
        })
    );
    const secondFetch = vi
      .fn()
      .mockImplementation(async (): Promise<JobsPage> =>
        pageOf([{ ...BASE_JOB, latestLedger: 1004 }])
      );

    startUpdatingPoll("job-1", jobUpdateFingerprint(BASE_JOB), firstFetch);
    // Immediately call again — cancels the first poller.
    startUpdatingPoll("job-1", jobUpdateFingerprint(BASE_JOB), secondFetch);

    await vi.advanceTimersByTimeAsync(600);

    // First fetch was never awaited to completion (its timer was cancelled).
    expect(firstFetch).not.toHaveBeenCalled();
    // Second fetch runs normally and shows a changed job.
    expect(secondFetch).toHaveBeenCalledTimes(1);
    expect(updatingIds.has("job-1")).toBe(false);
  });
});
