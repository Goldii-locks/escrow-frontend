"use client";

import { formatAddress } from "@/app/components/WalletBadge";
import { formatBaseUnits } from "@/app/lib/amounts";
import ButtonSpinner from "./ButtonSpinner";

export interface ReleaseConfirmModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Called when the user dismisses the modal. */
  onClose: () => void;
  /** Called when the user confirms the release. */
  onConfirm: () => void;
  /** Action being confirmed: "approve" releases the full milestone, "partial-release" releases the entered amount. */
  action: "approve" | "partial-release";
  /** Amount being released, in stroops. */
  amountStroops: string;
  /** Token decimals used to render the human-readable amount. */
  decimals?: number;
  /** Token symbol used to render the human-readable amount. */
  symbol?: string;
  /** Full address of the recipient (freelancer), shown shortened. */
  recipientAddress?: string | null;
  /** Remaining escrow balance after the release, in stroops. */
  remainingBalanceStroops?: string | null;
  /** Whether the confirm action is in flight. */
  isConfirming?: boolean;
}

const ACTION_COPY: Record<
  "approve" | "partial-release",
  { title: string; confirmLabel: string; recipientLabel: string }
> = {
  approve: {
    title: "Confirm Approve & Release",
    confirmLabel: "Approve & Release",
    recipientLabel: "Funds go to freelancer",
  },
  "partial-release": {
    title: "Confirm Partial Release",
    confirmLabel: "Release Amount",
    recipientLabel: "Funds go to freelancer",
  },
};

export default function ReleaseConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  action,
  amountStroops,
  decimals = 7,
  symbol = "XLM",
  recipientAddress = null,
  remainingBalanceStroops = null,
  isConfirming = false,
}: ReleaseConfirmModalProps) {
  const copy = ACTION_COPY[action];
  const amountHuman = formatBaseUnits(amountStroops, { decimals });
  const remainingHuman =
    remainingBalanceStroops != null ? formatBaseUnits(remainingBalanceStroops, { decimals }) : null;

  if (!isOpen) return null;

  return (
    <div
      data-testid="release-confirm-modal"
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6"
    >
      <div
        data-testid="release-confirm-modal-panel"
        className="w-full sm:max-w-lg rounded-xl border border-border-subtle bg-surface-card p-6 sm:p-8 shadow-lg"
      >
        <h2
          data-testid="release-confirm-modal-title"
          className="text-lg font-semibold text-text-primary mb-1"
        >
          {copy.title}
        </h2>

        <p data-testid="release-confirm-modal-warning" className="mb-4 text-sm text-text-secondary">
          This will release funds to the freelancer. This cannot be undone.
        </p>

        <dl data-testid="release-confirm-modal-summary" className="mb-4 space-y-2 text-sm">
          <div className="flex justify-between border-b border-border-subtle pb-1">
            <dt className="text-text-muted">Amount</dt>
            <dd data-testid="release-confirm-modal-amount" className="font-mono text-text-primary">
              {amountHuman} {symbol}
            </dd>
          </div>
          {recipientAddress && (
            <div className="flex justify-between border-b border-border-subtle pb-1">
              <dt className="text-text-muted">{copy.recipientLabel}</dt>
              <dd
                data-testid="release-confirm-modal-recipient"
                className="font-mono text-text-primary break-all"
              >
                {formatAddress(recipientAddress)}
              </dd>
            </div>
          )}
          {remainingHuman != null && (
            <div className="flex justify-between border-b border-border-subtle pb-1">
              <dt className="text-text-muted">Remaining in escrow after release</dt>
              <dd
                data-testid="release-confirm-modal-remaining"
                className="font-mono text-text-primary"
              >
                {remainingHuman} {symbol}
              </dd>
            </div>
          )}
        </dl>

        <div
          data-testid="release-confirm-modal-actions"
          className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            data-testid="release-confirm-modal-cancel"
            className="min-h-[44px] px-4 py-2 rounded-lg border border-border-subtle bg-surface-field text-text-primary hover:bg-surface-card/50 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            data-testid="release-confirm-modal-confirm"
            className="min-h-[44px] px-4 py-2 rounded-lg bg-accent text-text-primary hover:bg-accent/90 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConfirming && <ButtonSpinner className="h-4 w-4" />}
            {isConfirming ? "Releasing…" : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
