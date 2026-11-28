"use client";

import { useToast } from "@/app/context/ToastContext";
import {
  buildDisputeReasonBackupText,
  disputeReasonBackupFilename,
} from "@/app/lib/dispute_reason";

export interface DisputeReasonBackupPanelProps {
  /** The dispute reason text as submitted (pre-hash, pre-trim). */
  reason: string;
  /** Hex-encoded SHA-256 hash sent on-chain as `reason_hash`. */
  hash: string;
  onDismiss: () => void;
}

/**
 * #804: shown once, right after a dispute is successfully raised. The
 * contract only stores the hash, so this is the only place the user will
 * ever see their own reason text paired with the hash that was committed
 * on-chain — closing this panel without saving it loses the text for good.
 */
export default function DisputeReasonBackupPanel({
  reason,
  hash,
  onDismiss,
}: DisputeReasonBackupPanelProps) {
  const { showToast } = useToast();
  const text = buildDisputeReasonBackupText(reason, hash);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Dispute reason and hash copied to clipboard", "success");
    } catch {
      showToast("Could not copy the dispute reason", "error");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = disputeReasonBackupFilename(hash);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      data-testid="dispute-reason-backup-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Save your dispute reason"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-lg rounded-lg border border-white/10 bg-surface p-6">
        <h2 className="mb-2 text-lg font-semibold text-primary">Save your dispute reason</h2>
        <p className="mb-4 text-sm text-secondary">
          The contract only stores a hash of your reason, not the text. Nobody — including you after
          a reload — will be able to see the original text unless you save it now.
        </p>

        <pre
          data-testid="dispute-reason-backup-text"
          className="mb-4 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-white/10 bg-black/20 p-3 text-xs text-secondary"
        >
          {text}
        </pre>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={handleDownload}
            data-testid="dispute-reason-backup-download"
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-primary hover:bg-white/5"
          >
            Download .txt
          </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            data-testid="dispute-reason-backup-copy"
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-primary hover:bg-white/5"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={onDismiss}
            data-testid="dispute-reason-backup-dismiss"
            className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
