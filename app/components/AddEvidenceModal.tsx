"use client";

import { useCallback, useState } from "react";
import ButtonSpinner from "./ButtonSpinner";
import TxStatusBanner from "./TxStatusBanner";
import type { ActionState } from "@/app/hooks/useActionStates";
import { hashDeliverableContent } from "@/app/lib/deliverable_store";

export interface AddEvidenceModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Called when the user dismisses the modal. */
  onClose: () => void;
  /**
   * Called with the SHA-256 hex digest and off-chain payload once the user
   * confirms. Return value is awaited so the dashboard can submit `submit_evidence`.
   */
  onConfirm?: (
    hash: string,
    payload: { title: string; description?: string | null; fileBase64?: string | null; fileType?: string | null; fileName?: string | null }
  ) => void | Promise<void>;
  /** The disputed milestone being evidenced (for display). */
  milestoneIndex: number;
  /** Whether the confirm action is in flight. */
  isConfirming?: boolean;
  /** Provider/contract error surfaced above the actions. */
  errorMessage?: string | null;
}

const TITLE_FIELD_ID = "evidence-title";
const DESCRIPTION_FIELD_ID = "evidence-description";
const FILE_FIELD_ID = "evidence-file";

export default function AddEvidenceModal({
  isOpen,
  onClose,
  onConfirm,
  milestoneIndex,
  isConfirming = false,
  errorMessage = null,
}: AddEvidenceModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<{ name: string; type: string; base64: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const busy = isConfirming;
  const milestoneNumber = milestoneIndex + 1;

  const handleTitleChange = useCallback((value: string) => {
    setTitle(value);
    setSubmitError(null);
  }, []);

  const handleDescriptionChange = useCallback((value: string) => {
    setDescription(value);
    setSubmitError(null);
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selected = event.target.files?.[0];
      if (!selected) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        setFile({
          name: selected.name,
          type: selected.type ?? "",
          base64: (reader.result as string).split(",")[1] ?? "",
        });
      };
      reader.readAsDataURL(selected);
    },
    []
  );

  const handleConfirm = useCallback(async () => {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (trimmedTitle === "") {
      setSubmitError("Please give the evidence a title.");
      return;
    }

    setSubmitError(null);

    const content = `title:${trimmedTitle}\n${trimmedDescription ? `note:${trimmedDescription}\n` : ""}${
      file != null ? `file:${file.name}` : ""
    }`;
    const hash = await hashDeliverableContent(content);

    const payload = {
      title: trimmedTitle,
      description: trimmedDescription || null,
      ...(file != null ? { fileBase64: file.base64, fileType: file.type, fileName: file.name } : {}),
    };

    try {
      const pending = onConfirm?.(hash, payload);
      if (pending && typeof (pending as Promise<void>).catch === "function") {
        await (pending as Promise<void>);
      }
      onClose();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to attach evidence.");
    }
  }, [title, description, file, onConfirm, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="add-evidence-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Add evidence to Milestone ${milestoneNumber} dispute`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6"
    >
      <div
        data-testid="add-evidence-modal-panel"
        className="w-full sm:max-w-lg rounded-xl border border-border-subtle bg-surface-card p-6 sm:p-8 shadow-lg"
      >
        <h2 data-testid="add-evidence-modal-title" className="text-lg font-semibold text-text-primary mb-1">
          Add Evidence — Milestone {milestoneNumber}
        </h2>

        <p data-testid="add-evidence-modal-hint" className="mb-4 text-sm text-text-secondary">
          Attach text and/or a file. The content is hashed (SHA-256) and recorded on-chain via
          `submit_evidence`; the content itself is stored off-chain.
        </p>

        <label htmlFor={TITLE_FIELD_ID} className="mb-1 block text-xs text-text-muted">
          Evidence title
        </label>
        <input
          id={TITLE_FIELD_ID}
          data-testid="add-evidence-modal-title"
          placeholder="e.g. Deployment logs and commit proof"
          value={title}
          disabled={busy}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="w-full text-xs px-3 py-1.5 rounded-lg bg-surface-field border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft focus:ring-offset-1 focus:ring-offset-surface-page disabled:opacity-40"
        />

        <label htmlFor={DESCRIPTION_FIELD_ID} className="mt-3 block text-xs text-text-muted">
          Description (optional)
        </label>
        <textarea
          id={DESCRIPTION_FIELD_ID}
          data-testid="add-evidence-modal-description"
          placeholder="What does this evidence show…"
          value={description}
          disabled={busy}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          className="w-full text-xs px-3 py-1.5 rounded-lg bg-surface-field border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft focus:ring-offset-1 focus:ring-offset-surface-page disabled:opacity-40"
        />

        <label htmlFor={FILE_FIELD_ID} className="mt-3 block text-xs text-text-muted">
          File (optional)
        </label>
        <input
          id={FILE_FIELD_ID}
          data-testid="add-evidence-modal-file"
          type="file"
          disabled={busy}
          onChange={handleFileChange}
          className="mt-1 w-full text-xs text-text-secondary disabled:opacity-40"
        />
        {file != null && (
          <p className="mt-1 text-xs text-text-muted truncate" data-testid="add-evidence-modal-file-name">
            {file.name} ({file.type})
          </p>
        )}

        {submitError && (
          <div
            data-testid="add-evidence-modal-error"
            role="alert"
            aria-live="assertive"
            className="mt-3 rounded-lg border border-danger bg-danger/20 px-4 py-3 text-sm text-danger-soft animate-shake"
          >
            {submitError}
          </div>
        )}

        <div
          data-testid="add-evidence-modal-actions"
          className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            data-testid="add-evidence-modal-cancel"
            className="min-h-[44px] px-4 py-2 rounded-lg border border-border-subtle bg-surface-field text-text-primary hover:bg-surface-card/50 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            data-testid="add-evidence-modal-confirm"
            className="min-h-[44px] px-4 py-2 rounded-lg bg-accent text-text-primary hover:bg-accent/90 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy && <ButtonSpinner className="h-4 w-4" />}
            {busy ? "Submitting…" : "Submit Evidence"}
          </button>
        </div>

        {errorMessage && (
          <div
            data-testid="add-evidence-modal-submit-error"
            role="alert"
            aria-live="assertive"
            className="mt-4 rounded-lg border border-danger bg-danger/20 px-4 py-3 text-sm text-danger-soft"
          >
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}
