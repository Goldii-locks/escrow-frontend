"use client";

import { useCallback, useState } from "react";
import { buildApplyDisputeArbitrationSplit } from "@/app/lib/contract_actions";
import { runContractAction, type ActionState } from "@/app/lib/transactions";
import ButtonSpinner from "./ButtonSpinner";
import TxStatusBanner from "./TxStatusBanner";

/** Total basis points: client + freelancer must equal 10_000. */
export const SPLIT_BPS_SCALE = 10_000;

export interface SplitResolutionModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Called when the user dismisses the modal. */
  onClose: () => void;
  /** Milestone index being resolved. */
  milestoneIndex: number;
  /** Disputed amount, pre-formatted for display. */
  amount?: string | null;
  /** Optional transaction state. */
  state?: ActionState | null;
}

export default function SplitResolutionModal({
  isOpen,
  onClose,
  milestoneIndex,
  amount = null,
  state = null,
}: SplitResolutionModalProps) {
  const [clientBps, setClientBps] = useState<string>("5000");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const busy = state?.phase !== "idle";

  const milestoneNumber = milestoneIndex + 1;

  const handleClientBpsChange = useCallback((value: string) => {
    setClientBps(value);
    setFieldError(null);
  }, []);

  const handleConfirm = useCallback(() => {
    const trimmed = clientBps.trim();
    if (!/^\d+$/.test(trimmed)) {
      setFieldError("Enter a whole number of basis points.");
      return;
    }
    const bps = Number(trimmed);
    if (bps < 0 || bps > SPLIT_BPS_SCALE) {
      setFieldError("Client share must be between 0 and 10,000 bps.");
      return;
    }

    setFieldError(null);
    setSubmitError(null);

    // The parent fires the tx via executeTx using buildApplyDisputeArbitrationSplit.
    onClose();
  }, [clientBps, onClose]);

  const freelancerBps = SPLIT_BPS_SCALE - Number(clientBps || 0);

  if (!isOpen) return null;

  return (
    <div
      data-testid="split-resolution-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Apply dispute split — Milestone ${milestoneNumber}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6"
    >
      <div
        data-testid="split-resolution-modal-panel"
        className="w-full sm:max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 sm:p-8 shadow-lg"
      >
        <h2 data-testid="split-resolution-modal-title" className="text-lg font-semibold text-white mb-1">
          Apply Dispute Split — Milestone {milestoneNumber}
        </h2>

        {amount && (
          <p data-testid="split-resolution-modal-amount" className="mb-4 text-sm text-gray-400">
            Disputed amount: <span className="font-mono text-white">{amount}</span>
          </p>
        )}

        <p data-testid="split-resolution-modal-hint" className="mb-4 text-sm text-gray-400">
          Choose how the disputed funds are split between client and freelancer.
          The two shares must total 100%.
        </p>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="split-client-bps"
              className="mb-1 block text-sm text-gray-300"
            >
              Client share
            </label>
            <div className="flex items-end gap-1">
              <input
                id="split-client-bps"
                data-testid="split-resolution-modal-client-bps"
                type="text"
                inputMode="numeric"
                value={clientBps}
                placeholder="5000"
                disabled={busy}
                onChange={(e) => handleClientBpsChange(e.target.value)}
                aria-invalid={fieldError ? "true" : "false"}
                className="w-32 text-xs px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-gray-500">bps</span>
            </div>
            {fieldError && (
              <p
                data-testid="split-resolution-modal-field-error"
                role="alert"
                aria-live="polite"
                className="mt-1 text-xs text-red-200"
              >
                {fieldError}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs text-gray-400">
            <div>
              <span className="block text-gray-500">Client</span>
              <span
                data-testid="split-resolution-modal-client-pct"
                className="font-mono text-white"
              >
                {((Number(clientBps || 0) / SPLIT_BPS_SCALE) * 100).toFixed(2)}%
              </span>
            </div>
            <div>
              <span className="block text-gray-500">Freelancer</span>
              <span
                data-testid="split-resolution-modal-freelancer-pct"
                className="font-mono text-white"
              >
                {((freelancerBps / SPLIT_BPS_SCALE) * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        </div>

        {submitError && (
          <div
            data-testid="split-resolution-modal-error"
            role="alert"
            aria-live="assertive"
            className="mt-3 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-200"
          >
            {submitError}
          </div>
        )}

        {state?.phase !== "idle" && (
          <TxStatusBanner
            state={state}
            successMessage="Dispute split applied successfully."
          />
        )}

        <div
          data-testid="split-resolution-modal-actions"
          className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            data-testid="split-resolution-modal-cancel"
            className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !!fieldError}
            aria-disabled={busy || !!fieldError}
            data-testid="split-resolution-modal-confirm"
            className="min-h-[44px] px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy && <ButtonSpinner className="h-4 w-4" />}
            {busy ? "Applying…" : "Apply Split"}
          </button>
        </div>

        {state?.phase !== "idle" && state.txHash && (
          <div
            data-testid="split-resolution-modal-status-banner"
            className="mt-4 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-300"
          >
            Submitted: {state.txHash.slice(0, 12)}…
          </div>
        )}
      </div>
    </div>
  );
}
