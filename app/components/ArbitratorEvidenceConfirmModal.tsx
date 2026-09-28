"use client";

import { useState } from "react";
import {
  getEvidenceConfirmCopy,
  type EvidenceAction,
} from "@/app/lib/arbitrator_evidence_list";

export interface ArbitratorEvidenceConfirmModalProps {
  /** Action awaiting confirmation; `null` keeps the modal closed. */
  action: EvidenceAction | null;
  onCancel: () => void;
  onConfirm: (action: EvidenceAction) => void;
}

/**
 * Double-confirm dialog shown before an arbiter signs an evidence decision
 * (Issue #425). Pressing the row action only opens this dialog (first
 * confirmation); the confirm button stays disabled until the
 * acknowledgement is ticked (second), so a submit can never reach the
 * signing path on a single click.
 */
export default function ArbitratorEvidenceConfirmModal({
  action,
  onCancel,
  onConfirm,
}: ArbitratorEvidenceConfirmModalProps) {
  if (!action) return null;
  // Keyed so the acknowledgement resets for every new action.
  return (
    <ConfirmBody
      key={`${action.kind}-${action.evidenceId}`}
      action={action}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function ConfirmBody({
  action,
  onCancel,
  onConfirm,
}: Required<ArbitratorEvidenceConfirmModalProps> & { action: EvidenceAction }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const copy = getEvidenceConfirmCopy(action);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-confirm-title"
      data-testid="evidence-confirm-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full sm:max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 space-y-4 text-gray-200">
        <h2 id="evidence-confirm-title" className="text-lg font-semibold text-white">
          {copy.title}
        </h2>
        <p className="text-sm text-gray-400">{copy.description}</p>
        <p
          data-testid="evidence-confirm-target"
          className="font-mono text-sm break-all bg-gray-800 rounded-lg px-4 py-3"
        >
          {action.evidenceId}
        </p>
        <label className="flex items-start gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            data-testid="evidence-confirm-acknowledge"
          />
          <span>{copy.acknowledgement}</span>
        </label>
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            data-testid="evidence-confirm-cancel"
            className="min-h-[44px] px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(action)}
            disabled={!acknowledged}
            data-testid="evidence-confirm-submit"
            className="min-h-[44px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium transition"
          >
            {copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
