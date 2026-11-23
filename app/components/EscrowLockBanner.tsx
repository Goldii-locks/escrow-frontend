"use client";

import type { EscrowLockKind } from "@/app/lib/escrow_lock_state";

interface Props {
  kind: EscrowLockKind;
  message: string;
}

/**
 * Banner shown above the milestone list when the escrow is paused or
 * cancel-locked (#896). Hidden when `kind === "none"`.
 */
export default function EscrowLockBanner({ kind, message }: Props) {
  if (kind === "none" || !message) return null;

  const isCancelLocked = kind === "cancel_locked";

  return (
    <div
      data-testid="escrow-lock-banner"
      role="status"
      aria-live="polite"
      className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
        isCancelLocked
          ? "border-orange-700/50 bg-orange-950/30 text-orange-300"
          : "border-red-700/50 bg-red-950/30 text-red-300"
      }`}
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-base leading-none">
        {isCancelLocked ? "🔒" : "⏸"}
      </span>
      <p data-testid="escrow-lock-banner-message">{message}</p>
    </div>
  );
}
