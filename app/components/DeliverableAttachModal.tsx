"use client";

import { useCallback, useState } from "react";
import ButtonSpinner from "./ButtonSpinner";
import TxStatusBanner from "./TxStatusBanner";
import type { ActionState } from "@/app/hooks/useActionStates";
import {
  buildDeliverableContent,
  hashDeliverableContent,
  storeDeliverable,
  type DeliverablePayload,
} from "@/app/lib/deliverable_store";

export interface DeliverableAttachModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Called when the user dismisses the modal. */
  onClose: () => void;
  /**
   * Called with the SHA-256 hex digest and off-chain payload once the user
   * confirms. Return value is awaited so the dashboard can submit the tx.
   */
  onConfirm?: (
    hash: string,
    payload: DeliverablePayload
  ) => void | Promise<void>;
  /** The milestone being delivered (for display). */
  milestoneIndex: number;
  /** Whether the confirm action is in flight. */
  isConfirming?: boolean;
  /** Provider/contract error surfaced above the actions. */
  errorMessage?: string | null;
}

const LINK_FIELD_ID = "deliverable-link";
const NOTE_FIELD_ID = "deliverable-note";
const FILE_FIELD_ID = "deliverable-file";

export default function DeliverableAttachModal({
  isOpen,
  onClose,
  onConfirm,
  milestoneIndex,
  isConfirming = false,
  errorMessage = null,
}: DeliverableAttachModalProps) {
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<{ name: string; type: string; base64: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const busy = isConfirming;
  const milestoneNumber = milestoneIndex + 1;

  const handleLinkChange = useCallback((value: string) => {
    setLink(value);
    setSubmitError(null);
  }, []);

  const handleNoteChange = useCallback((value: string) => {
    setNote(value);
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
    const trimmedLink = link.trim();
    const trimmedNote = note.trim();

    if (trimmedLink === "" && trimmedNote === "" && file === null) {
      setSubmitError("Attach a link, note, or file before delivering.");
      return;
    }

    if (trimmedLink !== "") {
      try {
        new URL(trimmedLink);
      } catch {
        setSubmitError("Please enter a valid link.");
        return;
      }
    }

    setSubmitError(null);

    const content = buildDeliverableContent({ link: trimmedLink || undefined, note: trimmedNote || undefined, fileName: file?.name ?? undefined });
    const hash = await hashDeliverableContent(content);

    const payload: DeliverablePayload = {
      hash,
      link: trimmedLink || null,
      note: trimmedNote || null,
      ...(file != null ? { fileBase64: file.base64, fileType: file.type, fileName: file.name } : {}),
    };

    try {
      const pending = onConfirm?.(hash, payload);
      if (pending && typeof (pending as Promise<void>).catch === "function") {
        await (pending as Promise<void>);
      }
      onClose();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Failed to attach deliverable.");
    }
  }, [link, note, file, onConfirm, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="deliverable-attach-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`Attach deliverable for Milestone ${milestoneNumber}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6"
    >
      <div
        data-testid="deliverable-attach-modal-panel"
        className="w-full sm:max-w-lg rounded-xl border border-border-subtle bg-surface-card p-6 sm:p-8 shadow-lg"
      >
        <h2
          data-testid="deliverable-attach-modal-title"
          className="text-lg font-semibold text-text-primary mb-1"
        >
          Attach Deliverable — Milestone {milestoneNumber}
        </h2>

        <p data-testid="deliverable-attach-modal-hint" className="mb-4 text-sm text-text-secondary">
          Optionally attach a link, note, or file. A SHA-256 of the content is recorded on-chain as
          the deliverable proof; the content itself is stored off-chain.
        </p>

        <label htmlFor={LINK_FIELD_ID} className="mb-1 block text-xs text-text-muted">
          Link (optional)
        </label>
        <input
          id={LINK_FIELD_ID}
          data-testid="deliverable-attach-modal-link"
          type="url"
          placeholder="https://example.com/deliverable.pdf"
          value={link}
          disabled={busy}
          onChange={(e) => handleLinkChange(e.target.value)}
          className="w-full text-xs px-3 py-1.5 rounded-lg bg-surface-field border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft focus:ring-offset-1 focus:ring-offset-surface-page disabled:opacity-40"
        />

        <label htmlFor={NOTE_FIELD_ID} className="mt-3 block text-xs text-text-muted">
          Note (optional)
        </label>
        <textarea
          id={NOTE_FIELD_ID}
          data-testid="deliverable-attach-modal-note"
          placeholder="What was delivered…"
          value={note}
          disabled={busy}
          onChange={(e) => handleNoteChange(e.target.value)}
          className="w-full text-xs px-3 py-1.5 rounded-lg bg-surface-field border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-soft focus:ring-offset-1 focus:ring-offset-surface-page disabled:opacity-40"
        />

        <label htmlFor={FILE_FIELD_ID} className="mt-3 block text-xs text-text-muted">
          File (optional)
        </label>
        <input
          id={FILE_FIELD_ID}
          data-testid="deliverable-attach-modal-file"
          type="file"
          disabled={busy}
          onChange={handleFileChange}
          className="mt-1 w-full text-xs text-text-secondary disabled:opacity-40"
        />
        {file != null && (
          <p className="mt-1 text-xs text-text-muted truncate" data-testid="deliverable-attach-modal-file-name">
            {file.name} ({file.type})
          </p>
        )}

        {submitError && (
          <div
            data-testid="deliverable-attach-modal-error"
            role="alert"
            aria-live="assertive"
            className="mt-3 rounded-lg border border-danger bg-danger/20 px-4 py-3 text-sm text-danger-soft animate-shake"
          >
            {submitError}
          </div>
        )}

        <div
          data-testid="deliverable-attach-modal-actions"
          className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            data-testid="deliverable-attach-modal-cancel"
            className="min-h-[44px] px-4 py-2 rounded-lg border border-border-subtle bg-surface-field text-text-primary hover:bg-surface-card/50 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            data-testid="deliverable-attach-modal-confirm"
            className="min-h-[44px] px-4 py-2 rounded-lg bg-accent text-text-primary hover:bg-accent/90 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy && <ButtonSpinner className="h-4 w-4" />}
            {busy ? "Attaching…" : "Attach & Deliver"}
          </button>
        </div>

        {errorMessage && (
          <div
            data-testid="deliverable-attach-modal-submit-error"
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
