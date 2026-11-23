/**
 * Tests for issue #670: indexer-stale "Updating…" indicator after actions.
 *
 * Acceptance criteria: the row shows "Updating…" until a mocked list
 * response arrives (fetchJobs resolves), then clears.
 *
 * Uses fake timers so the backoff delays don't slow down the test suite.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Isolated unit test for the backoff-poll logic (no React/DOM needed)
// ---------------------------------------------------------------------------

/**
 * A stripped-down replica of the startUpdatingPoll logic from
 * app/dashboard/page.tsx, extracted so we can test it without a full
 * React render.
 */
function makeUpdatingPoller(opts?: { maxMs?: number; backoff?: number[] }) {
  const MAX_POLL_DURATION_MS = opts?.maxMs ?? 120_000;
  const BACKOFF_STEPS_MS = opts?.backoff ?? [2_000, 4_000, 8_000, 15_000];

  const updatingIds = new Set<string>();
  const pollers = new Map<string, () => void>();

  function startUpdatingPoll(
    jobId: string,
    fetchJobs: () => Promise<void>,
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
          await fetchJobs();
          stop();
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

describe("Issue #670 – Updating… indicator after actions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows Updating… immediately after startUpdatingPoll is called", () => {
    const { startUpdatingPoll, updatingIds } = makeUpdatingPoller();
    const fetchJobs = vi.fn().mockResolvedValue(undefined);

    startUpdatingPoll("job-1", fetchJobs);

    expect(updatingIds.has("job-1")).toBe(true);
  });

  it("clears Updating… after the first successful fetchJobs poll", async () => {
    const { startUpdatingPoll, updatingIds } = makeUpdatingPoller({
      backoff: [500],
    });
    const fetchJobs = vi.fn().mockResolvedValue(undefined);

    startUpdatingPoll("job-1", fetchJobs);
    expect(updatingIds.has("job-1")).toBe(true);

    // Advance past the first backoff delay.
    await vi.advanceTimersByTimeAsync(600);

    expect(fetchJobs).toHaveBeenCalledTimes(1);
    expect(updatingIds.has("job-1")).toBe(false);
  });

  it("keeps Updating… and retries when fetchJobs rejects", async () => {
    const { startUpdatingPoll, updatingIds } = makeUpdatingPoller({
      backoff: [500, 1_000],
    });

    let callCount = 0;
    const fetchJobs = vi.fn().mockImplementation(async () => {
      callCount += 1;
      if (callCount < 3) throw new Error("indexer not ready");
    });

    startUpdatingPoll("job-1", fetchJobs);

    // After first delay — still failing.
    await vi.advanceTimersByTimeAsync(600);
    expect(updatingIds.has("job-1")).toBe(true);

    // After second delay — still failing.
    await vi.advanceTimersByTimeAsync(1_100);
    expect(updatingIds.has("job-1")).toBe(true);

    // After third delay — succeeds.
    await vi.advanceTimersByTimeAsync(1_100);
    expect(updatingIds.has("job-1")).toBe(false);
    expect(fetchJobs).toHaveBeenCalledTimes(3);
  });

  it("automatically stops after the max poll duration (2 minutes)", async () => {
    const { startUpdatingPoll, updatingIds } = makeUpdatingPoller({
      maxMs: 5_000,
      backoff: [1_000],
    });

    const fetchJobs = vi.fn().mockRejectedValue(new Error("always fails"));

    // Use a mutable clock to control what now() returns.
    let fakeNow = 0;
    startUpdatingPoll("job-1", fetchJobs, () => fakeNow);

    // Advance past max duration.
    fakeNow = 6_000;
    await vi.advanceTimersByTimeAsync(6_000);

    // Even though fetchJobs always rejected, the indicator is cleared.
    expect(updatingIds.has("job-1")).toBe(false);
  });

  it("cancels the previous poll when startUpdatingPoll is called again for same job", async () => {
    const { startUpdatingPoll, updatingIds } = makeUpdatingPoller({
      backoff: [500],
    });

    const firstFetch = vi.fn().mockImplementation(
      () =>
        new Promise<void>(() => {
          /* never resolves */
        })
    );
    const secondFetch = vi.fn().mockResolvedValue(undefined);

    startUpdatingPoll("job-1", firstFetch);
    // Immediately call again — cancels the first poller.
    startUpdatingPoll("job-1", secondFetch);

    await vi.advanceTimersByTimeAsync(600);

    // First fetch was never awaited to completion (its timer was cancelled).
    expect(firstFetch).not.toHaveBeenCalled();
    // Second fetch runs normally.
    expect(secondFetch).toHaveBeenCalledTimes(1);
    expect(updatingIds.has("job-1")).toBe(false);
  });
});
