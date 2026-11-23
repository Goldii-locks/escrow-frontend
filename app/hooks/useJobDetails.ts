"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useWallet } from "@/app/context/WalletContext";
import { fetchJobStateFromContract, isIndexerStale } from "@/app/lib/contract_job_state";
import { apiGet, ApiHttpError } from "@/app/lib/api";
import { JobDetailResponseSchema, type Job } from "@/app/lib/api_schemas";
import { normalizeJob } from "@/app/lib/api_schemas";

export interface UseJobDetailsProps {
  id: string | null;
  /** Notifies the caller when a job's detail came from (or stopped being) a contract fallback. */
  onContractFallback?: (jobId: string, usedFallback: boolean) => void;
}

export interface UseJobDetailsReturn {
  job: Job | null;
  loading: boolean;
  error: string | null;
  /** Force-refresh the detail for the current id. */
  refetch: (force?: boolean) => void;
}

/**
 * Fetches the detail for a single job with abort, request-ID deduplication
 * and a contract-state fallback when the indexer is stale (#895).
 */
export function useJobDetails({ id, onContractFallback }: UseJobDetailsProps): UseJobDetailsReturn {
  const { address } = useWallet();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailsAbortRef = useRef<AbortController | null>(null);
  const detailsRequestIdRef = useRef(0);
  const detailsJobIdRef = useRef<string | null>(null);

  const fetchJobDetails = useCallback(
    async (jobId: string, force = false) => {
      if (!address || !jobId) return;
      if (!force && job) return;

      // Abort any in-flight detail request and issue a fresh one.
      detailsAbortRef.current?.abort();
      const controller = new AbortController();
      detailsAbortRef.current = controller;

      detailsRequestIdRef.current += 1;
      const requestId = detailsRequestIdRef.current;
      detailsJobIdRef.current = jobId;

      setLoading(true);

      try {
        let payload: ReturnType<typeof JobDetailResponseSchema.parse> | null = null;
        try {
          payload = await apiGet(
            `/api/jobs/${encodeURIComponent(jobId)}`,
            JobDetailResponseSchema,
            { signal: controller.signal, envelope: "none" }
          );
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") throw error;
          if (!(error instanceof ApiHttpError)) throw error;
        }

        // Drop stale responses.
        if (requestId !== detailsRequestIdRef.current) return;

        // On a non-ok response fall through to the contract fallback below
        // rather than throwing immediately (#895).
        let candidate: Job | null = null;
        let usedFallback = false;

        if (payload?.success === true) {
          candidate = normalizeJob(payload.data);
        }

        // If the indexer ledger is stale, prefer fresh contract state (#895).
        if (candidate && isIndexerStale(candidate.latestLedger, undefined)) {
          candidate = null;
        }

        if (!candidate) {
          // Backend failed or data is stale — read directly from the contract.
          const contractJob = await fetchJobStateFromContract(jobId, {
            signal: controller.signal,
          });
          if (requestId !== detailsRequestIdRef.current) return;
          if (contractJob) {
            candidate = contractJob;
            usedFallback = true;
          }
        }

        if (candidate) {
          setJob(candidate as Job);
          setError(null);
          onContractFallback?.(jobId, usedFallback);
          return;
        }

        throw new Error("Invalid job data received");
      } catch (err) {
        // Ignore intentional aborts.
        if (err instanceof Error && err.name === "AbortError") return;

        const message = err instanceof Error ? err.message : "Failed to load job details";
        setError(message);
      } finally {
        if (requestId === detailsRequestIdRef.current || detailsJobIdRef.current !== jobId) {
          setLoading(false);
        }
      }
    },
    [address, job, onContractFallback]
  );

  // Fetch when the tracked job id changes.
  useEffect(() => {
    if (!id) {
      setJob(null);
      setLoading(false);
      setError(null);
      return;
    }
    void fetchJobDetails(id);
  }, [id, fetchJobDetails]);

  const refetch = useCallback(
    (force = false) => {
      if (id) void fetchJobDetails(id, force);
    },
    [id, fetchJobDetails]
  );

  return { job, loading, error, refetch };
}
