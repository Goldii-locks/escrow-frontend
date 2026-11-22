"use client";

import { formatAddress } from "@/app/components/WalletBadge";
import { formatBaseUnits } from "@/app/lib/amounts";
import ButtonSpinner from "./ButtonSpinner";

export interface FundConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** Total job amount to transfer, in token base units. */
  amountStroops: string;
  decimals?: number;
  symbol?: string;
  tokenAddress?: string | null;
  escrowAddress?: string | null;
  isConfirming?: boolean;
}

export default function FundConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  amountStroops,
  decimals = 7,
  symbol = "XLM",
  tokenAddress = null,
  escrowAddress = null,
  isConfirming = false,
}: FundConfirmModalProps) {
  if (!isOpen) return null;

  const amount = formatBaseUnits(amountStroops, { decimals });

  return (
    <div
      data-testid="fund-confirm-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm Fund Escrow"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6"
    >
      <div
        data-testid="fund-confirm-modal-panel"
        className="w-full sm:max-w-lg rounded-xl border border-border-subtle bg-surface-card p-6 sm:p-8 shadow-lg"
      >
        <h2
          data-testid="fund-confirm-modal-title"
          className="text-lg font-semibold text-text-primary mb-1"
        >
          Confirm Fund Escrow
        </h2>

        <p data-testid="fund-confirm-modal-warning" className="mb-4 text-sm text-text-secondary">
          Funds stay in the contract until released or refunded. Check the details before you sign.
        </p>

        <dl data-testid="fund-confirm-modal-summary" className="mb-4 space-y-2 text-sm">
          <div className="flex justify-between border-b border-border-subtle pb-1">
            <dt className="text-text-muted">Amount</dt>
            <dd data-testid="fund-confirm-modal-amount" className="font-mono text-text-primary">
              {amount} {symbol}
            </dd>
          </div>
          <div className="flex justify-between border-b border-border-subtle pb-1">
            <dt className="text-text-muted">Token</dt>
            <dd data-testid="fund-confirm-modal-token" className="font-mono text-text-primary">
              {symbol}
              {tokenAddress && (
                <span className="block text-xs text-text-muted">{formatAddress(tokenAddress)}</span>
              )}
            </dd>
          </div>
          {escrowAddress && (
            <div className="flex justify-between border-b border-border-subtle pb-1">
              <dt className="text-text-muted">Escrow contract</dt>
              <dd
                data-testid="fund-confirm-modal-escrow"
                className="font-mono text-text-primary break-all"
              >
                {formatAddress(escrowAddress)}
              </dd>
            </div>
          )}
        </dl>

        <div
          data-testid="fund-confirm-modal-actions"
          className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isConfirming}
            data-testid="fund-confirm-modal-cancel"
            className="min-h-[44px] px-4 py-2 rounded-lg border border-border-subtle bg-surface-field text-text-primary hover:bg-surface-card/50 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            data-testid="fund-confirm-modal-confirm"
            className="min-h-[44px] px-4 py-2 rounded-lg bg-accent text-text-primary hover:bg-accent/90 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConfirming && <ButtonSpinner className="h-4 w-4" />}
            {isConfirming ? "Funding…" : "Fund escrow"}
          </button>
        </div>
      </div>
    </div>
  );
}
