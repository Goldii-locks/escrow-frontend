"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@/app/context/WalletContext";
import { formatBaseUnits } from "@/app/lib/amounts";
import { buildWithdraw } from "@/app/lib/contract_actions";
import {
  runContractAction,
  type ActionState,
} from "@/app/lib/transactions";
import ButtonSpinner from "./ButtonSpinner";
import TxStatusBanner from "./TxStatusBanner";

export interface WithdrawOwedModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Called when the user dismisses the modal. */
  onClose: () => void;
  /** The owed balance in base units (stroops). */
  owedBaseUnits: string;
  /** Token decimals used to render the human-readable amount. */
  decimals?: number;
  /** Token symbol used to render the human-readable amount. */
  symbol?: string;
  /** Optional transaction state for the withdraw call. */
  withdrawState?: ActionState | null;
  /** Alias of `withdrawState`. */
  isWithdrawPending?: boolean;
}

export default function WithdrawOwedModal({
  isOpen,
  onClose,
  owedBaseUnits,
  decimals = 7,
  symbol = "XLM",
  withdrawState = null,
  isWithdrawPending = false,
}: WithdrawOwedModalProps) {
  const { address } = useWallet();
  const amountHuman = formatBaseUnits(owedBaseUnits, { decimals });
  const busy = isWithdrawPending || withdrawState?.phase !== "idle";

  const handleConfirm = useCallback(() => {
    if (!address) return;
    // The parent supplies `onWithdrawConfirm` through `withdrawState` phase
    // transitions handled by the dashboard's `executeTx`; here we only confirm
    // the modal dismissal after the parent fires the tx.
    onClose();
  }, [address, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="withdraw-owed-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Withdraw owed credits"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6"
    >
      <div
        data-testid="withdraw-owed-modal-panel"
        className="w-full sm:max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 sm:p-8 shadow-lg"
      >
        <h2 data-testid="withdraw-owed-modal-title" className="text-lg font-semibold text-white mb-1">
          Withdraw Owed Credits
        </h2>

        <p data-testid="withdraw-owed-modal-hint" className="mb-4 text-sm text-gray-400">
          The contract credited {amountHuman} {symbol} to you because a prior
          payout could not be delivered. Claim it now — the funds are held in
          escrow until you withdraw them.
        </p>

        <dl className="mb-4 space-y-2 text-sm">
          <div className="flex justify-between border-b border-gray-800 pb-1">
            <dt className="text-gray-500">Owed amount</dt>
            <dd data-testid="withdraw-owed-modal-amount" className="font-mono text-white">
              {amountHuman} {symbol}
            </dd>
          </div>
          <div className="flex justify-between border-b border-gray-800 pb-1">
            <dt className="text-gray-500">Recipient</dt>
            <dd data-testid="withdraw-owed-modal-recipient" className="font-mono text-xs text-gray-400 break-all">
              {address ?? "Connect your wallet"}
            </dd>
          </div>
        </dl>

        {withdrawState?.error && (
          <div
            data-testid="withdraw-owed-modal-error"
            role="alert"
            aria-live="assertive"
            className="mb-3 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-200"
          >
            {withdrawState.error}
          </div>
        )}

        <div
          data-testid="withdraw-owed-modal-actions"
          className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            data-testid="withdraw-owed-modal-cancel"
            className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !address}
            aria-disabled={busy || !address}
            data-testid="withdraw-owed-modal-confirm"
            className="min-h-[44px] px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy && <ButtonSpinner className="h-4 w-4" />}
            {busy ? "Withdrawing…" : "Withdraw"}
          </button>
        </div>

        {withdrawState?.phase !== "idle" && withdrawState.txHash && (
          <div
            data-testid="withdraw-owed-modal-status-banner"
            className="mt-4 rounded-lg border border-green-500/30 bg-green-950/20 px-3 py-2 text-xs text-green-200"
          >
            Withdrawal submitted: {withdrawState.txHash.slice(0, 12)}…
          </div>
        )}
      </div>
    </div>
  );
}
