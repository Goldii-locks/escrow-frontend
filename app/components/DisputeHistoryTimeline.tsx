"use client";

import { useCallback, useState } from "react";
import { useToast } from "@/app/context/ToastContext";
import {
  DISPUTE_ACTIONS,
  EXPORT_EMPTY_TOAST,
  EXPORT_SUCCESS_TOAST,
  INITIAL_CONFIRMATION_STATE,
  canSubmitAction,
  downloadTimelineCsv,
  getActionToast,
  getAvailableActions,
  getExportFilename,
  getStatusBadge,
  type ConfirmationState,
  type DisputeTimelineAction,
  type DisputeTimelineEvent,
} from "@/app/lib/dispute_history_timeline";

export interface DisputeHistoryTimelineProps {
  disputeId: string;
  events: DisputeTimelineEvent[];
  /**
   * Signs and submits the transaction for an action. Only called after the
   * user has completed the confirmation dialog. Reject to surface an error toast.
   */
  onAction?: (action: DisputeTimelineAction, event: DisputeTimelineEvent) => Promise<void> | void;
  className?: string;
}

interface PendingAction {
  action: DisputeTimelineAction;
  event: DisputeTimelineEvent;
}

export default function DisputeHistoryTimeline({
  disputeId,
  events,
  onAction,
  className = "",
}: DisputeHistoryTimelineProps) {
  const { showToast } = useToast();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState>(INITIAL_CONFIRMATION_STATE);

  const openConfirmation = (action: DisputeTimelineAction, event: DisputeTimelineEvent) => {
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

  const handleExport = useCallback(() => {
    const ok = downloadTimelineCsv(events, getExportFilename(disputeId));
    const toast = ok ? EXPORT_SUCCESS_TOAST : EXPORT_EMPTY_TOAST;
    showToast(toast.message, toast.type);
  }, [events, disputeId, showToast]);

  const actionConfig = pending ? DISPUTE_ACTIONS[pending.action] : null;

  return (
    <section
      className={`rounded-xl border border-border-strong bg-surface-card p-6 text-text-secondary ${className}`}
      data-testid="dispute-history-timeline"
      aria-label="Dispute history"
    >
      <header className="flex flex-col gap-2 border-b border-border-strong pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Dispute History</h2>
          <p className="text-xs text-text-muted">Dispute #{disputeId}</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          data-testid="dispute-timeline-export"
          className="min-h-[44px] rounded-lg border border-border-subtle px-4 text-sm text-text-primary hover:bg-white/5"
        >
          Export CSV
        </button>
      </header>

      {events.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted" data-testid="dispute-timeline-empty">
          No history recorded for this dispute yet.
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {events.map((event) => {
            const badge = getStatusBadge(event.status);
            const actions = onAction ? getAvailableActions(event.status) : [];
            return (
              <li
                key={event.id}
                data-testid={`dispute-timeline-event-${event.id}`}
                className="rounded-lg border border-border-strong bg-surface-page/40 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      data-testid={`dispute-timeline-badge-${event.id}`}
                      data-status={badge.status}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${badge.className}`}
                    >
                      <span aria-hidden="true">{badge.glyph}</span>
                      {badge.label}
                    </span>
                    <h3 className="text-sm font-semibold text-text-primary">{event.title}</h3>
                  </div>
                  <time dateTime={event.occurredAt} className="font-mono text-xs text-text-muted">
                    {new Date(event.occurredAt).toLocaleString()}
                  </time>
                </div>
                <p className="mt-2 text-xs leading-relaxed">{event.description}</p>
                <p className="mt-1 text-xs text-text-muted">By {event.actor}</p>
                {actions.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {actions.map((action) => (
                      <button
                        key={action}
                        type="button"
                        onClick={() => openConfirmation(action, event)}
                        data-testid={`dispute-timeline-${action}-${event.id}`}
                        className="min-h-[44px] rounded-lg border border-border-subtle px-3 text-xs text-text-primary hover:bg-white/5"
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
      )}

      {pending && actionConfig && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="dispute-timeline-confirm-title"
          data-testid="dispute-timeline-confirm-dialog"
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 sm:items-center"
        >
          <div className="w-full max-w-md rounded-xl border border-border-subtle bg-surface-card p-6">
            <h3 id="dispute-timeline-confirm-title" className="text-lg font-semibold text-text-primary">
              {actionConfig.confirmTitle}
            </h3>
            <p className="mt-2 text-sm text-text-secondary">{actionConfig.warning}</p>
            <label className="mt-4 flex items-start gap-2 text-sm text-text-secondary">
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
                className="min-h-[44px] rounded-lg border border-border-subtle px-4 text-sm text-text-primary hover:bg-white/5 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!canSubmitAction(confirmation)}
                data-testid="dispute-timeline-confirm-submit"
                className="min-h-[44px] rounded-lg bg-danger px-4 text-sm text-white hover:opacity-90 disabled:opacity-50"
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
