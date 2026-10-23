"use client";

import { useEffect, useState } from "react";
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
  error?: string;
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
 * Activity timeline for one job, newest first. The backend pages oldest
 * first, so display page N maps to backend page (totalPages - N + 1).
 */
export default function JobActivityTimeline({ contractId }: { contractId: string }) {
  const [displayPage, setDisplayPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = total == null ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    const controller = new AbortController();

    const load = async (backendPage: number): Promise<HistoryResponse> => {
      const res = await fetch(
        `${BACKEND_URL}/api/jobs/${encodeURIComponent(contractId)}/history?page=${backendPage}&limit=${PAGE_SIZE}`,
        { signal: controller.signal }
      );
      reportApiResponse(res, "/api/jobs/:contractId/history");
      const payload = (await res.json()) as HistoryResponse;
      if (payload.success === false || !Array.isArray(payload.events)) {
        throw new Error(payload.error || "Failed to load activity");
      }
      return payload;
    };

    (async () => {
      setLoading(true);
      setError(null);
      try {
        let payload: HistoryResponse;
        if (total == null) {
          // First load: learn the total, then jump to the newest page.
          payload = await load(1);
          const pages = Math.max(1, Math.ceil((payload.total ?? 0) / PAGE_SIZE));
          if (pages > 1) payload = await load(pages);
          if (controller.signal.aborted) return;
          setTotal(payload.total ?? 0);
        } else {
          payload = await load(totalPages - displayPage + 1);
        }
        if (controller.signal.aborted) return;
        setEvents([...(payload.events ?? [])].reverse());
      } catch {
        if (controller.signal.aborted) return;
        setError("Unable to load activity.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
    // `total` only seeds the first load; page changes drive later fetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId, displayPage]);

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
