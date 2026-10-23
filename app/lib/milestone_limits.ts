/**
 * Maximum number of milestones the create form allows per escrow. Keep in sync
 * with the contract's MAX_MILESTONES once it is finalised: several contract
 * functions loop over every milestone and can exceed Soroban resource limits.
 */
export const MAX_MILESTONES = 20;

export function milestoneLimitHint(max: number = MAX_MILESTONES): string {
  return `Up to ${max} milestones per escrow`;
}

export function isMilestoneCapReached(count: number, max: number = MAX_MILESTONES): boolean {
  return count >= max;
}
