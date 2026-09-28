import type { ToastType } from "@/app/context/ToastContext";

export interface ClaimToast {
  message: string;
  type: ToastType;
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

/** Toast shown when a payout claim succeeds. */
export function claimSuccessToast(escrowId: string): ClaimToast {
  return { type: "success", message: `Payout for escrow ${shortId(escrowId)} claimed.` };
}

/** Toast shown when a payout claim fails. */
export function claimErrorToast(escrowId: string, reason: string): ClaimToast {
  return { type: "error", message: `Failed to claim escrow ${shortId(escrowId)}: ${reason}` };
}

/** Warning shown when there is nothing to claim. */
export function claimNothingToClaimToast(): ClaimToast {
  return { type: "warning", message: "There are no claimable payouts." };
}

/** Warning shown when the wallet is not connected. */
export function claimWalletWarningToast(): ClaimToast {
  return { type: "warning", message: "Connect your wallet to claim a payout." };
}

/** Warning shown when the claim is not yet available. */
export function claimNotReadyToast(reason: string): ClaimToast {
  return { type: "warning", message: `This payout cannot be claimed yet: ${reason}` };
}
