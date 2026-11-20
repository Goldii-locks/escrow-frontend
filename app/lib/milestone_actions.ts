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
}

/** The client funds a job that isn't funded yet. */
export function canFund(job: { funded?: boolean }, isClient: boolean): boolean {
  return isClient && !job.funded;
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
