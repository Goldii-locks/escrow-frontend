"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RESOLUTION_LOAD_ERROR,
  fetchResolutionDispute,
  type ResolutionDisputeData,
} from "@/app/lib/resolution_vote_form";

export type ResolutionDisputeQueryStatus = "loading" | "error" | "empty" | "ready";

export interface ResolutionDisputeQuery {
  status: ResolutionDisputeQueryStatus;
  data: ResolutionDisputeData | null;
  error: string | null;
  /** Re-run the query (e.g. from an error state's retry button). */
  reload: () => void;
}

export interface UseResolutionDisputeOptions {
  /** Override the default `/api/disputes/:id/resolution` endpoint. */
  apiUrl?: string;
  /**
   * Pre-loaded data. When provided (including `null` for "no dispute"), no
   * request is made.
   */
  initialData?: ResolutionDisputeData | null;
}

interface QueryResult {
  key: string;
  data: ResolutionDisputeData | null;
  error: string | null;
}

/**
 * Load the dispute backing `ResolutionVoteForm` (Issue #453).
 *
 * Every result is tagged with the request key that produced it, so a change
 * of `disputeId` / `apiUrl` or a `reload()` reads as `loading` until the
 * matching response lands — without a synchronous state reset in the effect.
 */
export function useResolutionDispute(
  disputeId: string,
  options: UseResolutionDisputeOptions = {},
): ResolutionDisputeQuery {
  const { apiUrl, initialData } = options;
  const skip = initialData !== undefined;
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<QueryResult | null>(null);
  const requestKey = `${disputeId}::${apiUrl ?? ""}::${attempt}`;

  useEffect(() => {
    if (skip) return;
    const controller = new AbortController();

    fetchResolutionDispute(disputeId, { apiUrl, signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setResult({
          key: requestKey,
          data: null,
          error: err instanceof Error ? err.message : RESOLUTION_LOAD_ERROR,
        });
      });

    return () => controller.abort();
  }, [disputeId, apiUrl, requestKey, skip]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  if (skip) {
    return initialData
      ? { status: "ready", data: initialData, error: null, reload }
      : { status: "empty", data: null, error: null, reload };
  }
  if (!result || result.key !== requestKey) {
    return { status: "loading", data: null, error: null, reload };
  }
  if (result.error) {
    return { status: "error", data: null, error: result.error, reload };
  }
  if (!result.data) {
    return { status: "empty", data: null, error: null, reload };
  }
  return { status: "ready", data: result.data, error: null, reload };
}
