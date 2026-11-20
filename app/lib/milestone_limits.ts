/**
 * Maximum number of milestones per escrow. Mirrors `MAX_MILESTONES` in the
 * escrow contract (escrow-contract `contracts/milestone-escrow/src/lib.rs`),
 * which rejects more with `TooManyMilestones`. There are no generated contract
 * bindings to import it from, so update both together.
 */
export const MAX_MILESTONES = 50;

export function milestoneLimitHint(max: number = MAX_MILESTONES): string {
  return `Up to ${max} milestones per escrow`;
}

export function isMilestoneCapReached(count: number, max: number = MAX_MILESTONES): boolean {
  return count >= max;
}
