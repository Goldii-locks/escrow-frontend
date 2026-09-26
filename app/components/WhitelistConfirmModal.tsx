"use client";

import { useState } from "react";
import {
  getConfirmCopy,
  type WhitelistAction,
} from "@/app/lib/admin_whitelist_panel";

export interface WhitelistConfirmModalProps {
  /** Action awaiting confirmation; `null` keeps the modal closed. */
  action: WhitelistAction | null;
  onCancel: () => void;
  onConfirm: (action: WhitelistAction) => void;
}

/**
 * Double-confirm dialog shown before the admin signs a whitelist transaction.
 * The form submit only opens this dialog (first confirmation); the confirm
 * button stays disabled until the acknowledgement is ticked (second).
 */
export default function WhitelistConfirmModal({
  action,
  onCancel,
  onConfirm,
}: WhitelistConfirmModalProps) {
  if (!action) return null;
  // Keyed so the acknowledgement resets for every new action.
  return (
    <ConfirmBody
      key={`${action.kind}-${action.token}`}
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
}: Required<WhitelistConfirmModalProps> & { action: WhitelistAction }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const copy = getConfirmCopy(action);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="whitelist-confirm-title"
      data-testid="whitelist-confirm-modal"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full sm:max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 space-y-4">
        <h2 id="whitelist-confirm-title" className="text-lg font-semibold">
          {copy.title}
        </h2>
        <p className="text-sm text-gray-400">{copy.description}</p>
        <p
          data-testid="whitelist-confirm-token"
          className="font-mono text-sm break-all bg-gray-800 rounded-lg px-4 py-3"
        >
          {action.token}
        </p>
        <label className="flex items-start gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          <span>{copy.acknowledgement}</span>
        </label>
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(action)}
            disabled={!acknowledged}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium transition"
          >
            {copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
