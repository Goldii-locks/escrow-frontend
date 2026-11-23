"use client";

import { formatAddress } from "@/app/components/WalletBadge";
import { formatBaseUnits } from "@/app/lib/amounts";
import ButtonSpinner from "./ButtonSpinner";

export interface RefundConfirmModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Called when the user dismisses the modal. */
  onClose: () => void;
  /** Called when the user confirms the refund. */
  onConfirm: () => void;
  /** Refund action being confirmed. */
  action: "withdraw_unaccepted" | "reclaim_overdue";
  /** Amount being returned, in stroops. */
  amountStroops: string;
  /** Token decimals used to render the human-readable amount. */
  decimals?: number;
  /** Token symbol used to render the human-readable amount. */
  symbol?: string;
  /** Whether the confirm action is in flight. */
  isConfirming?: boolean;
}

const ACTION_COPY: Record<
  "withdraw_unaccepted" | "reclaim_overdue",
  { title: string; confirmLabel: string; note: string }
> = {
  withdraw_unaccepted: {
    title: "Confirm Withdraw Unaccepted",
    confirmLabel: "Withdraw Funds",
    note: "This returns the escrow deposit to you because the freelancer or arbiter has not accepted within 7 days of funding.",
  },
  reclaim_overdue: {
    title: "Confirm Reclaim Overdue",
    confirmLabel: "Reclaim Funds",
    note: "This returns the funds for an overdue, undelivered milestone to you.",
  },
};

export default function RefundConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  action,
  amountStroops,
  decimals = 7,
  symbol = "XLM",
  isConfirming = false,
}: RefundConfirmModalProps) {
  const copy = ACTION_COPY[action];
  const amountHuman = formatBaseUnits(amountStroops, { decimals });

  if (!isOpen) return null;

  return (
    <div
      data-testid="refund-confirm-modal"
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6"
    >
      <div
        data-testid="refund-confirm-modal-panel"
        className="w-full sm:max-w-lg rounded-xl border border-border-subtle bg-surface-card p-6 sm:p-8 shadow-lg"
      >
        <h2
          data-testid="refund-confirm-modal-title"
          className="text-lg font-semibold text-text-primary mb-1"
        >
          {copy.title}
        </h2>

        <p data-testid="refund-confirm-modal-note" className="mb-4 text-sm text-text-secondary">
          {copy.note}
        </p>

        <dl data-testid="refund-confirm-modal-summary" className="mb-4 space-y-2 text-sm">
          <div className="flex justify-between border-b border-border-subtle pb-1">
            <dt className="text-text-muted">Action</dt>
            <dd data-testid="refund-confirm-modal-action" className="font-mono text-text-primary">
              {action.replace("_", " ")}
            </dd>
          </div>
          <div className="flex justify-between border-b border-border-subtle pb-1">
            <dt className="text-text-muted">Amount returned</dt>
            <dd data-testid="refund-confirm-modal-amount" className="font-mono text-text-primary">
              {amountHuman} {symbol}
            </dd>
          </div>
        </dl>

        <div
          data-testid="refund-confirm-modal-actions"
          className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            data-testid="refund-confirm-modal-cancel"
            className="min-h-[44px] px-4 py-2 rounded-lg border border-border-subtle bg-surface-field text-text-primary hover:bg-surface-card/50 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            data-testid="refund-confirm-modal-confirm"
            className="min-h-[44px] px-4 py-2 rounded-lg bg-accent text-text-primary hover:bg-accent/90 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConfirming && <ButtonSpinner className="h-4 w-4" />}
            {isConfirming ? "Submitting…" : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
