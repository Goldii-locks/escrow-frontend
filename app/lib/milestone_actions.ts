/**
 * Who can act on a job or milestone, and when.
 *
 * `MilestoneCard`, the dashboard's fund button and the "Needs your action"
 * panel (#888) all decide from these predicates, so the panel can't list an
 * action the card doesn't offer, or miss one it does.
 */
import { getClaimEligibility, type ClaimEligibility } from "@/app/lib/claimEligibility";

export interface MilestoneLike {
  index: number;
  status: string;
  /** On-chain `delivered_at` (epoch seconds or ms). */
  deliveredAt?: number | null;
  /** On-chain `auto_release_seconds`. */
  autoReleaseSeconds?: number | null;
  /** Total deadline extension in seconds. */
  extensionSeconds?: number | null;
  /** Whether this milestone is already funded (per-milestone funding only). */
  funded?: boolean | null;
  /** On-chain due timestamp (epoch seconds or ms) for reclaim-overdue. */
  dueAt?: number | null | string;
}

/** The client funds a job that isn't funded yet (upfront funding). */
export function canFund(job: { funded?: boolean }, isClient: boolean): boolean {
  return isClient && !job.funded;
}

/** The client can fund an individual unfunded milestone (per-milestone funding). */
export function canFundMilestone(
  milestone: MilestoneLike,
  isClient: boolean,
  fundingMode: string | null | undefined
): boolean {
  return (
    isClient &&
    fundingMode === "PerMilestone" &&
    milestone.status === "Pending" &&
    !milestone.funded
  );
}

/** The freelancer marks a Pending milestone delivered. */
export function canMarkDelivered(milestone: MilestoneLike, isFreelancer: boolean): boolean {
  return isFreelancer && milestone.status === "Pending";
}

/** The client reviews (approves or disputes) a Delivered milestone. */
export function canApprove(milestone: MilestoneLike, isClient: boolean): boolean {
  return isClient && milestone.status === "Delivered";
}

/** The arbiter rules on a Disputed milestone. */
export function canResolveDispute(milestone: MilestoneLike, isArbiter: boolean): boolean {
  return isArbiter && milestone.status === "Disputed";
}

/** Auto-release timing for a Delivered milestone (see `getClaimEligibility`). */
export function milestoneClaimEligibility(
  milestone: MilestoneLike,
  backendDeadlineMs: number | null | undefined,
  now: number
): ClaimEligibility {
  return getClaimEligibility({
    deliveredAt: milestone.deliveredAt,
    autoReleaseSeconds: milestone.autoReleaseSeconds,
    extensionSeconds: milestone.extensionSeconds,
    backendDeadlineMs,
    now,
  });
}

/** The freelancer claims a Delivered milestone whose review window has passed. */
export function canClaimAutoRelease(
  milestone: MilestoneLike,
  isFreelancer: boolean,
  backendDeadlineMs: number | null | undefined,
  now: number
): boolean {
  return (
    isFreelancer &&
    milestone.status === "Delivered" &&
    milestoneClaimEligibility(milestone, backendDeadlineMs, now).show
  );
}

// ---------------------------------------------------------------------------
// Issue #821 — Client refund eligibility
// ---------------------------------------------------------------------------

/** Grace period (ms) after a milestone's due date before it becomes reclaimable. */
export const RECLAIM_GRACE_MS = 24 * 60 * 60 * 1000;

/** Window (ms) after funding within which the freelancer/arbiter must accept. */
export const WITHDRAW_UNACCEPTED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function asMs(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

/**
 * `withdraw_unaccepted(client)` eligibility: the escrow is funded, not every
 * milestone has been accepted, and the accept window (7 days from funding) has
 * passed. Returns the elapsed ms since funding and whether it is open.
 */
export function getWithdrawUnacceptedEligibility({
  funded,
  acceptedCount,
  milestoneCount,
  fundedAt,
  now,
}: {
  funded?: boolean | null;
  acceptedCount?: number | null;
  milestoneCount?: number | null;
  /** Funding timestamp (epoch ms). */
  fundedAt?: number | null | string;
  now: number;
}): {
  eligible: boolean;
  funded: boolean;
  fullyAccepted: boolean;
  windowPassed: boolean;
  msRemaining: number | null;
} {
  const fundedBool = funded === true;
  const fullyAccepted =
    milestoneCount != null && acceptedCount != null && acceptedCount >= milestoneCount;
  const fundedMs = asMs(fundedAt);
  const windowPassed = fundedMs != null ? now - fundedMs >= WITHDRAW_UNACCEPTED_WINDOW_MS : false;
  const msRemaining =
    fundedMs != null ? Math.max(0, WITHDRAW_UNACCEPTED_WINDOW_MS - (now - fundedMs)) : null;

  return {
    eligible: fundedBool && !fullyAccepted && windowPassed,
    funded: fundedBool,
    fullyAccepted,
    windowPassed,
    msRemaining,
  };
}

/**
 * `reclaim_overdue(client, index)` eligibility for a single milestone:
 * Pending, funded, and now > due_at + grace (1 day). Returns ms until
 * reclaimable (null when already reclaimable or due unknown).
 */
export function getReclaimOverdueEligibility({
  status,
  funded,
  dueAt,
  now,
}: {
  status: string;
  funded?: boolean | null;
  dueAt?: number | null | string;
  now: number;
}): {
  eligible: boolean;
  msRemaining: number | null;
  dueMs: number | null;
} {
  const dueMs = asMs(dueAt);
  const reclaimAt = dueMs != null ? dueMs + RECLAIM_GRACE_MS : null;
  const msRemaining = reclaimAt != null ? Math.max(0, reclaimAt - now) : null;

  return {
    eligible: status === "Pending" && funded === true && reclaimAt != null && now > reclaimAt,
    msRemaining,
    dueMs,
  };
}
