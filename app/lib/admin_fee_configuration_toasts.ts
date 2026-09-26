import type { ToastType } from "@/app/context/ToastContext";

/**
 * admin_fee_configuration — action toast messages (#466).
 */

export type FeeToastEvent =
  | "update_success"
  | "update_failure"
  | "invalid_fee"
  | "high_fee_warning"
  | "unauthorized";

export interface FeeToast {
  message: string;
  type: ToastType;
}

/** Fees above this (bps) trigger a warning toast. */
export const HIGH_FEE_BPS = 1000;

export function getFeeToast(event: FeeToastEvent, detail?: string): FeeToast {
  switch (event) {
    case "update_success":
      return { message: "Platform fee updated successfully", type: "success" };
    case "update_failure":
      return { message: detail ? `Fee update failed: ${detail}` : "Fee update failed", type: "error" };
    case "invalid_fee":
      return { message: detail ?? "Invalid fee value", type: "warning" };
    case "high_fee_warning":
      return { message: "Warning: the configured fee is unusually high", type: "warning" };
    case "unauthorized":
      return { message: "Only the admin can change the platform fee", type: "error" };
  }
}

/** Pick the toast to show before submitting a fee value, or null when none applies. */
export function getPreSubmitFeeToast(feeBps: number): FeeToast | null {
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10000) {
    return getFeeToast("invalid_fee", "Fee must be a whole number between 0 and 10000 bps");
  }
  if (feeBps > HIGH_FEE_BPS) return getFeeToast("high_fee_warning");
  return null;
}
