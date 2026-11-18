'use client';

import { useEffect, useRef } from 'react';

/**
 * Server-Sent Events client for job updates (#904).
 *
 * Opens a single `EventSource` per tab for the connected wallet's jobs, parses
 * job-update events, and invokes a callback so the dashboard can refetch only
 * the affected job. Reconnects with exponential backoff on error, falls back to
 * the existing polling loop when `EventSource` is unavailable or repeatedly
 * fails, and closes/reopens on `visibilitychange` (closed while hidden).
 */

export type JobUpdateEvent = {
  /** The job the update relates to. */
  jobId: string;
  /** Optional event type, e.g. "created" | "updated" | "milestone". */
  type?: string;
  /** Raw parsed payload, if the server sent JSON. */
  data?: unknown;
};

export type JobUpdatesStreamOptions = {
  /** Connected wallet address. The stream is scoped to this wallet's jobs. */
  wallet: string | null | undefined;
  /** Called for each job-update event received from the stream. */
  onJobUpdate: (event: JobUpdateEvent) => void;
  /**
   * Fallback polling function. Invoked on an interval when the stream is
   * unavailable or has repeatedly failed. Should behave like the existing
   * dashboard polling loop (refetch `/by-wallet` and the expanded job).
   */
  onFallbackPoll?: () => void | Promise<void>;
  /** Base URL of the backend. Defaults to `NEXT_PUBLIC_API_URL` or same-origin. */
  baseUrl?: string;
  /** Polling interval used in fallback mode. Defaults to 30s. */
  fallbackIntervalMs?: number;
  /** Initial reconnect delay. Defaults to 1s. */
  initialBackoffMs?: number;
  /** Maximum reconnect delay. Defaults to 30s. */
  maxBackoffMs?: number;
  /** Consecutive failures before switching to fallback polling. Defaults to 5. */
  maxConsecutiveFailures?: number;
  /** Whether the stream is enabled. Defaults to true. */
  enabled?: boolean;
};

export type JobUpdatesStream = {
  /** Close the stream and stop any reconnect/fallback timers. */
  close: () => void;
  /** Whether the client is currently in fallback polling mode. */
  isFallback: () => boolean;
  /** Whether the EventSource is currently open. */
  isConnected: () => boolean;
};

const DEFAULT_FALLBACK_INTERVAL_MS = 30_000;
const DEFAULT_INITIAL_BACKOFF_MS = 1_000;
const DEFAULT_MAX_BACKOFF_MS = 30_000;
const DEFAULT_MAX_CONSECUTIVE_FAILURES = 5;

function resolveBaseUrl(baseUrl?: string): string {
  if (baseUrl) return baseUrl.replace(/\/$/, '');
  const envUrl =
    typeof process !== 'undefined'
      ? process.env?.NEXT_PUBLIC_API_URL
      : undefined;
  if (envUrl) return envUrl.replace(/\/$/, '');
  return '';
}

function buildStreamUrl(baseUrl: string, wallet: string): string {
  const path = `/jobs/stream?wallet=${encodeURIComponent(wallet)}`;
  return `${baseUrl}${path}`;
}

function parseJobUpdate(raw: string): JobUpdateEvent | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const jobIdCandidate =
    obj.jobId ?? obj.job_id ?? obj.id ?? (obj.job as Record<string, unknown> | undefined)?.id;
  if (jobIdCandidate === undefined || jobIdCandidate === null) return null;
  const jobId = String(jobIdCandidate);
  if (!jobId) return null;
  const type = typeof obj.type === 'string' ? obj.type : undefined;
  return { jobId, type, data: parsed };
}

/**
 * Create a job-updates stream client. Exported separately from the hook so it
 * can be unit-tested with a mocked `EventSource`.
 */
export function createJobUpdatesStream(
  options: JobUpdatesStreamOptions,
): JobUpdatesStream {
  const {
    wallet,
    onJobUpdate,
    onFallbackPoll,
    baseUrl,
    fallbackIntervalMs = DEFAULT_FALLBACK_INTERVAL_MS,
    initialBackoffMs = DEFAULT_INITIAL_BACKOFF_MS,
    maxBackoffMs = DEFAULT_MAX_BACKOFF_MS,
    maxConsecutiveFailures = DEFAULT_MAX_CONSECUTIVE_FAILURES,
    enabled = true,
  } = options;

  let closed = false;
  let source: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let fallbackTimer: ReturnType<typeof setInterval> | null = null;
  let consecutiveFailures = 0;
  let fallback = false;
  let connected = false;
  let visibilityListener: (() => void) | null = null;

  const resolvedBaseUrl = resolveBaseUrl(baseUrl);

  const clearReconnectTimer = () => {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const clearFallbackTimer = () => {
    if (fallbackTimer !== null) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
  };

  const closeSource = () => {
    if (source) {
      try {
        source.close();
      } catch {
        // ignore
      }
      source = null;
    }
    connected = false;
  };

  const runFallbackPoll = () => {
    if (closed || !onFallbackPoll) return;
    try {
      const result = onFallbackPoll();
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(() => {
          // swallow; polling will retry on next tick
        });
      }
    } catch {
      // swallow; polling will retry on next tick
    }
  };

  const enterFallback = () => {
    if (fallback) return;
    fallback = true;
    closeSource();
    clearReconnectTimer();
    if (!onFallbackPoll) return;
    // Poll immediately, then on the interval.
    runFallbackPoll();
    clearFallbackTimer();
    fallbackTimer = setInterval(runFallbackPoll, fallbackIntervalMs);
  };

  const scheduleReconnect = () => {
    if (closed) return;
    if (consecutiveFailures >= maxConsecutiveFailures) {
      enterFallback();
      return;
    }
    const delay = Math.min(
      initialBackoffMs * 2 ** Math.max(0, consecutiveFailures - 1),
      maxBackoffMs,
    );
    clearReconnectTimer();
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const handleMessage = (event: MessageEvent) => {
    const parsed = parseJobUpdate(typeof event.data === 'string' ? event.data : '');
    if (!parsed) return;
    try {
      onJobUpdate(parsed);
    } catch {
      // ignore callback errors
    }
  };

  const connect = () => {
    if (closed) return;
    if (typeof EventSource === 'undefined') {
      enterFallback();
      return;
    }
    if (!wallet) return;

    closeSource();
    const url = buildStreamUrl(resolvedBaseUrl, wallet);
    let es: EventSource;
    try {
      es = new EventSource(url);
    } catch {
      consecutiveFailures += 1;
      scheduleReconnect();
      return;
    }
    source = es;

    es.onopen = () => {
      if (closed || source !== es) return;
      connected = true;
      consecutiveFailures = 0;
      // If we were in fallback mode, the stream recovered: stop polling.
      if (fallback) {
        fallback = false;
        clearFallbackTimer();
      }
    };

    es.onmessage = (event) => {
      if (closed || source !== es) return;
      handleMessage(event);
    };

    // Named event used by the backend for job updates.
    es.addEventListener('job-update', (event) => {
      if (closed || source !== es) return;
      handleMessage(event as MessageEvent);
    });

    es.onerror = () => {
      if (closed || source !== es) return;
      connected = false;
      consecutiveFailures += 1;
      closeSource();
      scheduleReconnect();
    };
  };

  const handleVisibilityChange = () => {
    if (closed) return;
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'hidden') {
      // Close the stream and pause polling while hidden.
      closeSource();
      clearReconnectTimer();
      clearFallbackTimer();
    } else {
      // Reopen on return to the tab.
      consecutiveFailures = 0;
      if (fallback) {
        // Stay in fallback but resume polling immediately.
        runFallbackPoll();
        clearFallbackTimer();
        fallbackTimer = setInterval(runFallbackPoll, fallbackIntervalMs);
      } else {
        connect();
      }
    }
  };

  if (enabled && wallet) {
    if (typeof document !== 'undefined') {
      visibilityListener = handleVisibilityChange;
      document.addEventListener('visibilitychange', visibilityListener);
      if (document.visibilityState === 'hidden') {
        // Don't open while hidden; wait for visibility.
      } else {
        connect();
      }
    } else {
      connect();
    }
  }

  return {
    close: () => {
      closed = true;
      clearReconnectTimer();
      clearFallbackTimer();
      closeSource();
      if (visibilityListener && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', visibilityListener);
        visibilityListener = null;
      }
    },
    isFallback: () => fallback,
    isConnected: () => connected,
  };
}

/**
 * React hook wrapping {@link createJobUpdatesStream}. Opens one `EventSource`
 * per tab for the connected wallet's jobs and cleans up on unmount or when the
 * wallet changes.
 */
export function useJobUpdates(options: JobUpdatesStreamOptions): void {
  const {
    wallet,
    onJobUpdate,
    onFallbackPoll,
    baseUrl,
    fallbackIntervalMs,
    initialBackoffMs,
    maxBackoffMs,
    maxConsecutiveFailures,
    enabled = true,
  } = options;

  const onJobUpdateRef = useRef(onJobUpdate);
  const onFallbackPollRef = useRef(onFallbackPoll);

  useEffect(() => {
    onJobUpdateRef.current = onJobUpdate;
  }, [onJobUpdate]);

  useEffect(() => {
    onFallbackPollRef.current = onFallbackPoll;
  }, [onFallbackPoll]);

  useEffect(() => {
    if (!enabled || !wallet) return;

    const stream = createJobUpdatesStream({
      wallet,
      onJobUpdate: (event) => onJobUpdateRef.current(event),
      onFallbackPoll: onFallbackPollRef.current
        ? () => onFallbackPollRef.current?.()
        : undefined,
      baseUrl,
      fallbackIntervalMs,
      initialBackoffMs,
      maxBackoffMs,
      maxConsecutiveFailures,
      enabled,
    });

    return () => {
      stream.close();
    };
  }, [
    wallet,
    baseUrl,
    fallbackIntervalMs,
    initialBackoffMs,
    maxBackoffMs,
    maxConsecutiveFailures,
    enabled,
  ]);
}