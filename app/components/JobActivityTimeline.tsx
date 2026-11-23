"use client";

import { useEffect, useRef, useState } from "react";
import { BACKEND_URL } from "@/app/lib/transactions";
import { reportApiResponse } from "@/app/lib/errorReporter";
import { getStellarExpertTxUrl } from "@/app/lib/stellar";

const PAGE_SIZE = 10;

interface HistoryEvent {
  id?: number;
  event_type: string;
  ledger_sequence: number;
  timestamp: number | null;
  data_json?: string | null;
  tx_hash?: string | null;
}

interface HistoryResponse {
  success?: boolean;
  events?: HistoryEvent[];
  total?: number;
  /** Echoed by backends that honour `order=desc` (newest page first). */
  order?: string;
  error?: string;
}

function pageCount(total: number | undefined): number {
  return Math.max(1, Math.ceil((total ?? 0) / PAGE_SIZE));
}

const EVENT_LABELS: Record<string, string> = {
  initialized: "Job created",
  funded: "Escrow funded",
  delivered: "Milestone delivered",
  approved: "Milestone approved",
  released: "Funds released",
  partial_release: "Partial release",
  disputed: "Dispute raised",
  resolved: "Dispute resolved",
  refunded: "Refunded",
  auto_released: "Auto-released",
  cancelled: "Job cancelled",
};

const ACTOR_KEYS = ["actor", "caller", "by", "from", "client", "freelancer", "arbiter"];

export function eventLabel(type: string): string {
  if (EVENT_LABELS[type]) return EVENT_LABELS[type];
  const words = type.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
}

function eventActor(event: HistoryEvent): string | null {
  if (!event.data_json) return null;
  try {
    const data = JSON.parse(event.data_json) as Record<string, unknown>;
    for (const key of ACTOR_KEYS) {
      const value = data[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  } catch {
    // Malformed payloads still render without an actor.
  }
  return null;
}

export function relativeTime(timestamp: number | null, now = Date.now()): string {
  if (timestamp == null) return "Unknown time";
  // Ledger close times are stored in seconds.
  const ms = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const seconds = Math.round((ms - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(seconds, "second");
}

/**
 * Activity timeline for one job, newest first.
 *
 * Every request asks for `order=desc`. A backend that honours it echoes
 * `order: "desc"` and display page N is backend page N, in one request.
 * Older backends ignore the parameter and page oldest first; then display
 * page N maps to backend page (totalPages - N + 1), and `total` is re-read
 * from every response so the mapping stays correct as new events arrive.
 *
 * `refreshKey` (e.g. the job's `latestLedger`) refetches the timeline when
 * the job changes: after an action, or when the dashboard poll sees new
 * activity (#892). Render it with `key={contractId}` so switching jobs
 * starts from page 1 with fresh state.
 */
export default function JobActivityTimeline({
  contractId,
  refreshKey,
}: {
  contractId: string;
  refreshKey?: string | number | null;
}) {
  const [displayPage, setDisplayPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** null = not yet known, true = backend honours order=desc, false = legacy. */
  const descSupportedRef = useRef<boolean | null>(null);
  /** Latest total seen, used to guess the legacy backend page before fetching. */
  const totalRef = useRef<number | null>(null);

  const totalPages = total == null ? 1 : pageCount(total);

  useEffect(() => {
    const controller = new AbortController();

    const load = async (backendPage: number): Promise<HistoryResponse> => {
      const res = await fetch(
        `${BACKEND_URL}/api/jobs/${encodeURIComponent(contractId)}/history?page=${backendPage}&limit=${PAGE_SIZE}&order=desc`,
        { signal: controller.signal }
      );
      reportApiResponse(res, "/api/jobs/:contractId/history");
      const payload = (await res.json()) as HistoryResponse;
      if (payload.success === false || !Array.isArray(payload.events)) {
        throw new Error(payload.error || "Failed to load activity");
      }
      return payload;
    };

    /** Fetch display page `displayPage`, newest first, with a fresh total. */
    const fetchDisplayPage = async (): Promise<{ events: HistoryEvent[]; total: number }> => {
      // Unknown or desc-capable backend: ask for the display page directly.
      if (descSupportedRef.current !== false) {
        const payload = await load(displayPage);
        if (payload.order === "desc") {
          descSupportedRef.current = true;
          return { events: payload.events ?? [], total: payload.total ?? 0 };
        }
        descSupportedRef.current = false;
        // Legacy backend: that was oldest-first page `displayPage`.
        const target = Math.max(1, pageCount(payload.total) - displayPage + 1);
        const page = target === displayPage ? payload : await load(target);
        return { events: [...(page.events ?? [])].reverse(), total: page.total ?? 0 };
      }

      // Legacy backend: guess from the last total, then correct if it moved.
      const guess = Math.max(1, pageCount(totalRef.current ?? 0) - displayPage + 1);
      let payload = await load(guess);
      const target = Math.max(1, pageCount(payload.total) - displayPage + 1);
      if (target !== guess) payload = await load(target);
      return { events: [...(payload.events ?? [])].reverse(), total: payload.total ?? 0 };
    };

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchDisplayPage();
        if (controller.signal.aborted) return;
        totalRef.current = result.total;
        setTotal(result.total);
        setEvents(result.events);
        // Keep the current page in range if the history shrank.
        const pages = pageCount(result.total);
        if (displayPage > pages) setDisplayPage(pages);
      } catch {
        if (controller.signal.aborted) return;
        setError("Unable to load activity.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [contractId, displayPage, refreshKey]);

  return (
    <section
      className="space-y-2 sm:space-y-3"
      aria-label="Activity"
      data-testid="job-activity-timeline"
    >
      <h3 className="text-sm font-semibold text-gray-300">Activity</h3>

      {loading ? (
        <p className="text-xs text-gray-400" role="status">
          Loading activity…
        </p>
      ) : error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : events.length === 0 ? (
        <p className="text-xs text-gray-400" role="status">
          No activity yet.
        </p>
      ) : (
        <ol className="space-y-2 border-l border-gray-800 pl-3">
          {events.map((event) => {
            const actor = eventActor(event);
            return (
              <li
                key={event.id ?? `${event.ledger_sequence}-${event.event_type}`}
                data-testid="job-activity-event"
                className="text-xs sm:text-sm"
              >
                <p className="text-white font-medium">{eventLabel(event.event_type)}</p>
                <p className="text-gray-400 flex flex-wrap gap-x-2">
                  <span>{relativeTime(event.timestamp)}</span>
                  {actor && (
                    <span className="font-mono" title={actor}>
                      by {shortAddress(actor)}
                    </span>
                  )}
                  {event.tx_hash && (
                    <a
                      href={getStellarExpertTxUrl(event.tx_hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline"
                    >
                      View transaction
                    </a>
                  )}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between gap-2" aria-label="Activity pagination">
          <button
            type="button"
            onClick={() => setDisplayPage((p) => Math.max(1, p - 1))}
            disabled={loading || displayPage <= 1}
            className="px-2 py-1 rounded border border-gray-700 text-xs disabled:opacity-50"
          >
            Newer
          </button>
          <span className="text-xs text-gray-400">
            Page {displayPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setDisplayPage((p) => Math.min(totalPages, p + 1))}
            disabled={loading || displayPage >= totalPages}
            className="px-2 py-1 rounded border border-gray-700 text-xs disabled:opacity-50"
          >
            Older
          </button>
        </nav>
      )}
    </section>
  );
}
