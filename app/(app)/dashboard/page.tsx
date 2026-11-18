"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useWallet } from "@/app/context/WalletContext";
import Navbar from "@/app/components/Navbar";
import MilestoneCard from "@/app/components/MilestoneCard";
import CopyButton from "@/app/components/CopyButton";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";
import EmptyStateCard from "@/app/components/EmptyStateCard";
import JobActivityTimeline from "@/app/components/JobActivityTimeline";
import DisputeRaiseModal from "@/app/components/DisputeRaiseModal";
import { ArbiterPanelPlaceholder } from "@/app/components/ArbiterActionPanel";
import { getArbiterJobEmptyState } from "@/app/lib/arbiter_action_panel";
import { useActionStates } from "@/app/hooks/useActionStates";
import { API_BASE, runContractAction, submitContractTransaction } from "@/app/lib/transactions";
import { fetchAllAutoReleaseDeadlines } from "@/app/lib/autoRelease";
import {
  JobListResponseSchema,
  JobDetailResponseSchema,
  JobSchema,
  validateResponse,
  type Job,
} from "@/app/lib/api_schemas";
import { reportApiResponse } from "@/app/lib/errorReporter";
import {
  formatLatestActivity,
  formatMilestoneProgress,
  getCounterparty,
  getJobLabel,
  getJobRoles,
  roleLabel,
  setJobLabel,
  shortAddress,
} from "@/app/lib/job_list_summary";
import { hashDisputeReason } from "@/app/lib/dispute_reason";

type RoleFilter = "all" | "client" | "freelancer" | "arbiter";

/**
 * Normalises raw (unknown-typed) data from the backend into a `Job`.
 * Uses Zod's `safeParse` so that a bad shape never silently produces
 * empty data — it returns `null` so the caller can show an error or fall
 * back gracefully.
 */
/** snake_case fields the by-wallet summary sends, mapped to the Job schema (#638). */
const SUMMARY_FIELD_ALIASES: Record<string, string> = {
  contract_id: "id",
  milestone_count: "milestoneCount",
  released_count: "releasedCount",
  latest_event_type: "latestEventType",
  latest_event_at: "latestEventAt",
  latest_ledger: "latestLedger",
};

function normalizeJob(item: unknown): Job | null {
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

function parsePageResponse(payload: ReturnType<typeof JobListResponseSchema.parse>): {
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

const roleFilterLabels: Array<{ id: RoleFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "client", label: "As Client" },
  { id: "freelancer", label: "As Freelancer" },
  { id: "arbiter", label: "As Arbiter" },
];

/** Base interval for the polling fallback (used when SSE is unavailable). */
const BASE_POLL_INTERVAL_MS = 30_000;

/** SSE reconnect backoff: 1 s → 2 s → 4 s → … capped at 30 s. */
const SSE_RECONNECT_BASE_MS = 1_000;
const SSE_RECONNECT_MAX_MS = 30_000;

/** Shape of a job-update event delivered over the SSE stream (#904). */
type JobUpdateEvent = {
  contractId?: string;
  id?: string;
  type?: string;
};

export default function Dashboard() {
  const { address, signTransaction, connect, isConnecting, registerPendingAction } = useWallet();
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobLabels, setJobLabels] = useState<Record<string, string>>({});
  const [jobDetails, setJobDetails] = useState<Record<string, Job>>({});
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({});
  const [detailsError, setDetailsError] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [limit] = useState(5);
  const [total, setTotal] = useState(0);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeMilestoneIndex, setDisputeMilestoneIndex] = useState<number | null>(null);

  const { getState, isPending, setPhase, setError: setActionError, setTxHash } = useActionStates();

  /**
   * Issue #670: track which job rows are showing "Updating…" after a
   * successful action, while the backend indexer catches up.
   */
  const [updatingJobIds, setUpdatingJobIds] = useState<Set<string>>(new Set());

  /** Active backoff-poll cancel functions, keyed by jobId. */
  const updatingPollerRefs = useRef<Map<string, () => void>>(new Map());

  // ── Polling reliability refs ──────────────────────────────────────────────
  /** AbortController for the in-flight fetchJobs request. */
  const jobsAbortRef = useRef<AbortController | null>(null);
  /** AbortController for the in-flight fetchJobDetails request. */
  const detailsAbortRef = useRef<AbortController | null>(null);
  /** Monotonically-increasing counter; stale responses are dropped. */
  const jobsRequestIdRef = useRef(0);
  const detailsRequestIdRef = useRef(0);
  /** Job whose detail request is the current one. */
  const detailsJobIdRef = useRef<string | null>(null);
  /**
   * Rolling window of the last 3 fetchJobs response fingerprints.
   * We use a cheap JSON-length + first-id hash — good enough to detect
   * "nothing changed" without a full deep-equal.
   */
  const jobsResponseHistory = useRef<string[]>([]);
  /** Current poll interval multiplier (1 = 30 s, 2 = 60 s, 3 = 90 s, cap 4 = 120 s). */
  const pollBackoffRef = useRef(1);
  // ─────────────────────────────────────────────────────────────────────────

  // ── SSE refs (#904) ───────────────────────────────────────────────────────
  /** Whether the SSE stream is currently connected and usable. */
  const sseConnectedRef = useRef(false);
  /** Whether SSE has failed and we've fallen back to polling. */
  const sseFallbackRef = useRef(false);
  /** The active EventSource, if any. */
  const eventSourceRef = useRef<EventSource | null>(null);
  /** Reconnect timer for the SSE stream. */
  const sseReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Current reconnect attempt count (drives backoff). */
  const sseReconnectAttemptRef = useRef(0);
  /** Whether the tab is currently visible. */
  const tabVisibleRef = useRef(true);
  // ─────────────────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil((total || jobs.length || 1) / limit));

  /**
   * Client-side search filter (#684). Filters the loaded jobs by substring
   * across contract ID, counterparty addresses, and token symbol. The
   * backend ignored the old contractId param, so we do this here instead.
   */
  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((job) => {
      const haystack = [job.id, job.client, job.freelancer, job.arbiter, job.tokenSymbol ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [jobs, searchQuery]);

  const isFiltering = searchQuery.trim().length > 0;

  const fetchJobs = useCallback(async () => {
    if (!address) {
      setFetchLoading(false);
      setJobs([]);
      setExpandedJobId(null);
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
        limit: String(limit),
      });

      if (roleFilter !== "all") {
        params.set("role", roleFilter);
      }

      // Search is now handled client-side (#684): the backend ignored the
      // contractId param and only exact 56-char contract IDs could match.
      // We filter the loaded jobs by substring instead.

      const res = await fetch(
        `${API_BASE}/jobs/by-wallet/${encodeURIComponent(address)}?${params.toString()}`,
        { signal: controller.signal }
      );

      // Drop stale responses (a newer request already completed).
      if (requestId !== jobsRequestIdRef.current) return;

      reportApiResponse(res, "/api/v1/jobs/by-wallet/:address");
      if (res.status === 429) {
        setError("You're doing that too fast. Please wait a moment and try again.");
        setJobs([]);
        return;
      }
      const rawData: unknown = await res.json();

      // Drop stale responses again after the body read.
      if (requestId !== jobsRequestIdRef.current) return;

      const endpoint = `/api/v1/jobs/by-wallet/${address}`;
      const data = validateResponse(JobListResponseSchema, rawData, endpoint);

      if (data.success === false) {
        setError(data.error || "Failed to fetch jobs");
        setJobs([]);
        setTotal(0);
        setExpandedJobId(null);
        return;
      }

      // Clear error only on a successful fetch so the Retry button stays
      // visible (and disabled) while the request is in flight (#682).
      setError(null);
      const parsed = parsePageResponse(data);

      // ── Identical-data backoff (#581) ──────────────────────────────────
      // Fingerprint: total count + first job id + last job id (cheap proxy
      // for "the list changed"). Reset backoff on any change.
      const fingerprint = `${parsed.total}:${parsed.jobs[0]?.id ?? ""}:${parsed.jobs[parsed.jobs.length - 1]?.id ?? ""}`;
      const history = jobsResponseHistory.current;
      history.push(fingerprint);
      if (history.length > 3) history.shift();

      const allIdentical = history.length === 3 && history.every((h) => h === history[0]);
      if (allIdentical) {
        // Widen the effective interval (capped at 4× = 120 s).
        pollBackoffRef.current = Math.min(pollBackoffRef.current + 1, 4);
      } else {
        pollBackoffRef.current = 1;
      }
      // ──────────────────────────────────────────────────────────────────

      setJobs(parsed.jobs);
      setPage(parsed.page || page);
      setTotal(parsed.total);

      setExpandedJobId((previous) => {
        if (!parsed.jobs.length) return null;
        if (previous && parsed.jobs.some((job) => job.id === previous)) {
          return previous;
        }
        return parsed.jobs[0].id;
      });
    } catch (err: unknown) {
      // Ignore aborted-request errors — they're intentional.
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to connect to backend");
      setJobs([]);
      setTotal(0);
      setExpandedJobId(null);
    } finally {
      // Only clear the loading flag if this response is still current.
      if (requestId === jobsRequestIdRef.current) {
        setFetchLoading(false);
      }
    }
  }, [address, page, limit, roleFilter]);

  const fetchJobDetails = useCallback(
    async (jobId: string, force = false) => {
      if (!address || !jobId) return;
      if (!force && jobDetails[jobId]) return;

      // Abort any in-flight detail request and issue a fresh one.
      detailsAbortRef.current?.abort();
      const controller = new AbortController();
      detailsAbortRef.current = controller;

      detailsRequestIdRef.current += 1;
      const requestId = detailsRequestIdRef.current;
      detailsJobIdRef.current = jobId;

      setDetailsLoading((current) => ({ ...current, [jobId]: true }));

      try {
        const res = await fetch(`${API_BASE}/jobs/${encodeURIComponent(jobId)}`, {
          signal: controller.signal,
        });

        // Drop stale responses.
        if (requestId !== detailsRequestIdRef.current) return;

        reportApiResponse(res, "/api/v1/jobs/:contractId");
        if (!res.ok) {
          throw new Error(`Failed to load job details: HTTP ${res.status}`);
        }
        const rawPayload: unknown = await res.json();

        if (requestId !== detailsRequestIdRef.current) return;

        const payload = validateResponse(
          JobDetailResponseSchema,
          rawPayload,
          `/api/v1/jobs/${jobId}`
        );
        const candidate = normalizeJob(payload.data);

        if (candidate) {
          setJobDetails((current) => ({ ...current, [jobId]: candidate }));
          setDetailsError((current) => {
            const next = { ...current };
            delete next[jobId];
            return next;
          });
          return;
        }

        throw new Error("Invalid job data received");
      } catch (err) {
        // Ignore intentional aborts.
        if (err instanceof Error && err.name === "AbortError") return;

        const message = err instanceof Error ? err.message : "Failed to load job details";
        setDetailsError((current) => ({ ...current, [jobId]: message }));
      } finally {
        // Clear this job's spinner unless a newer request for the same job
        // is still in flight; a request superseded by another job's fetch
        // must not leave its own spinner stuck.
        if (requestId === detailsRequestIdRef.current || detailsJobIdRef.current !== jobId) {
          setDetailsLoading((current) => ({ ...current, [jobId]: false }));
        }
      }
    },
    [address, jobDetails]
  );

  /**
   * Issue #670: mark a job row as "Updating…" then re-poll the job list with
   * exponential backoff until either the fetch succeeds (indexer caught up)
   * or 2 minutes have elapsed.
   *
   * Backoff sequence: 2 s → 4 s → 8 s → 15 s → 15 s → … (cap at 15 s).
   */
  const startUpdatingPoll = useCallback(
    (jobId: string) => {
      // Cancel any in-flight poll for this job.
      updatingPollerRefs.current.get(jobId)?.();

      setUpdatingJobIds((prev) => {
        const next = new Set(prev);
        next.add(jobId);
        return next;
      });

      const MAX_POLL_DURATION_MS = 120_000;
      const BACKOFF_STEPS_MS = [2_000, 4_000, 8_000, 15_000];
      const startedAt = Date.now();
      let stepIndex = 0;
      let timerId: ReturnType<typeof setTimeout> | null = null;
      let cancelled = false;

      const stop = () => {
        cancelled = true;
        if (timerId !== null) clearTimeout(timerId);
        updatingPollerRefs.current.delete(jobId);
        setUpdatingJobIds((prev) => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
      };

      const scheduleNext = () => {
        if (cancelled) return;
        if (Date.now() - startedAt >= MAX_POLL_DURATION_MS) {
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
      updatingPollerRefs.current.set(jobId, stop);
    },
    [fetchJobs]
  );

  useEffect(() => {
    let active = true;

    Promise.resolve().then(() => {
      if (active) {
        void fetchJobs();
      }
    });

    return () => {
      active = false;
    };
  }, [fetchJobs]);

  useEffect(() => {
    let active = true;

    Promise.resolve().then(() => {
      if (active && expandedJobId) {
        void fetchJobDetails(expandedJobId);
      }
    });

    return () => {
      active = false;
    };
  }, [expandedJobId, fetchJobDetails]);

  /**
   * Polling fallback (#904). Runs only when the SSE stream is unavailable
   * (or has failed). Extracted so the SSE path can reuse the same tick.
   */
  const startPollingFallback = useCallback(() => {
    if (!address) return () => {};

    const tick = () => {
      void fetchJobs();
      if (expandedJobId) {
        void fetchJobDetails(expandedJobId, true);
      }
    };

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startInterval = () => {
      if (intervalId !== null) return; // already running
      const delay = BASE_POLL_INTERVAL_MS * pollBackoffRef.current;
      intervalId = setInterval(() => {
        // Re-read backoff: if it changed since last tick, restart with new delay.
        const expectedDelay = BASE_POLL_INTERVAL_MS * pollBackoffRef.current;
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
        // Tab became visible — fetch immediately then restart the interval.
        tick();
        startInterval();
      }
    };

    // Only poll while the tab is visible.
    if (document.visibilityState !== "hidden") {
      startInterval();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [address, expandedJobId, fetchJobs, fetchJobDetails]);

  /**
   * SSE subscription (#904). Opens one EventSource per tab for the connected
   * wallet's jobs. On an event, refetches only the affected job (and the list
   * summary). Falls back to polling when the stream is unavailable, with
   * reconnect + exponential backoff. Closes the stream while the tab is hidden.
   */
  useEffect(() => {
    if (!address) return;
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      // No EventSource support — use polling.
      sseFallbackRef.current = true;
      return startPollingFallback();
    }

    let disposed = false;
    let fallbackCleanup: (() => void) | null = null;

    const clearReconnectTimer = () => {
      if (sseReconnectTimerRef.current !== null) {
        clearTimeout(sseReconnectTimerRef.current);
        sseReconnectTimerRef.current = null;
      }
    };

    const closeSource = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      sseConnectedRef.current = false;
    };

    const enterFallback = () => {
      if (sseFallbackRef.current) return;
      sseFallbackRef.current = true;
      closeSource();
      if (!disposed) {
        fallbackCleanup = startPollingFallback();
      }
    };

    const handleJobUpdate = (event: MessageEvent) => {
      let payload: JobUpdateEvent | null = null;
      try {
        payload = event.data ? (JSON.parse(event.data) as JobUpdateEvent) : null;
      } catch {
        payload = null;
      }
      const affectedId = payload?.contractId ?? payload?.id ?? null;

      // Refresh the list summary (cheap) and only the affected job's detail.
      void fetchJobs();
      if (affectedId) {
        void fetchJobDetails(affectedId, true);
      } else if (expandedJobId) {
        void fetchJobDetails(expandedJobId, true);
      }
    };

    const connect = () => {
      if (disposed) return;
      clearReconnectTimer();
      closeSource();

      const url = `${API_BASE}/jobs/stream?wallet=${encodeURIComponent(address)}`;
      let source: EventSource;
      try {
        source = new EventSource(url);
      } catch {
        enterFallback();
        return;
      }
      eventSourceRef.current = source;

      source.onopen = () => {
        if (disposed) return;
        sseConnectedRef.current = true;
        sseFallbackRef.current = false;
        sseReconnectAttemptRef.current = 0;
        // If we had fallen back to polling, stop it now that SSE is live.
        if (fallbackCleanup) {
          fallbackCleanup();
          fallbackCleanup = null;
        }
      };

      source.onmessage = (event) => {
        if (disposed) return;
        handleJobUpdate(event);
      };

      // Named event used by the backend for job updates.
      source.addEventListener("job-update", (event) => {
        if (disposed) return;
        handleJobUpdate(event as MessageEvent);
      });

      source.onerror = () => {
        if (disposed) return;
        sseConnectedRef.current = false;
        closeSource();

        // After a few failed attempts, fall back to polling while still
        // retrying the stream in the background.
        sseReconnectAttemptRef.current += 1;
        if (sseReconnectAttemptRef.current >= 3) {
          enterFallback();
        }

        const delay = Math.min(
          SSE_RECONNECT_BASE_MS * 2 ** (sseReconnectAttemptRef.current - 1),
          SSE_RECONNECT_MAX_MS
        );
        clearReconnectTimer();
        sseReconnectTimerRef.current = setTimeout(() => {
          if (!disposed && tabVisibleRef.current) connect();
        }, delay);
      };
    };

    const handleVisibilityChange = () => {
      const visible = document.visibilityState !== "hidden";
      tabVisibleRef.current = visible;
      if (visible) {
        // Reconnect immediately when the tab becomes visible again.
        if (!sseConnectedRef.current) {
          sseReconnectAttemptRef.current = 0;
          connect();
        }
      } else {
        // Close the stream while hidden to save backend resources.
        clearReconnectTimer();
        closeSource();
      }
    };

    tabVisibleRef.current = document.visibilityState !== "hidden";
    if (tabVisibleRef.current) {
      connect();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      clearReconnectTimer();
      closeSource();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (fallbackCleanup) {
        fallbackCleanup();
        fallbackCleanup = null;
      }
    };
  }, [address, expandedJobId, fetchJobs, fetchJobDetails, startPollingFallback]);

  const expandedJob = expandedJobId ? (jobDetails[expandedJobId] ?? null) : null;
  const milestoneList = Array.isArray(expandedJob?.milestones) ? expandedJob.milestones : [];

  const isClient = !!(expandedJob && address === expandedJob.client);
  const isFreelancer = !!(expandedJob && address === expandedJob.freelancer);
  const isArbiter = !!(expandedJob && address === expandedJob.arbiter);
  // A job with no milestones already shows MilestoneCard's own empty state,
  // so the arbiter placeholder only covers "milestones, but none disputed".
  const showArbiterNoDisputes =
    isArbiter && getArbiterJobEmptyState(milestoneList) === "no-disputes";

  const [autoReleaseDeadlines, setAutoReleaseDeadlines] = useState<Record<number, number | null>>(
    {}
  );

  useEffect(() => {
    const controller = new AbortController();
    const jobId = expandedJob?.id;
    const deliveredIndexes = (Array.isArray(expandedJob?.milestones) ? expandedJob.milestones : [])
      .filter((m) => m.status === "Delivered")
      .map((m) => m.index);

    (async () => {
      if (!jobId || deliveredIndexes.length === 0) {
        await Promise.resolve();
        if (!controller.signal.aborted) setAutoReleaseDeadlines({});
        return;
      }

      // Issue #671: fetch ALL milestone deadlines in one request instead of
      // one request per delivered milestone (N+1 problem).
      const deadlines = await fetchAllAutoReleaseDeadlines(jobId, deliveredIndexes, {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setAutoReleaseDeadlines(deadlines);
      }
    })();

    return () => controller.abort();
  }, [expandedJob]);

  const executeTx = useCallback(
    async (actionKey: string, method: string, args: { type: string; value: unknown }[]) => {
      if (!address || !expandedJobId) return null;
      // Every action targets the expanded job's own contract: each escrow
      // created through the factory is a separate contract.
      const contractId = expandedJobId;

      // Stage the action so the global signature-timeout alert can rebuild
      // and re-sign it with a fresh XDR (#676).
      registerPendingAction({ contractId, method, args, sourceAddress: address });

      const txHash = await runContractAction(
        actionKey,
        (onPhase) =>
          submitContractTransaction({
            contractId,
            method,
            args,
            sourceAddress: address,
            signTransaction,
            onPhase,
          }),
        { isPending, setPhase, setError: setActionError, setTxHash }
      );

      if (txHash !== null) {
        // Issue #670: immediately mark the row as "Updating…" so the user
        // knows the action succeeded while the indexer catches up.
        if (expandedJobId) {
          startUpdatingPoll(expandedJobId);
        }

        await fetchJobs();
        if (expandedJobId) {
          await fetchJobDetails(expandedJobId, true);
        }
      }

      return txHash;
    },
    [
      address,
      signTransaction,
      registerPendingAction,
      isPending,
      setPhase,
      setActionError,
      setTxHash,
      fetchJobs,
      expandedJobId,
      fetchJobDetails,
      startUpdatingPoll,
    ]
  );

  const handlePartialRelease = async (index: number, amount: string) => {
    if (!address || !amount) return;

    await executeTx(`partial-${index}`, "approve_partial", [
      { type: "address", value: address },
      { type: "u32", value: index.toString() },
      { type: "i128", value: amount },
    ]);
  };

  const handleClaimAutoRelease = async (index: number) => {
    if (!address) return;

    await executeTx(`claim-${index}`, "claim_auto_release", [
      { type: "address", value: address },
      { type: "u32", value: index.toString() },
    ]);
  };

  const handleMarkDelivered = async (i: number) => {
    if (!address) return;

    await executeTx(`deliver-${i}`, "mark_delivered", [
      { type: "address", value: address },
      { type: "u32", value: i.toString() },
    ]);
  };

  const handleFund = async () => {
    if (!address || !expandedJob) return;

    await executeTx(`fund-${expandedJob.id}`, "fund", [{ type: "address", value: address }]);
  };

  const handleApprove = async (i: number) => {
    if (!address) return;

    await executeTx(`approve-${i}`, "approve_milestone", [
      { type: "address", value: address },
      { type: "u32", value: i.toString() },
    ]);
  };

  const handleDispute = (i: number) => {
    setDisputeMilestoneIndex(i);
    setDisputeModalOpen(true);
  };

  const handleDisputeSubmit = async (reason: string) => {
    if (!address || disputeMilestoneIndex === null) return;

    // The contract takes a 32-byte hash of the reason, not the text (#590).
    await executeTx(`dispute-${disputeMilestoneIndex}`, "raise_dispute", [
      { type: "address", value: address },
      { type: "u32", value: disputeMilestoneIndex.toString() },
      { type: "bytes", value: await hashDisputeReason(reason) },
    ]);

    setDisputeModalOpen(false);
    setDisputeMilestoneIndex(null);
  };

  const handleResolveDispute = async (index: number, releaseToFreelancer: boolean) => {
    if (!address) return;

    await executeTx(`resolve-${index}`, "resolve_dispute", [
      { type: "address", value: address },
      { type: "u32", value: index.toString() },
      { type: "bool", value: releaseToFreelancer },
    ]);
  };

  const paginationButtons = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);

    for (let p = start; p <= end; p += 1) {
      pages.push(p);
    }

    return pages;
  }, [page, totalPages]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      <Navbar />
      <main className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-12">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6">Job Dashboard</h1>

        {!address ? (
          <EmptyStateCard
            testId="dashboard-connect-wallet"
            ariaLabel="Connect wallet"
            title="Connect your wallet to view your jobs"
            description="Connect a Stellar wallet to see the escrow jobs you're involved in as a client, freelancer, or arbiter."
            statusTitle
          >
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={() => void connect()}
                disabled={isConnecting}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-sm font-medium text-text-primary transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? "Connecting…" : "Connect wallet"}
              </button>
              <Link
                href="/#how-it-works"
                className="text-sm text-indigo-400 hover:text-indigo-300 underline-offset-2 hover:underline"
              >
                How it works
              </Link>
            </div>
          </EmptyStateCard>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:gap-3">
              <label htmlFor="search-input" className="sr-only">
                Search by contract or job ID
              </label>
              <input
                id="search-input"
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by contract/job ID"
                className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page hover:border-border-hover"
                aria-label="Search by contract ID"
                aria-describedby="search-help"
              />
              <span id="search-help" className="sr-only">
                Enter a contract or job ID to search for jobs
              </span>
              <button
                type="submit"
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Submit search query"
              >
                Search