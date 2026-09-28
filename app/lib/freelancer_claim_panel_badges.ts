/**
 * freelancer_claim_panel — state badges (#494).
 *
 * Distinct label, color and marker per claim state. Pure and React-free.
 */

export type ClaimBadgeState = "pending" | "claimable" | "claimed" | "failed";

export interface ClaimBadge {
  state: ClaimBadgeState;
  label: string;
  icon: string;
  className: string;
  ariaLabel: string;
}

const BADGES: Record<ClaimBadgeState, ClaimBadge> = {
  pending: { state: "pending", label: "Pending", icon: "clock", className: "bg-yellow-100 text-yellow-800", ariaLabel: "Claim status: pending" },
  claimable: { state: "claimable", label: "Ready to claim", icon: "unlock", className: "bg-blue-100 text-blue-800", ariaLabel: "Claim status: ready to claim" },
  claimed: { state: "claimed", label: "Claimed", icon: "check", className: "bg-green-100 text-green-800", ariaLabel: "Claim status: claimed" },
  failed: { state: "failed", label: "Failed", icon: "x", className: "bg-red-100 text-red-800", ariaLabel: "Claim status: failed" },
};

/** Badge for a claim state; unknown values fall back to the pending badge. */
export function getClaimBadge(state: string | null | undefined): ClaimBadge {
  const key = (state ?? "").toLowerCase() as ClaimBadgeState;
  return BADGES[key] ?? BADGES.pending;
}

/** Derive the badge state from claim conditions. */
export function deriveClaimBadgeState(opts: {
  claimed: boolean;
  failed?: boolean;
  releasable: boolean;
}): ClaimBadgeState {
  if (opts.failed) return "failed";
  if (opts.claimed) return "claimed";
  return opts.releasable ? "claimable" : "pending";
}
