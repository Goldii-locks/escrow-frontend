"use client";

import { useEffect, useState } from "react";
import LoadingSkeleton from "./LoadingSkeleton";
import {
  type DisputeHistoryEvent,
  TIMELINE_SKELETON_ROWS,
  UNAUTHORIZED_TIMELINE_WARNING,
  fetchDisputeHistory,
  isTimelineViewerAuthorized,
  sanitizeTimelineInput,
} from "@/app/lib/dispute_history_timeline";

export interface DisputeHistoryTimelineProps {
  /** Identifier of the dispute */
  disputeId: string;
  /** Currently connected wallet address */
  currentWalletAddress?: string | null;
  /** Whitelist of wallets allowed to view this dispute's history */
  authorizedWallets?: string[];
  /** Optional initial events override (skips the backend query) */
  initialEvents?: DisputeHistoryEvent[];
  /** Optional external loading flag */
  isLoading?: boolean;
  /** Optional backend API endpoint */
  apiEndpoint?: string;
  className?: string;
}

/**
 * Timeline of events logged against a dispute.
 *
 * Renders a warning instead of the history for unauthorized wallets, a
 * skeleton while the history loads, and sanitizes the note form's input.
 */
export default function DisputeHistoryTimeline({
  disputeId,
  currentWalletAddress,
  authorizedWallets,
  initialEvents,
  isLoading: externalLoading = false,
  apiEndpoint,
  className = "",
}: DisputeHistoryTimelineProps) {
  const [events, setEvents] = useState<DisputeHistoryEvent[]>(initialEvents ?? []);
  const [loading, setLoading] = useState<boolean>(!initialEvents);
  const [note, setNote] = useState("");

  const isAuthorized = isTimelineViewerAuthorized(
    currentWalletAddress,
    authorizedWallets,
  );

  useEffect(() => {
    if (!isAuthorized || initialEvents) return;

    let isMounted = true;
    const controller = new AbortController();

    fetchDisputeHistory(disputeId, {
      apiUrl: apiEndpoint,
      signal: controller.signal,
    })
      .then((data) => {
        if (!isMounted) return;
        setEvents(data);
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [disputeId, isAuthorized, initialEvents, apiEndpoint]);

  if (!isAuthorized) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={`rounded-xl border border-red-500/30 bg-red-950/20 p-6 text-center text-red-200 ${className}`}
        data-testid="dispute-timeline-unauthorized-warning"
      >
        <h3 className="text-lg font-semibold text-white">Access Denied</h3>
        <p className="mt-2 text-sm text-red-300">{UNAUTHORIZED_TIMELINE_WARNING}</p>
        <p className="mt-1 text-xs text-gray-400">
          Current Wallet: {currentWalletAddress || "Not connected"}
        </p>
      </div>
    );
  }

  if (externalLoading || (loading && !initialEvents)) {
    return (
      <div
        className={`space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-6 ${className}`}
        aria-busy="true"
        aria-label="Loading dispute history"
        data-testid="dispute-timeline-loading-skeletons"
      >
        <div className="h-6 w-48 animate-pulse rounded bg-gray-700/60" />
        {Array.from({ length: TIMELINE_SKELETON_ROWS }, (_, i) => (
          <LoadingSkeleton
            key={i}
            className="h-16 w-full"
            aria-label="Timeline event placeholder"
          />
        ))}
      </div>
    );
  }

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sanitizeTimelineInput(note);
    // Input made up solely of code/script tags sanitizes to nothing: ignore it.
    if (!clean) {
      setNote("");
      return;
    }

    setEvents((prev) => [
      ...prev,
      {
        id: `evt-${Date.now()}`,
        disputeId,
        type: "note",
        actor: currentWalletAddress ?? "",
        actorRole: "client",
        title: "Note added",
        description: clean,
        timestamp: new Date().toISOString(),
      },
    ]);
    setNote("");
  };

  return (
    <div
      className={`rounded-xl border border-gray-800 bg-gray-900/60 p-6 text-gray-200 ${className}`}
      data-testid="dispute-history-timeline"
    >
      <h2 className="border-b border-gray-800 pb-4 text-xl font-bold text-white">
        Dispute History
      </h2>

      {events.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          No history recorded for this dispute.
        </p>
      ) : (
        <ol className="mt-5 space-y-4 border-l border-gray-700 pl-4">
          {events.map((event) => (
            <li key={event.id} data-testid={`timeline-event-${event.id}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-white">{event.title}</h4>
                <time
                  dateTime={event.timestamp}
                  className="font-mono text-xs text-gray-500"
                >
                  {new Date(event.timestamp).toLocaleDateString()}
                </time>
              </div>
              <p className="mt-1 text-xs text-gray-300">{event.description}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-gray-500">
                {event.actorRole} · <span className="font-mono normal-case">{event.actor}</span>
              </p>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={handleAddNote} className="mt-6 border-t border-gray-800 pt-4">
        <label
          htmlFor="dispute-timeline-note"
          className="text-xs font-semibold uppercase tracking-wider text-gray-400"
        >
          Add note
        </label>
        <input
          id="dispute-timeline-note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note to the timeline"
          className="mt-2 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          className="mt-3 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 focus:outline-none"
        >
          Add Note
        </button>
      </form>
    </div>
  );
}
