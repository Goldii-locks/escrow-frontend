"use client";

import { useCallback, useEffect, useState } from "react";
import { BACKEND_URL } from "@/app/lib/transactions";
import {
  buildArbiterDisputeQueue,
  parseArbiterJobsPayload,
  type ArbiterDisputeEntry,
} from "@/app/lib/arbiter_dispute_queue";

/** Page size used when fetching the arbiter's jobs for the queue. */
const ARBITER_QUEUE_FETCH_LIMIT = 100;

export interface UseArbiterDisputesResult {
  /** Disputed milestones awaiting the address, sorted by urgency. */
  entries: ArbiterDisputeEntry[];
  loading: boolean;
  error: string | null;
  /** Re-fetch the queue (e.g. after resolving a dispute). */
  refresh: () => void;
}

/**
 * Loads every dispute awaiting the connected wallet as arbiter (Issue #881).
 * Until the backend ships a dispute API this derives the queue from the
 * by-wallet job list filtered to `role=arbiter`.
 */
export function useArbiterDisputes(
  address: string | null,
): UseArbiterDisputesResult {
  const [entries, setEntries] = useState<ArbiterDisputeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const refresh = useCallback(() => {
    setRefreshToken((token) => token + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    if (!address) {
      // Disconnected: the returned values below fall back to an empty
      // queue, so no state needs to be reset synchronously here.
      return () => controller.abort();
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          role: "arbiter",
          page: "1",
          limit: String(ARBITER_QUEUE_FETCH_LIMIT),
        });
        const res = await fetch(
          `${BACKEND_URL}/api/jobs/by-wallet/${encodeURIComponent(address)}?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          throw new Error(`Failed to fetch arbiter jobs (${res.status})`);
        }
        const payload: unknown = await res.json();
        const jobs = parseArbiterJobsPayload(payload);
        if (!controller.signal.aborted) {
          setEntries(buildArbiterDisputeQueue(jobs, address));
          setLoading(false);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setEntries([]);
        setError(
          err instanceof Error ? err.message : "Failed to fetch arbiter jobs",
        );
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [address, refreshToken]);

  // While disconnected the queue is always empty, regardless of any data
  // left over from a previous connection.
  return {
    entries: address ? entries : [],
    loading: address ? loading : false,
    error: address ? error : null,
    refresh,
  };
}