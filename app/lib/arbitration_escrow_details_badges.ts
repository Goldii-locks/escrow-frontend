/**
 * arbitration_escrow_details — state badges for arbitration views (#484).
 *
 * Distinct label, color and marker per dispute/arbitration state. Pure and React-free.
 */

export type ArbitrationBadgeState =
  | "locked"
  | "under_review"
  | "resolved"
  | "pending"
  | "appealed";

export interface ArbitrationBadge {
  state: ArbitrationBadgeState;
  label: string;
  icon: string;
  className: string;
  ariaLabel: string;
}

const BADGES: Record<ArbitrationBadgeState, ArbitrationBadge> = {
  locked: {
    state: "locked",
    label: "Locked in Escrow",
    icon: "lock",
    className: "bg-red-100 text-red-800 border-red-200",
    ariaLabel: "Arbitration status: locked",
  },
  under_review: {
    state: "under_review",
    label: "Under Review",
    icon: "search",
    className: "bg-blue-100 text-blue-800 border-blue-200",
    ariaLabel: "Arbitration status: under review",
  },
  resolved: {
    state: "resolved",
    label: "Resolved",
    icon: "check-circle",
    className: "bg-green-100 text-green-800 border-green-200",
    ariaLabel: "Arbitration status: resolved",
  },
  pending: {
    state: "pending",
    label: "Pending",
    icon: "clock",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
    ariaLabel: "Arbitration status: pending",
  },
  appealed: {
    state: "appealed",
    label: "Appealed",
    icon: "alert-triangle",
    className: "bg-purple-100 text-purple-800 border-purple-200",
    ariaLabel: "Arbitration status: appealed",
  },
};

/** Badge for an arbitration state; unknown or missing values fall back to pending badge. */
export function getArbitrationBadge(
  state: string | null | undefined,
): ArbitrationBadge {
  const normalized = (state ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]/g, "_") as ArbitrationBadgeState;
  return Object.prototype.hasOwnProperty.call(BADGES, normalized)
    ? BADGES[normalized]
    : BADGES.pending;
}

/** Derive badge state from dispute condition flags. */
export function deriveArbitrationBadgeState(opts: {
  isLocked?: boolean;
  isUnderReview?: boolean;
  isResolved?: boolean;
  isAppealed?: boolean;
}): ArbitrationBadgeState {
  if (opts.isResolved) return "resolved";
  if (opts.isAppealed) return "appealed";
  if (opts.isUnderReview) return "under_review";
  if (opts.isLocked) return "locked";
  return "pending";
}
