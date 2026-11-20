"use client";

import { formatAddress } from "@/app/components/WalletBadge";
import { formatBaseUnits } from "@/app/lib/amounts";
import { remainingAmount, type BatchMilestone } from "@/app/lib/batch_approval";
import ButtonSpinner from "./ButtonSpinner";

export interface BatchApproveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** The selected milestones, in the order they will be approved. */
  milestones: BatchMilestone[];
  /** Total released, in base units. */
  totalStroops: string;
  decimals?: number;
  symbol?: string;
  /** Full address of the freelancer receiving the funds. */
  recipientAddress?: string | null;
  isConfirming?: boolean;
  /** Error from the last attempt, shown above the actions. */
  errorMessage?: string | null;
}

/**
 * Confirmation for approving several delivered milestones in one
 * `approve_milestones` transaction (#899). Lists each milestone with the
 * amount it releases and the total, before anything is signed.
 */
export default function BatchApproveModal({
  isOpen,
  onClose,
  onConfirm,
  milestones,
  totalStroops,
  decimals = 7,
  symbol = "XLM",
  recipientAddress = null,
  isConfirming = false,
  errorMessage = null,
}: BatchApproveModalProps) {
  if (!isOpen) return null;

  const format = (value: string) => `${formatBaseUnits(value, { decimals })} ${symbol}`;

  return (
    <div
      data-testid="batch-approve-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm batch approval"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6"
    >
      <div className="w-full sm:max-w-lg rounded-xl border border-border-subtle bg-surface-card p-6 sm:p-8 shadow-lg">
        <h2 className="text-lg font-semibold text-text-primary mb-1">
          Approve {milestones.length} milestone{milestones.length === 1 ? "" : "s"}
        </h2>
        <p className="mb-4 text-sm text-text-secondary">
          This releases the funds for every milestone below to the freelancer in a single
          transaction. This cannot be undone.
        </p>

        <ul data-testid="batch-approve-modal-list" className="mb-3 space-y-1 text-sm">
          {milestones.map((m) => {
            const remaining = remainingAmount(m);
            return (
              <li
                key={m.index}
                data-testid="batch-approve-modal-item"
                className="flex justify-between border-b border-border-subtle pb-1"
              >
                <span className="text-text-muted">Milestone {m.index + 1}</span>
                <span className="font-mono text-text-primary">
                  {remaining !== null ? format(remaining.toString()) : m.amount}
                </span>
              </li>
            );
          })}
        </ul>

        <dl className="mb-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="font-medium text-text-secondary">Total</dt>
            <dd
              data-testid="batch-approve-modal-total"
              className="font-mono font-semibold text-text-primary"
            >
              {format(totalStroops)}
            </dd>
          </div>
          {recipientAddress && (
            <div className="flex justify-between">
              <dt className="text-text-muted">Funds go to freelancer</dt>
              <dd className="font-mono text-text-primary break-all">
                {formatAddress(recipientAddress)}
              </dd>
            </div>
          )}
        </dl>

        {errorMessage && (
          <p
            role="alert"
            data-testid="batch-approve-modal-error"
            className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger-soft"
          >
            {errorMessage}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            data-testid="batch-approve-modal-cancel"
            className="min-h-[44px] px-4 py-2 rounded-lg border border-border-subtle bg-surface-field text-text-primary hover:bg-surface-card/50 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming || milestones.length === 0}
            data-testid="batch-approve-modal-confirm"
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-success text-surface-page hover:bg-success/80 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConfirming && <ButtonSpinner className="h-4 w-4" />}
            {isConfirming ? "Approving…" : "Approve & Release All"}
          </button>
        </div>
      </div>
    </div>
  );
}
