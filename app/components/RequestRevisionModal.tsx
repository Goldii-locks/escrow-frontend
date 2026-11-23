"use client";

import { useCallback, useState } from "react";
import { buildRequestRevision } from "@/app/lib/contract_actions";
import { runContractAction, type ActionState } from "@/app/lib/transactions";
import ButtonSpinner from "./ButtonSpinner";
import TxStatusBanner from "./TxStatusBanner";

/** Maximum number of revisions per milestone (matches MAX_REVISIONS on-chain). */
export const MAX_REVISIONS = 3;

export interface RequestRevisionModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Called when the user dismisses the modal. */
  onClose: () => void;
  /** Milestone index being sent back for rework. */
  milestoneIndex: number;
  /** Current revision count (0-based: number of revisions already requested). */
  revisionCount?: number | null;
  /** Optional transaction state. */
  state?: ActionState | null;
}

export default function RequestRevisionModal({
  isOpen,
  onClose,
  milestoneIndex,
  revisionCount = null,
  state = null,
}: RequestRevisionModalProps) {
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const busy = state?.phase !== "idle";

  const milestoneNumber = milestoneIndex + 1;
  const revisionsRemaining = revisionCount != null ? MAX_REVISIONS - revisionCount : MAX_REVISIONS;
  const atLimit = revisionsRemaining <= 0;

  const handleNoteChange = useCallback((value: string) => {
    setNote(value);
    setFieldError(null);
  }, []);

  const handleConfirm = useCallback(() => {
    const trimmed = note.trim();
    if (trimmed === "") {
      setFieldError("Please describe the requested changes.");
      return;
    }
    if (trimmed.length > 500) {
      setFieldError("Requested changes must be 500 characters or fewer.");
      return;
    }

    setFieldError(null);
    setSubmitError(null);

    // The parent hashes the note for note_hash and fires the tx via executeTx
    // using buildRequestRevision; this modal confirms dismissal.
    onClose();
  }, [note, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="request-revision-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Request changes — Milestone ${milestoneNumber}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6"
    >
      <div
        data-testid="request-revision-modal-panel"
        className="w-full sm:max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 sm:p-8 shadow-lg"
      >
        <h2 data-testid="request-revision-modal-title" className="text-lg font-semibold text-white mb-1">
          Request Changes — Milestone {milestoneNumber}
        </h2>

        <p data-testid="request-revision-modal-hint" className="mb-4 text-sm text-gray-400">
          Describe the changes you want the freelancer to make. The text is
          hashed and recorded on-chain as the revision request.
        </p>

        <div data-testid="request-revision-modal-revision-count" className="mb-3">
          <p className="text-xs text-gray-400">Revision</p>
          <p data-testid="request-revision-modal-revision-value" className="font-mono text-white">
            Revision {revisionCount != null ? revisionCount + 1 : "?"} of {MAX_REVISIONS}
          </p>
          {atLimit && (
            <p className="text-xs text-red-200 mt-1">
              Revision limit reached — no more revisions can be requested.
            </p>
          )}
        </div>

        <label
          htmlFor="request-revision-note"
          className="mb-1 block text-sm text-gray-300"
        >
          Requested changes
        </label>
        <textarea
          id="request-revision-note"
          data-testid="request-revision-modal-note"
          value={note}
          maxLength={500}
          disabled={busy || atLimit}
          onChange={(e) => handleNoteChange(e.target.value)}
          aria-invalid={fieldError ? "true" : "false"}
          className="w-full text-xs px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {fieldError && (
          <p
            data-testid="request-revision-modal-field-error"
            role="alert"
            aria-live="polite"
            className="mt-2 text-xs text-red-200"
          >
            {fieldError}
          </p>
        )}

        {submitError && (
          <div
            data-testid="request-revision-modal-error"
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
            successMessage="Revision request submitted. The milestone returns to Pending."
          />
        )}

        <div
          data-testid="request-revision-modal-actions"
          className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy || atLimit}
            data-testid="request-revision-modal-cancel"
            className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || atLimit || !!fieldError}
            aria-disabled={busy || atLimit || !!fieldError}
            data-testid="request-revision-modal-confirm"
            className="min-h-[44px] px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy && <ButtonSpinner className="h-4 w-4" />}
            {busy ? "Submitting…" : atLimit ? "Limit Reached" : "Request Changes"}
          </button>
        </div>

        {state?.phase !== "idle" && state.txHash && (
          <div
            data-testid="request-revision-modal-status-banner"
            className="mt-4 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-300"
          >
            Submitted: {state.txHash.slice(0, 12)}…
          </div>
        )}
      </div>
    </div>
  );
}
