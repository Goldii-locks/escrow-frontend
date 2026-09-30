/**
 * client_refund_panel — toast notifications (#506).
 *
 * Alert copy for every refund action the panel can take, so the wording lives
 * here rather than inline in JSX and stays assertable without mounting.
 *
 * Mirrors the conventions established by `freelancer_claim_panel_toasts.ts`
 * and `platform_metrics_charts_toasts.ts`.
 */

import type { ToastType } from "@/app/context/ToastContext";

export interface RefundToast {
  message: string;
  type: ToastType;
}

/**
 * Shortens an escrow id to `ABCD…MNOP` so it stays readable inside a toast.
 *
 * Ids at or under 12 characters are returned unchanged — there is nothing to
 * elide at that length, and truncating would make the id ambiguous.
 */
function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

/** Toast shown when a refund request is accepted by the backend. */
export function refundSuccessToast(escrowId: string): RefundToast {
  return {
    type: "success",
    message: `Refund requested for escrow ${shortId(escrowId)}.`,
  };
}

/** Toast shown when a refund request is rejected. */
export function refundErrorToast(escrowId: string, reason: string): RefundToast {
  return {
    type: "error",
    message: `Failed to request refund for escrow ${shortId(escrowId)}: ${reason}`,
  };
}

/** Warning shown when the panel has no refund records to act on. */
export function refundNothingToClaimToast(): RefundToast {
  return { type: "warning", message: "There are no refund requests for this escrow." };
}

/** Warning shown when the wallet is not connected. */
export function refundWalletWarningToast(): RefundToast {
  return { type: "warning", message: "Connect your wallet to request a refund." };
}

/** Warning shown when the entered amount fails validation. */
export function refundAmountInvalidToast(reason: string): RefundToast {
  return { type: "warning", message: `This refund amount cannot be submitted: ${reason}` };
}

/** Warning shown when the refund is not yet claimable. */
export function refundNotReadyToast(reason: string): RefundToast {
  return { type: "warning", message: `This refund cannot be requested yet: ${reason}` };
}

/**
 * Warning shown when the export button is pressed with nothing to export.
 *
 * Kept separate from the download helper's silent `false` return so the UI can
 * explain why no file appeared rather than leaving the click looking broken.
 */
export function refundExportEmptyToast(): RefundToast {
  return { type: "warning", message: "There is no refund data to export." };
}