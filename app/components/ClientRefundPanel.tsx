"use client";

import { useState } from "react";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";
import {
  type RefundBadgeState,
  getRefundBadge,
} from "@/app/lib/client_refund_panel_badges";
import {
  INITIAL_REFUND_CONFIRM_STATE,
  type RefundConfirmState,
  cancelRefundConfirm,
  canSubmitRefund,
  confirmRefundStep,
  getRefundConfirmCopy,
  openRefundConfirm,
} from "@/app/lib/client_refund_panel_modals";
import {
  type RefundExportRow,
  handleRefundExport,
  refundExportFilename,
} from "@/app/lib/client_refund_panel_export";
import { REFUND_PANEL_GRID_CLASS } from "@/app/lib/client_refund_panel_grid";

export interface ClientRefundPanelProps {
  /** Job ID for the refund panel. */
  jobId?: string;
  /** Whether data is currently loading. */
  isLoading?: boolean;
  /** Refund request action handler. */
  onRefund?: () => void;
  /** Pending state for refund action. */
  isRefundPending?: boolean;
  /** Refundable amount display string. */
  refundableAmount?: string;
  /** Token symbol, e.g. "USDC". */
  token?: string;
  /** Current refund state for the badge. */
  refundState?: RefundBadgeState;
  /** Rows to include in the CSV export. */
  exportRows?: RefundExportRow[];
  className?: string;
}

/**
 * Client refund request panel.
 *
 * Wires together:
 * - #504 state badges (client_refund_panel_badges)
 * - #505 double-confirm validation modal (client_refund_panel_modals)
 * - #507 CSV export button handler (client_refund_panel_export)
 * - #508 responsive grid layout (client_refund_panel_grid)
 */
export default function ClientRefundPanel({
  jobId,
  isLoading = false,
  onRefund,
  isRefundPending = false,
  refundableAmount = "0.00 USDC",
  token = "USDC",
  refundState = "pending_refund",
  exportRows = [],
  className = "",
}: ClientRefundPanelProps) {
  const [confirmState, setConfirmState] = useState<RefundConfirmState>(
    INITIAL_REFUND_CONFIRM_STATE,
  );

  const badge = getRefundBadge(refundState);

  // Extract the numeric amount string from the display string (e.g. "10.00 USDC" → "10.00")
  const amountOnly = refundableAmount.split(" ")[0] ?? refundableAmount;

  function handleRequestRefundClick() {
    setConfirmState(openRefundConfirm());
  }

  function handleConfirmStep() {
    const result = confirmRefundStep(confirmState);
    if (result.submit) {
      onRefund?.();
    }
    setConfirmState(result.state);
  }

  function handleCancelConfirm() {
    setConfirmState(cancelRefundConfirm());
  }

  function handleExportClick() {
    handleRefundExport(exportRows, refundExportFilename());
  }

  if (isLoading) {
    return (
      <div
        data-testid="client-refund-panel-loading"
        aria-busy="true"
        aria-label="Loading client refund panel"
        className={`space-y-4 ${className}`}
      >
        <LoadingSkeleton data-testid="client-refund-skeleton" />
      </div>
    );
  }

  const isModalOpen = confirmState.step !== "closed";
  const confirmCopy = getRefundConfirmCopy(confirmState.step, amountOnly, token);

  return (
    <>
      <div
        data-testid="client-refund-panel"
        className={`rounded-xl border border-border-subtle bg-surface-card p-6 space-y-4 ${className}`}
      >
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              Client Refund Request
            </h3>
            {jobId && (
              <p className="text-xs text-text-secondary font-mono mt-1">
                Job ID: {jobId}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* #504 — Status badge */}
            <span
              data-testid="client-refund-status-badge"
              aria-label={badge.ariaLabel}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${badge.className}`}
            >
              <span aria-hidden="true" data-icon={badge.icon} />
              {badge.label}
            </span>
            <div className="text-right">
              <span className="text-xs uppercase tracking-wide text-text-secondary block">
                Refundable Amount
              </span>
              <span className="text-lg font-bold text-text-primary">
                {refundableAmount}
              </span>
            </div>
          </div>
        </div>

        {/* #508 — Responsive grid for details */}
        <div
          data-testid="client-refund-panel-grid"
          className={REFUND_PANEL_GRID_CLASS}
        >
          <div className="min-w-0 rounded-lg bg-surface-raised p-3 space-y-1">
            <p className="text-xs text-text-secondary uppercase tracking-wide">
              Status
            </p>
            <p className="text-sm font-medium text-text-primary truncate">
              {badge.label}
            </p>
          </div>
          <div className="min-w-0 rounded-lg bg-surface-raised p-3 space-y-1">
            <p className="text-xs text-text-secondary uppercase tracking-wide">
              Amount
            </p>
            <p className="text-sm font-medium text-text-primary truncate">
              {refundableAmount}
            </p>
          </div>
          <div className="min-w-0 rounded-lg bg-surface-raised p-3 space-y-1">
            <p className="text-xs text-text-secondary uppercase tracking-wide">
              Job
            </p>
            <p className="text-sm font-mono text-text-primary break-all">
              {jobId ?? "—"}
            </p>
          </div>
        </div>

        {/* Actions row */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {/* #505 — Opens double-confirm modal */}
          <button
            type="button"
            onClick={handleRequestRefundClick}
            disabled={isRefundPending}
            data-testid="client-refund-request-button"
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition"
          >
            {isRefundPending ? "Requesting Refund..." : "Request Refund"}
          </button>

          {/* #507 — CSV export */}
          <button
            type="button"
            onClick={handleExportClick}
            disabled={exportRows.length === 0}
            data-testid="client-refund-export-button"
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-border-subtle hover:bg-surface-raised disabled:opacity-50 text-text-primary font-medium text-sm transition"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* #505 — Double-confirm validation modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-confirm-title"
          data-testid="client-refund-confirm-modal"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full sm:max-w-lg rounded-xl border border-border-subtle bg-surface-card p-6 space-y-4">
            <h2
              id="refund-confirm-title"
              className="text-lg font-semibold text-text-primary"
            >
              {confirmCopy.title}
            </h2>
            <p className="text-sm text-text-secondary">{confirmCopy.body}</p>

            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={handleCancelConfirm}
                data-testid="client-refund-confirm-cancel"
                className="min-h-[44px] px-4 py-2 rounded-lg border border-border-subtle hover:bg-surface-raised text-text-primary text-sm transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmStep}
                disabled={
                  isRefundPending ||
                  (confirmState.step === "final" && !canSubmitRefund(confirmState))
                }
                data-testid="client-refund-confirm-proceed"
                className="min-h-[44px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition"
              >
                {confirmCopy.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
