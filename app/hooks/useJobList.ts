"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { apiGet, ApiRateLimitError } from "@/app/lib/api";
import { JobListResponseSchema, parsePageResponse, type Job } from "@/app/lib/api_schemas";

export type RoleFilter = "all" | "client" | "freelancer" | "arbiter";

const LIST_LIMIT = 5;
const BASE_INTERVAL_MS = 30_000;

export interface UseJobListProps {
  address: string | null;
  page: number;
  roleFilter: RoleFilter;
}

export interface UseJobListReturn {
  jobs: Job[];
  total: number;
  /** Effective page: the server-reported page when present, else the requested page. */
  page: number;
  fetchLoading: boolean;
  error: string | null;
  /** Re-run the list fetch (e.g. retry / after an action). */
  refetch: () => Promise<void>;
}

/**
 * Fetches the paginated job list for a wallet address with abort, request-ID
 * deduplication, identical-data backoff and a 30 s visibility-aware poll.
 */
export function useJobList({ address, page }: UseJobListProps): UseJobListReturn {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [serverPage, setServerPage] = useState(page);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** AbortController for the in-flight fetchJobs request. */
  const jobsAbortRef = useRef<AbortController | null>(null);
  /** Monotonically-increasing counter; stale responses are dropped. */
  const jobsRequestIdRef = useRef(0);
  /** Rolling window of the last 3 fetchJobs response fingerprints. */
  const jobsResponseHistory = useRef<string[]>([]);
  /** Current poll interval multiplier (1 = 30 s … 4 = 120 s). */
  const pollBackoffRef = useRef(1);

  const fetchJobs = useCallback(async () => {
    if (!address) {
      setFetchLoading(false);
      setJobs([]);
      return;
    }

    // Abort any in-flight request and issue a fresh one.
    jobsAbortRef.current?.abort();
    const controller = new AbortController();
    jobsAbortRef.current = controller;

    // Capture the sequence number for this request.
    jobsRequestIdRef.current += 1;
    const requestId = jobsRequestIdRef.current;

    setFetchLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIST_LIMIT),
      });

      const data = await apiGet(
        `/api/jobs/by-wallet/${encodeURIComponent(address)}?${params.toString()}`,
        JobListResponseSchema,
        { signal: controller.signal, envelope: "none" }
      );

      // Drop stale responses (a newer request already completed).
      if (requestId !== jobsRequestIdRef.current) return;

      if (data.success === false) {
        setError(data.error || "Failed to fetch jobs");
        setJobs([]);
        setTotal(0);
        return;
      }

      if (data.success !== true) {
        setError("Unexpected response from server");
        setJobs([]);
        setTotal(0);
        return;
      }

      const parsed = parsePageResponse(data);

      // Clear error only on a successful fetch so the Retry button stays
      // visible (and disabled) while the request is in flight (#682).
      setError(null);

      // ── Identical-data backoff (#581) ──────────────────────────────────
      const fingerprint = `${parsed.total}:${parsed.jobs[0]?.id ?? ""}:${parsed.jobs[parsed.jobs.length - 1]?.id ?? ""}`;
      const history = jobsResponseHistory.current;
      history.push(fingerprint);
      if (history.length > 3) history.shift();

      const allIdentical = history.length === 3 && history.every((h) => h === history[0]);
      if (allIdentical) {
        pollBackoffRef.current = Math.min(pollBackoffRef.current + 1, 4);
      } else {
        pollBackoffRef.current = 1;
      }
      // ──────────────────────────────────────────────────────────────────

      setJobs(parsed.jobs);
      setServerPage(parsed.page ?? page);
      setTotal(parsed.total);
    } catch (err: unknown) {
      // Ignore aborted-request errors — they're intentional.
      if (err instanceof Error && err.name === "AbortError") return;
      if (err instanceof ApiRateLimitError) {
        setError("You're doing that too fast. Please wait a moment and try again.");
        setJobs([]);
        setTotal(0);
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to connect to backend");
      setJobs([]);
      setTotal(0);
    } finally {
      // Only clear the loading flag if this response is still current.
      if (requestId === jobsRequestIdRef.current) {
        setFetchLoading(false);
      }
    }
  }, [address, page]);

  // Fetch on mount and whenever address/page change. Role filtering is client-side.
  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  // ── 30 s visibility-aware poll with backoff ──────────────────────────
  useEffect(() => {
    if (!address) return;

    const tick = () => {
      void fetchJobs();
    };

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startInterval = () => {
      if (intervalId !== null) return;
      const delay = BASE_INTERVAL_MS * pollBackoffRef.current;
      intervalId = setInterval(() => {
        const expectedDelay = BASE_INTERVAL_MS * pollBackoffRef.current;
        tick();
        if (intervalId !== null && expectedDelay !== delay) {
          clearInterval(intervalId);
          intervalId = null;
          startInterval();
        }
      }, delay);
    };

    const stopInterval = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopInterval();
      } else {
        tick();
        startInterval();
      }
    };

    if (document.visibilityState !== "hidden") {
      startInterval();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [address, fetchJobs]);
  // ───────────────────────────────────────────────────────────────────

  return {
    jobs,
    total,
    page: serverPage,
    fetchLoading,
    error,
    refetch: fetchJobs,
  };
}
