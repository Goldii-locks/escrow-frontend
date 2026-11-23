"use client";

import { useCallback, useState } from "react";
import { buildExtendMilestoneDeadline } from "@/app/lib/contract_actions";
import { runContractAction, type ActionState } from "@/app/lib/transactions";
import ButtonSpinner from "./ButtonSpinner";
import TxStatusBanner from "./TxStatusBanner";

export interface ExtendDeadlineModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Called when the user dismisses the modal. */
  onClose: () => void;
  /** Milestone index being extended. */
  milestoneIndex: number;
  /** Current deadline extension in seconds (for the default input). */
  currentExtensionSeconds?: number | null;
  /** Optional transaction state. */
  state?: ActionState | null;
}

export default function ExtendDeadlineModal({
  isOpen,
  onClose,
  milestoneIndex,
  currentExtensionSeconds = null,
  state = null,
}: ExtendDeadlineModalProps) {
  const [extensionSeconds, setExtensionSeconds] = useState<string>("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const busy = state?.phase !== "idle";

  const milestoneNumber = milestoneIndex + 1;
  const defaultSeconds = currentExtensionSeconds ?? 7 * 24 * 60 * 60; // 7 days

  const handleExtensionChange = useCallback((value: string) => {
    setExtensionSeconds(value);
    setFieldError(null);
  }, []);

  const handleConfirm = useCallback(() => {
    const trimmed = extensionSeconds.trim();
    if (!/^\d+$/.test(trimmed)) {
      setFieldError("Enter a whole number of seconds.");
      return;
    }
    const seconds = Number(trimmed);
    if (seconds <= 0) {
      setFieldError("Extension must be greater than 0 seconds.");
      return;
    }
    if (seconds > 365 * 24 * 60 * 60) {
      setFieldError("Extension cannot exceed one year.");
      return;
    }

    setFieldError(null);
    setSubmitError(null);

    // The parent fires the tx via executeTx using buildExtendMilestoneDeadline
    // with these args; this modal confirms dismissal.
    onClose();
  }, [extensionSeconds, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="extend-deadline-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Extend deadline — Milestone ${milestoneNumber}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6"
    >
      <div
        data-testid="extend-deadline-modal-panel"
        className="w-full sm:max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 sm:p-8 shadow-lg"
      >
        <h2 data-testid="extend-deadline-modal-title" className="text-lg font-semibold text-white mb-1">
          Extend Deadline — Milestone {milestoneNumber}
        </h2>

        <p data-testid="extend-deadline-modal-hint" className="mb-4 text-sm text-gray-400">
          Extend the review deadline for this delivered milestone by the number
          of seconds below. The client pays the extension.
        </p>

        <label
          htmlFor="extend-deadline-seconds"
          className="mb-1 block text-sm text-gray-300"
        >
          Extension (seconds)
        </label>
        <input
          id="extend-deadline-seconds"
          data-testid="extend-deadline-modal-seconds"
          type="text"
          inputMode="numeric"
          value={extensionSeconds}
          placeholder={String(defaultSeconds)}
          disabled={busy}
          onChange={(e) => handleExtensionChange(e.target.value)}
          aria-invalid={fieldError ? "true" : "false"}
          className="w-full text-xs px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {fieldError && (
          <p
            data-testid="extend-deadline-modal-field-error"
            role="alert"
            aria-live="polite"
            className="mt-2 text-xs text-red-200"
          >
            {fieldError}
          </p>
        )}

        {submitError && (
          <div
            data-testid="extend-deadline-modal-error"
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
            successMessage="Deadline extended successfully."
          />
        )}

        <div
          data-testid="extend-deadline-modal-actions"
          className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            data-testid="extend-deadline-modal-cancel"
            className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !!fieldError}
            aria-disabled={busy || !!fieldError}
            data-testid="extend-deadline-modal-confirm"
            className="min-h-[44px] px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy && <ButtonSpinner className="h-4 w-4" />}
            {busy ? "Extending…" : "Extend Deadline"}
          </button>
        </div>

        {state?.phase !== "idle" && state.txHash && (
          <div
            data-testid="extend-deadline-modal-status-banner"
            className="mt-4 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-gray-300"
          >
            Submitted: {state.txHash.slice(0, 12)}…
          </div>
        )}
      </div>
    </div>
  );
}
