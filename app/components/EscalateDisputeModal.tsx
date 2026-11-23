"use client";

import { useCallback } from "react";
import { buildEscalateDispute } from "@/app/lib/contract_actions";
import { runContractAction, type ActionState } from "@/app/lib/transactions";
import ButtonSpinner from "./ButtonSpinner";
import TxStatusBanner from "./TxStatusBanner";

export interface EscalateDisputeModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Called when the user dismisses the modal. */
  onClose: () => void;
  /** Milestone index being escalated. */
  milestoneIndex: number;
  /** Timestamp (epoch ms) when the dispute was raised. */
  disputedAtMs: number | null;
  /** Escrow dispute timeout in ms (e.g. 30 days). */
  disputeTimeoutMs: number | null;
  /** Optional transaction state. */
  state?: ActionState | null;
}

export default function EscalateDisputeModal({
  isOpen,
  onClose,
  milestoneIndex,
  disputedAtMs = null,
  disputeTimeoutMs = null,
  state = null,
}: EscalateDisputeModalProps) {
  const milestoneNumber = milestoneIndex + 1;
  const busy = state?.phase !== "idle";

  const escalationAtMs =
    disputedAtMs != null && disputeTimeoutMs != null
      ? disputedAtMs + disputeTimeoutMs
      : null;

  const handleConfirm = useCallback(() => {
    // The parent fires the tx via executeTx using buildEscalateDispute;
    // this modal confirms dismissal.
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="escalate-dispute-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Escalate dispute — Milestone ${milestoneNumber}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6"
    >
      <div
        data-testid="escalate-dispute-modal-panel"
        className="w-full sm:max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 sm:p-8 shadow-lg"
      >
        <h2 data-testid="escalate-dispute-modal-title" className="text-lg font-semibold text-white mb-1">
          Escalate Dispute — Milestone {milestoneNumber}
        </h2>

        <p data-testid="escalate-dispute-modal-hint" className="mb-4 text-sm text-gray-400">
          Escalating hands this dispute to a senior arbiter. It restores the
          milestone to its pre-dispute status and restarts the review window.
          This requires signing a transaction and cannot be undone.
        </p>

        {disputedAtMs != null && disputeTimeoutMs != null && (
          <div data-testid="escalate-dispute-modal-timing" className="mb-4 space-y-1">
            <p className="text-xs text-gray-400">Dispute raised</p>
            <p
              data-testid="escalate-dispute-modal-disputed-at"
              className="font-mono text-xs text-white"
            >
              {new Date(disputedAtMs).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-1">Escalation available after</p>
            <p
              data-testid="escalate-dispute-modal-escalation-at"
              className="font-mono text-xs text-white"
            >
              {escalationAtMs != null ? new Date(escalationAtMs).toLocaleString() : "—"}
            </p>
          </div>
        )}

        {state?.error && (
          <div
            data-testid="escalate-dispute-modal-error"
            role="alert"
            aria-live="assertive"
            className="mb-3 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-200"
          >
            {state.error}
          </div>
        )}

        <div
          data-testid="escalate-dispute-modal-actions"
          className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            data-testid="escalate-dispute-modal-cancel"
            className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            aria-disabled={busy}
            data-testid="escalate-dispute-modal-confirm"
            className="min-h-[44px] px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy && <ButtonSpinner className="h-4 w-4" />}
            {busy ? "Escalating…" : "Escalate Dispute"}
          </button>
        </div>

        {state?.phase !== "idle" && state.txHash && (
          <div
            data-testid="escalate-dispute-modal-status-banner"
            className="mt-4 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-300"
          >
            Submitted: {state.txHash.slice(0, 12)}…
          </div>
        )}
      </div>
    </div>
  );
}
