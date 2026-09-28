/**
 * admin_fee_configuration — state badges for the fee configuration views (#464).
 */

export type FeeConfigState = "active" | "pending" | "updating" | "failed" | "disabled";

export interface FeeConfigBadge {
  state: FeeConfigState;
  label: string;
  /** Tailwind classes for the badge colours. */
  className: string;
}

const BADGES: Record<FeeConfigState, FeeConfigBadge> = {
  active: { state: "active", label: "Active", className: "bg-green-100 text-green-800" },
  pending: { state: "pending", label: "Pending", className: "bg-yellow-100 text-yellow-800" },
  updating: { state: "updating", label: "Updating", className: "bg-blue-100 text-blue-800" },
  failed: { state: "failed", label: "Failed", className: "bg-red-100 text-red-800" },
  disabled: { state: "disabled", label: "Disabled", className: "bg-gray-100 text-gray-600" },
};

/** Resolve the badge for a fee configuration state; unknown values map to disabled. */
export function getFeeConfigBadge(state: string | null | undefined): FeeConfigBadge {
  const key = (state ?? "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(BADGES, key)
    ? BADGES[key as FeeConfigState]
    : BADGES.disabled;
}
