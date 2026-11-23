"use client";

import { useCallback } from "react";
import {
  buildAdminOverrideRelease,
  buildAdminOverrideRefund,
} from "@/app/lib/contract_actions";
import { runContractAction, type ActionState } from "@/app/lib/transactions";
import ButtonSpinner from "./ButtonSpinner";
import TxStatusBanner from "./TxStatusBanner";

export interface AdminOverrideModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Called when the user dismisses the modal. */
  onClose: () => void;
  /** Milestone index being overridden. */
  milestoneIndex: number;
  /** Override kind: "release" sends funds to the freelancer, "refund" to the client. */
  kind: "release" | "refund";
  /** Optional transaction state. */
  state?: ActionState | null;
}

const OVERHEAD_LABEL: Record<
  "release" | "refund",
  { title: string; confirm: string; desc: string; tone: string }
> = {
  release: {
    title: "Override — Release to Freelancer",
    confirm: "Release Funds",
    desc: "As an admin, force-release the escrowed funds for this milestone to the freelancer. This bypasses the normal review flow and cannot be undone.",
    tone: "bg-green-600 hover:bg-green-500",
  },
  refund: {
    title: "Override — Refund to Client",
    confirm: "Refund Funds",
    desc: "As an admin, force-refund the escrowed funds for this milestone to the client. This bypasses the normal review flow and cannot be undone.",
    tone: "bg-red-600 hover:bg-red-500",
  },
};

export default function AdminOverrideModal({
  isOpen,
  onClose,
  milestoneIndex,
  kind,
  state = null,
}: AdminOverrideModalProps) {
  const { title, confirm, desc, tone } = OVERHEAD_LABEL[kind];
  const milestoneNumber = milestoneIndex + 1;
  const busy = state?.phase !== "idle";

  const handleConfirm = useCallback(() => {
    // The parent fires the tx via executeTx using buildAdminOverrideRelease /
    // buildAdminOverrideRefund; this modal confirms dismissal.
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="admin-override-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6"
    >
      <div
        data-testid="admin-override-modal-panel"
        className="w-full sm:max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 sm:p-8 shadow-lg"
      >
        <h2 data-testid="admin-override-modal-title" className="text-lg font-semibold text-white mb-1">
          {title} — Milestone {milestoneNumber}
        </h2>

        <p data-testid="admin-override-modal-desc" className="mb-4 text-sm text-gray-400">
          {desc}
        </p>

        <div
          data-testid="admin-override-modal-kind"
          className="mb-4 rounded-lg border px-3 py-2 text-xs"
          className={kind === "release" ? "border-green-500/30 bg-green-950/20 text-green-200" : "border-red-500/30 bg-red-950/20 text-red-200"}
        >

        {state?.error && (
          <div
            data-testid="admin-override-modal-error"
            role="alert"
            aria-live="assertive"
            className="mb-3 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-xs text-red-200"
          >
            {state.error}
          </div>
        )}
        <div
          data-testid="admin-override-modal-kind"
          className={`mb-4 rounded-lg border px-3 py-2 text-xs ${
            kind === "release"
              ? "border-green-500/30 bg-green-950/20 text-green-200"
              : "border-red-500/30 bg-red-950/20 text-red-200"
          }`}
        >
          Admin override: <span className="font-mono">{kind}</span>
        </div>

        <div
          data-testid="admin-override-modal-actions"
          className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            data-testid="admin-override-modal-cancel"
            className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            aria-disabled={busy}
            data-testid="admin-override-modal-confirm"
            className={`min-h-[44px] px-4 py-2 rounded-lg ${tone} text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {busy && <ButtonSpinner className="h-4 w-4" />}
            {busy ? "Submitting…" : confirm}
          </button>
        </div>

        {state?.phase !== "idle" && state.txHash && (
          <div
            data-testid="admin-override-modal-status-banner"
            className="mt-4 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-300"
          >
            Submitted: {state.txHash.slice(0, 12)}…
          </div>
        )}
      </div>
    </div>
  );
}
