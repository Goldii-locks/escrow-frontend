"use client";

import { useCallback, useState } from "react";
import { useDisputeViewport } from "@/app/hooks/useDisputeViewport";
import {
  DISPUTE_MODAL_CLASSES,
  DISPUTE_REASON_MAX_LENGTH,
  getDisputeModalLayout,
  validateDisputeReason,
} from "@/app/lib/dispute_raise_modal";
import ButtonSpinner from "./ButtonSpinner";

export interface DisputeRaiseModalProps {
  /** Whether the modal is currently visible. */
  isOpen: boolean;
  /** Called when the user dismisses the modal. */
  onClose: () => void;
  /** Called with the validated reason when the user confirms the dispute. */
  onConfirm?: (reason: string) => void;
  /** Job the dispute is being raised against. */
  jobId?: string | null;
  /** Milestone index the dispute targets, when scoped to one milestone. */
  milestoneIndex?: number | null;
  /** Disputed amount, pre-formatted for display. */
  amount?: string | null;
  /** Counterparty address shown in the summary. */
  counterparty?: string | null;
  /** Whether the confirm action is in flight. */
  isSubmitting?: boolean;
  /** Provider/contract error surfaced above the actions. */
  errorMessage?: string | null;
  className?: string;
}

/**
 * Dispute raise confirmation modal.
 *
 * Sizing is mobile-first: a full-bleed bottom sheet with stacked, full-width
 * actions on phones, a centered `sm:max-w-lg` dialog on tablets, and a wider
 * `lg:max-w-2xl` panel on desktop. The summary grid collapses to one column
 * below `sm:` so long addresses and amounts never force horizontal scroll.
 */
export default function DisputeRaiseModal({
  isOpen,
  onClose,
  onConfirm,
  jobId = null,
  milestoneIndex = null,
  amount = null,
  counterparty = null,
  isSubmitting = false,
  errorMessage = null,
  className = "",
}: DisputeRaiseModalProps) {
  const viewport = useDisputeViewport();
  const layout = getDisputeModalLayout(viewport);

  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleConfirm = useCallback(() => {
    const result = validateDisputeReason(reason);

    if (!result.valid) {
      setValidationError(result.error);
      return;
    }

    setValidationError(null);
    onConfirm?.(reason.trim());
  }, [reason, onConfirm]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="dispute-raise-modal"
      data-viewport={layout.viewport}
      role="dialog"
      aria-modal="true"
      aria-label="Raise a dispute"
      className={`${DISPUTE_MODAL_CLASSES.overlay} ${className}`}
    >
      <div
        data-testid="dispute-raise-modal-panel"
        data-full-width={layout.fullWidth}
        data-max-width={layout.maxWidthClass}
        className={DISPUTE_MODAL_CLASSES.panel}
      >
        <div className={DISPUTE_MODAL_CLASSES.header}>
          <h2
            data-testid="dispute-raise-modal-title"
            className={DISPUTE_MODAL_CLASSES.title}
          >
            Raise a Dispute
          </h2>
          <button
            type="button"
            onClick={onClose}
            data-testid="dispute-raise-modal-close"
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] text-secondary hover:text-primary transition-colors"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-secondary">
          Raising a dispute pauses the escrow and hands the decision to the
          arbiter. This cannot be undone from here.
        </p>

        <dl
          data-testid="dispute-raise-modal-summary"
          data-columns={layout.summaryColumns}
          data-stacked={layout.stackSummary}
          className={DISPUTE_MODAL_CLASSES.summary}
        >
          <div className={DISPUTE_MODAL_CLASSES.summaryCell}>
            <dt className="text-muted">Job</dt>
            <dd
              data-testid="dispute-raise-modal-job"
              className="font-mono text-xs text-primary break-all"
            >
              {jobId ?? "—"}
            </dd>
          </div>
          <div className={DISPUTE_MODAL_CLASSES.summaryCell}>
            <dt className="text-muted">Milestone</dt>
            <dd
              data-testid="dispute-raise-modal-milestone"
              className="text-primary"
            >
              {milestoneIndex === null ? "Whole job" : `#${milestoneIndex + 1}`}
            </dd>
          </div>
          <div className={DISPUTE_MODAL_CLASSES.summaryCell}>
            <dt className="text-muted">Amount</dt>
            <dd
              data-testid="dispute-raise-modal-amount"
              className="text-primary truncate"
            >
              {amount ?? "—"}
            </dd>
          </div>
          <div className={DISPUTE_MODAL_CLASSES.summaryCell}>
            <dt className="text-muted">Counterparty</dt>
            <dd
              data-testid="dispute-raise-modal-counterparty"
              className="font-mono text-xs text-primary break-all"
            >
              {counterparty ?? "—"}
            </dd>
          </div>
        </dl>

        <label
          htmlFor="dispute-raise-reason"
          className="mb-1 block text-sm text-secondary"
        >
          Why are you raising this dispute?
        </label>
        <textarea
          id="dispute-raise-reason"
          data-testid="dispute-raise-modal-reason"
          value={reason}
          maxLength={DISPUTE_REASON_MAX_LENGTH}
          disabled={isSubmitting}
          onChange={(e) => setReason(e.target.value)}
          className={DISPUTE_MODAL_CLASSES.textarea}
        />

        {validationError && (
          <p
            data-testid="dispute-raise-modal-validation-error"
            role="alert"
            className="mt-2 text-sm text-danger-soft"
          >
            {validationError}
          </p>
        )}

        {errorMessage && (
          <div
            data-testid="dispute-raise-modal-error"
            role="alert"
            className="mt-3 rounded-lg border border-danger bg-danger/20 px-4 py-3 text-sm text-danger-soft"
          >
            {errorMessage}
          </div>
        )}

        <div
          data-testid="dispute-raise-modal-actions"
          data-stacked={layout.stackActions}
          className={DISPUTE_MODAL_CLASSES.actions}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            data-testid="dispute-raise-modal-cancel"
            className={`${DISPUTE_MODAL_CLASSES.button} border border-white/10 text-primary hover:bg-white/5 disabled:opacity-50`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            data-testid="dispute-raise-modal-confirm"
            className={`${DISPUTE_MODAL_CLASSES.button} flex items-center justify-center gap-2 bg-danger text-white hover:opacity-90 disabled:opacity-50`}
          >
            {isSubmitting && <ButtonSpinner />}
            {isSubmitting ? "Raising Dispute…" : "Raise Dispute"}
          </button>
        </div>
      </div>
    </div>
  );
}
