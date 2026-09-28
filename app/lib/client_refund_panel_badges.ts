/**
 * client_refund_panel — state badges (#504).
 *
 * Distinct label, color and marker per refund state. Pure and React-free.
 * Uses design token color classes consistent with MilestoneCard.tsx statusColor map.
 */

export type RefundBadgeState =
  | "pending_refund"
  | "refund_approved"
  | "refund_rejected"
  | "refund_processing";

export interface RefundBadge {
  state: RefundBadgeState;
  label: string;
  icon: string;
  className: string;
  ariaLabel: string;
}

const REFUND_BADGES: Record<RefundBadgeState, RefundBadge> = {
  pending_refund: {
    state: "pending_refund",
    label: "Pending Refund",
    icon: "clock",
    className: "bg-warning-soft/10 text-warning-soft border border-warning-soft/20",
    ariaLabel: "Refund status: pending refund",
  },
  refund_approved: {
    state: "refund_approved",
    label: "Refund Approved",
    icon: "check",
    className: "bg-success-soft/10 text-success-soft border border-success-soft/20",
    ariaLabel: "Refund status: refund approved",
  },
  refund_rejected: {
    state: "refund_rejected",
    label: "Refund Rejected",
    icon: "x",
    className: "bg-danger-soft/10 text-danger-soft border border-danger-soft/20",
    ariaLabel: "Refund status: refund rejected",
  },
  refund_processing: {
    state: "refund_processing",
    label: "Processing",
    icon: "spinner",
    className: "bg-info-soft/10 text-info-soft border border-info-soft/20",
    ariaLabel: "Refund status: processing",
  },
};

/** Badge for a refund state; unknown values fall back to the pending_refund badge. */
export function getRefundBadge(state: string | null | undefined): RefundBadge {
  const key = (state ?? "").toLowerCase() as RefundBadgeState;
  return REFUND_BADGES[key] ?? REFUND_BADGES.pending_refund;
}

/** Derive the badge state from refund conditions. */
export function deriveRefundBadgeState(opts: {
  approved: boolean;
  rejected: boolean;
  processing?: boolean;
}): RefundBadgeState {
  if (opts.rejected) return "refund_rejected";
  if (opts.approved && opts.processing) return "refund_processing";
  if (opts.approved) return "refund_approved";
  return "pending_refund";
}

/** All valid refund badge state keys. */
export const REFUND_BADGE_STATES: readonly RefundBadgeState[] = [
  "pending_refund",
  "refund_approved",
  "refund_rejected",
  "refund_processing",
] as const;
