/**
 * batch_approval — pure helpers for approving several delivered milestones in
 * one `approve_milestones(client, indices)` transaction (#899, contract #741).
 */

import type { ContractArg } from "@/app/lib/transactions";

/** Most milestones the contract approves in one call (`MAX_BATCH_APPROVALS`). */
export const MAX_BATCH_APPROVALS = 10;

/** Fewest delivered milestones before "Approve selected" is offered. */
export const MIN_BATCH_APPROVAL_CANDIDATES = 2;

export interface BatchMilestone {
  index: number;
  amount: string;
  status: string;
  releasedAmount?: string;
}

/** Delivered milestones, the ones the batch UI lets the client select. */
export function getBatchApprovalCandidates<T extends BatchMilestone>(
  milestones: readonly T[] | null | undefined
): T[] {
  if (!Array.isArray(milestones)) return [];
  return milestones.filter((m) => m?.status === "Delivered");
}

/** Whether to show batch approval: two or more delivered milestones. */
export function shouldOfferBatchApproval(
  milestones: readonly BatchMilestone[] | null | undefined
): boolean {
  return getBatchApprovalCandidates(milestones).length >= MIN_BATCH_APPROVAL_CANDIDATES;
}

/**
 * Adds or removes `index` from the selection. Selecting more than
 * `MAX_BATCH_APPROVALS` is refused (the selection is returned unchanged).
 */
export function toggleBatchSelection(
  selection: readonly number[],
  index: number,
  selected: boolean
): number[] {
  const without = selection.filter((i) => i !== index);
  if (!selected) return without;
  if (without.length >= MAX_BATCH_APPROVALS) return [...selection];
  return [...without, index].sort((a, b) => a - b);
}

/**
 * Drops selected indices that are no longer delivered (e.g. after a refresh),
 * keeping the result sorted.
 */
export function pruneBatchSelection(
  selection: readonly number[],
  milestones: readonly BatchMilestone[] | null | undefined
): number[] {
  const delivered = new Set(getBatchApprovalCandidates(milestones).map((m) => m.index));
  return selection.filter((i) => delivered.has(i)).sort((a, b) => a - b);
}

/** What the contract releases for a milestone: `amount - releasedAmount`. */
export function remainingAmount(milestone: BatchMilestone): bigint | null {
  try {
    return BigInt(milestone.amount) - BigInt(milestone.releasedAmount ?? "0");
  } catch {
    return null;
  }
}

/**
 * Total released by approving `selection`, in base units. Returns null when
 * any selected milestone is missing or has an unparseable amount.
 */
export function getBatchApprovalTotal(
  selection: readonly number[],
  milestones: readonly BatchMilestone[] | null | undefined
): bigint | null {
  if (!Array.isArray(milestones)) return null;
  let total = BigInt(0);
  for (const index of selection) {
    const milestone = milestones.find((m) => m.index === index);
    if (!milestone) return null;
    const remaining = remainingAmount(milestone);
    if (remaining === null) return null;
    total += remaining;
  }
  return total;
}

/** Why a selection can't be submitted, or null when it can. */
export function validateBatchSelection(selection: readonly number[]): string | null {
  if (selection.length === 0) return "Select at least one delivered milestone.";
  if (selection.length > MAX_BATCH_APPROVALS) {
    return `You can approve at most ${MAX_BATCH_APPROVALS} milestones at once.`;
  }
  if (new Set(selection).size !== selection.length) return "A milestone is selected twice.";
  return null;
}

/** `approve_milestones(client, indices)` arguments for the build-tx call. */
export function buildApproveMilestonesArgs(
  client: string,
  selection: readonly number[]
): ContractArg[] {
  return [
    { type: "address", value: client },
    {
      type: "vec",
      value: [...selection]
        .sort((a, b) => a - b)
        .map((index) => ({ type: "u32", value: index.toString() })),
    },
  ];
}
