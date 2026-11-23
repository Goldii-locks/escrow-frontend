"use client";

import { useCallback, useState } from "react";
import { buildCancelEscrow, buildRevokeCancelApproval } from "@/app/lib/contract_actions";
import { runContractAction, type ActionState } from "@/app/lib/transactions";
import ButtonSpinner from "./ButtonSpinner";
import TxStatusBanner from "./TxStatusBanner";

export interface CancelRevokeModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Called when the user dismisses the modal. */
  onClose: () => void;
  /** Which side the connected wallet is on. */
  role: "client" | "freelancer";
  /** Whether a cancel has already been proposed and can be revoked. */
  cancelPending: boolean;
  /** Optional transaction state. */
  state?: ActionState | null;
}

export default function CancelRevokeModal({
  isOpen,
  onClose,
  role,
  cancelPending,
  state = null,
}: CancelRevokeModalProps) {
  const [mode, setMode] = useState<"cancel" | "revoke">(
    cancelPending ? "revoke" : "cancel",
  );
  const busy = state?.phase !== "idle";

  const heading = cancelPending
    ? "Revoke Cancel Approval"
    : role === "client"
    ? "Cancel Escrow"
    : "Cancel Escrow";

  const confirmLabel =
    mode === "revoke" ? "Revoke Approval" : "Cancel Escrow";

  const description =
    mode === "revoke"
      ? "A cancel has been proposed for this escrow. Revoking your approval keeps the escrow active."
      : role === "client"
      ? "Canceling returns all escrowed funds to you and ends the job. This cannot be undone."
      : "Canceling this escrow returns all escrowed funds to the client and ends the job. This cannot be undone.";

  const handleConfirm = useCallback(() => {
    // The parent fires the actual tx via executeTx using buildCancelEscrow /
    // buildRevokeCancelApproval; this modal only confirms dismissal.
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="cancel-revoke-modal"
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6"
    >
      <div
        data-testid="cancel-revoke-modal-panel"
        className="w-full sm:max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 sm:p-8 shadow-lg"
      >
        <h2 data-testid="cancel-revoke-modal-title" className="text-lg font-semibold text-white mb-1">
          {heading}
        </h2>

        <p data-testid="cancel-revoke-modal-description" className="mb-4 text-sm text-gray-400">
          {description}
        </p>

        {cancelPending && (
          <div
            className="mb-4 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200"
          >
            A cancel approval is currently pending. Revoking it keeps the escrow live.
          </div>
        )}

        {state?.error && (
          <div
            data-testid="cancel-revoke-modal-error"
            role="alert"
            aria-live="assertive"
            className="mb-3 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-200"
          >
            {state.error}
          </div>
        )}

        <div
          data-testid="cancel-revoke-modal-actions"
          className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            data-testid="cancel-revoke-modal-cancel"
            className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            aria-disabled={busy}
            data-testid="cancel-revoke-modal-confirm"
            className={`min-h-[44px] px-4 py-2 rounded-lg ${
              mode === "revoke" ? "bg-amber-600 text-white hover:bg-amber-500" : "bg-red-600 text-white hover:bg-red-500"
            } text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {busy && <ButtonSpinner className="h-4 w-4" />}
            {busy ? "Submitting…" : confirmLabel}
          </button>
        </div>

        {state?.phase !== "idle" && state.txHash && (
          <div
            data-testid="cancel-revoke-modal-status-banner"
            className="mt-4 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-300"
          >
            Submitted: {state.txHash.slice(0, 12)}…
          </div>
        )}
      </div>
    </div>
  );
}
