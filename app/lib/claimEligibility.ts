/**
 * Client-side auto-release eligibility, derived from on-chain job data.
 *
 * The contract is the authority on `claim_auto_release`; this only decides
 * whether the UI should offer the button. The backend countdown, when it is
 * available, takes precedence ("use the backend only to refine it").
 */

export interface ClaimEligibilityInput {
  /** `delivered_at` from `get_job` (epoch seconds or milliseconds). */
  deliveredAt?: number | null;
  /** `auto_release_seconds` from `get_job`. */
  autoReleaseSeconds?: number | null;
  /** Total extension granted to the deadline, in seconds. */
  extensionSeconds?: number | null;
  /** Deadline reported by the backend (epoch ms), if that call succeeded. */
  backendDeadlineMs?: number | null;
  /** Current time in epoch ms. */
  now: number;
}

export interface ClaimEligibility {
  /** Whether the claim button should be shown. */
  show: boolean;
  /** Best-known deadline in epoch ms, or null when it can't be determined. */
  deadlineMs: number | null;
  /** True when the deadline is unknown and the contract decides on submit. */
  deadlineUnknown: boolean;
}

/** Shown beside the claim button when the deadline couldn't be determined. */
export const CLAIM_UNKNOWN_DEADLINE_NOTE =
  "The contract will reject this if the deadline hasn't passed.";

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Deadline in epoch ms from on-chain fields, or null if they are incomplete. */
export function computeAutoReleaseDeadlineMs(
  input: Pick<ClaimEligibilityInput, "deliveredAt" | "autoReleaseSeconds" | "extensionSeconds">
): number | null {
  const { deliveredAt, autoReleaseSeconds, extensionSeconds } = input;
  if (!isFiniteNumber(deliveredAt) || deliveredAt <= 0) return null;
  if (!isFiniteNumber(autoReleaseSeconds) || autoReleaseSeconds < 0) return null;
  // Same seconds-vs-milliseconds heuristic as autoRelease.ts.
  const deliveredMs = deliveredAt < 1e12 ? deliveredAt * 1000 : deliveredAt;
  const extra = isFiniteNumber(extensionSeconds) ? extensionSeconds : 0;
  return deliveredMs + (autoReleaseSeconds + extra) * 1000;
}

/**
 * Decide whether to show the claim button for a Delivered milestone. When no
 * deadline is known at all, the button is still shown (with a note) because
 * the contract rejects early claims.
 */
export function getClaimEligibility(input: ClaimEligibilityInput): ClaimEligibility {
  const deadlineMs = isFiniteNumber(input.backendDeadlineMs)
    ? input.backendDeadlineMs
    : computeAutoReleaseDeadlineMs(input);
  if (deadlineMs === null) {
    return { show: true, deadlineMs: null, deadlineUnknown: true };
  }
  return { show: deadlineMs <= input.now, deadlineMs, deadlineUnknown: false };
}
