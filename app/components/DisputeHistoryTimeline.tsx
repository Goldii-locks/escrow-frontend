"use client";

import { useCallback, useEffect, useState } from "react";
import LoadingSkeleton from "./LoadingSkeleton";
import { useToast } from "@/app/context/ToastContext";
import {
  DISPUTE_ACTIONS,
  EXPORT_EMPTY_TOAST,
  EXPORT_SUCCESS_TOAST,
  INITIAL_CONFIRMATION_STATE,
  TIMELINE_SKELETON_ROWS,
  UNAUTHORIZED_TIMELINE_WARNING,
  canSubmitAction,
  downloadTimelineCsv,
  fetchDisputeHistory,
  getActionToast,
  getAvailableActions,
  getExportFilename,
  getStatusBadge,
  isTimelineViewerAuthorized,
  sanitizeTimelineInput,
  type ConfirmationState,
  type DisputeHistoryEvent,
  type DisputeTimelineAction,
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
  /**
   * Signs and submits the transaction for an action on an event. Only called
   * after the user has completed the confirmation dialog. Reject to surface
   * an error toast. Actions are only offered when this is provided.
   */
  onAction?: (
    action: DisputeTimelineAction,
    event: DisputeHistoryEvent,
  ) => Promise<void> | void;
  className?: string;
}

interface PendingAction {
  action: DisputeTimelineAction;
  event: DisputeHistoryEvent;
}

/**
 * Timeline of events logged against a dispute.
 *
 * Renders a warning instead of the history for unauthorized wallets, a
 * skeleton while the history loads, status badges per event, confirmed
 * escalate/withdraw actions with toasts, CSV export, and a sanitized note
 * form. Events are laid out in a responsive grid.
 */
export default function DisputeHistoryTimeline({
  disputeId,
  currentWalletAddress,
  authorizedWallets,
  initialEvents,
  isLoading: externalLoading = false,
  apiEndpoint,
  onAction,
  className = "",
}: DisputeHistoryTimelineProps) {
  const { showToast } = useToast();
  const [events, setEvents] = useState<DisputeHistoryEvent[]>(initialEvents ?? []);
  const [loading, setLoading] = useState<boolean>(!initialEvents);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState>(
    INITIAL_CONFIRMATION_STATE,
  );

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

  const handleExport = useCallback(() => {
    const ok = downloadTimelineCsv(events, getExportFilename(disputeId));
    const toast = ok ? EXPORT_SUCCESS_TOAST : EXPORT_EMPTY_TOAST;
    showToast(toast.message, toast.type);
  }, [events, disputeId, showToast]);

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

  const openConfirmation = (action: DisputeTimelineAction, event: DisputeHistoryEvent) => {
    setPending({ action, event });
    setConfirmation({ ...INITIAL_CONFIRMATION_STATE, opened: true });
  };

  const closeConfirmation = () => {
    if (confirmation.submitting) return;
    setPending(null);
    setConfirmation(INITIAL_CONFIRMATION_STATE);
  };

  const handleConfirm = async () => {
    // Submit stays blocked until the dialog is open and acknowledged.
    if (!pending || !canSubmitAction(confirmation)) return;
    const { action, event } = pending;
    setConfirmation((prev) => ({ ...prev, submitting: true }));
    try {
      await onAction?.(action, event);
      const toast = getActionToast(action, "success");
      showToast(toast.message, toast.type);
    } catch (err) {
      const toast = getActionToast(action, "failure", err);
      showToast(toast.message, toast.type);
    } finally {
      setPending(null);
      setConfirmation(INITIAL_CONFIRMATION_STATE);
    }
  };

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

  const actionConfig = pending ? DISPUTE_ACTIONS[pending.action] : null;
  const latestTimestamp =
    events.length > 0
      ? Math.max(...events.map((e) => new Date(e.timestamp).getTime()))
      : null;

  return (
    <section
      className={`rounded-xl border border-gray-800 bg-gray-900/60 p-6 text-gray-200 ${className}`}
      data-testid="dispute-history-timeline"
      aria-label="Dispute history"
    >
      <header className="flex flex-col gap-2 border-b border-gray-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Dispute History</h2>
          <p className="text-xs text-gray-500">Dispute #{disputeId}</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          data-testid="dispute-timeline-export"
          className="min-h-[44px] rounded-lg border border-gray-700 px-4 text-sm text-white hover:bg-white/5"
        >
          Export CSV
        </button>
      </header>

      {events.length === 0 ? (
        <p
          className="py-8 text-center text-sm text-gray-500"
          data-testid="dispute-timeline-empty"
        >
          No history recorded for this dispute.
        </p>
      ) : (
        <>
          <ol
            className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6 xl:grid-cols-3"
            data-testid="dispute-timeline-grid"
          >
            {events.map((event) => {
              const badge = event.status ? getStatusBadge(event.status) : null;
              const actions =
                onAction && event.status ? getAvailableActions(event.status) : [];
              return (
                <li
                  key={event.id}
                  data-testid={`timeline-event-${event.id}`}
                  className="min-w-0 rounded-lg border border-gray-800 bg-gray-950/40 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {badge && (
                        <span
                          data-testid={`dispute-timeline-badge-${event.id}`}
                          data-status={badge.status}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${badge.className}`}
                        >
                          <span aria-hidden="true">{badge.glyph}</span>
                          {badge.label}
                        </span>
                      )}
                      <h4 className="truncate text-sm font-semibold text-white">
                        {event.title}
                      </h4>
                    </div>
                    <time
                      dateTime={event.timestamp}
                      className="font-mono text-xs text-gray-500"
                    >
                      {new Date(event.timestamp).toLocaleDateString()}
                    </time>
                  </div>
                  <p className="mt-1 break-words text-xs text-gray-300">
                    {event.description}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-wider text-gray-500">
                    {event.actorRole} ·{" "}
                    <span className="font-mono normal-case">{event.actor}</span>
                  </p>
                  {actions.length > 0 && (
                    <div className="mt-3 flex gap-2">
                      {actions.map((action) => (
                        <button
                          key={action}
                          type="button"
                          onClick={() => openConfirmation(action, event)}
                          data-testid={`dispute-timeline-${action}-${event.id}`}
                          className="min-h-[44px] rounded-lg border border-gray-700 px-3 text-xs text-white hover:bg-white/5"
                        >
                          {DISPUTE_ACTIONS[action].buttonLabel}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <p
            className="mt-4 text-xs text-gray-500"
            data-testid="dispute-timeline-summary"
          >
            Showing {events.length} event{events.length !== 1 ? "s" : ""}
            {latestTimestamp !== null &&
              ` • latest ${new Date(latestTimestamp).toLocaleDateString()}`}
          </p>
        </>
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

      {pending && actionConfig && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dispute-timeline-confirm-title"
          data-testid="dispute-timeline-confirm-dialog"
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 sm:items-center"
        >
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6">
            <h3
              id="dispute-timeline-confirm-title"
              className="text-lg font-semibold text-white"
            >
              {actionConfig.confirmTitle}
            </h3>
            <p className="mt-2 text-sm text-gray-300">{actionConfig.warning}</p>
            <label className="mt-4 flex items-start gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={confirmation.acknowledged}
                disabled={confirmation.submitting}
                onChange={(e) =>
                  setConfirmation((prev) => ({ ...prev, acknowledged: e.target.checked }))
                }
                data-testid="dispute-timeline-confirm-ack"
                className="mt-0.5 h-4 w-4"
              />
              I understand this signs a transaction and cannot be undone.
            </label>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeConfirmation}
                disabled={confirmation.submitting}
                data-testid="dispute-timeline-confirm-cancel"
                className="min-h-[44px] rounded-lg border border-gray-700 px-4 text-sm text-white hover:bg-white/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canSubmitAction(confirmation)}
                data-testid="dispute-timeline-confirm-submit"
                className="min-h-[44px] rounded-lg bg-red-600 px-4 text-sm text-white hover:opacity-90 disabled:opacity-50"
              >
                {confirmation.submitting ? "Signing..." : actionConfig.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
