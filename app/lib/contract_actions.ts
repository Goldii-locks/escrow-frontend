/**
 * contract_actions — Typed contract-action builders (#596).
 *
 * Keeps the method name and argument construction for each contract entrypoint
 * in one place, so the UI layer never assembles XDR args inline and generated
 * bindings can replace these helpers later without touching components.
 *
 * Every builder returns `{ method, args }` where `args` are the typed
 * `ContractArg[]` accepted by `submitContractTransaction` (see
 * `app/lib/transactions.ts`). Role/status gating is the caller's
 * responsibility; these helpers only describe *what* to call and *with what
 * arguments*.
 */

import { type ContractArg } from "@/app/lib/transactions";

export type CancelEscrowArgs = { caller: string };
export type RevokeCancelApprovalArgs = { caller: string };
export type ExtendMilestoneDeadlineArgs = {
  caller: string;
  index: number;
  extensionSeconds: number;
};
export type ApplyDisputeArbitrationSplitArgs = {
  caller: string;
  index: number;
  clientBps: number;
  freelancerBps: number;
};
export type AdminOverrideReleaseArgs = { caller: string; index: number };
export type AdminOverrideRefundArgs = { caller: string; index: number };
export type EmergencyUnpauseArgs = { caller: string };
export type AdminPauseEscrowArgs = { caller: string };
export type AdminResumeEscrowArgs = { caller: string };
export type WithdrawArgs = { caller: string };
export type EscalateDisputeArgs = { caller: string; index: number };
export type RequestRevisionArgs = { caller: string; index: number; noteHash: string };

/** cancel_escrow(caller) — client or freelancer cancels an open escrow. */
export function buildCancelEscrow({ caller }: CancelEscrowArgs) {
  return {
    method: "cancel_escrow",
    args: [{ type: "address", value: caller }] as ContractArg[],
  };
}

/** revoke_cancel_approval(caller) — withdraw a pending cancel approval. */
export function buildRevokeCancelApproval({ caller }: RevokeCancelApprovalArgs) {
  return {
    method: "revoke_cancel_approval",
    args: [{ type: "address", value: caller }] as ContractArg[],
  };
}

/**
 * extend_milestone_deadline(caller, index, extension_seconds) — client extends
 * the deadline on a milestone (typically Delivered, awaiting review).
 */
export function buildExtendMilestoneDeadline({
  caller,
  index,
  extensionSeconds,
}: ExtendMilestoneDeadlineArgs) {
  return {
    method: "extend_milestone_deadline",
    args: [
      { type: "address", value: caller },
      { type: "u32", value: index.toString() },
      { type: "i128", value: extensionSeconds.toString() },
    ] as ContractArg[],
  };
}

/**
 * apply_dispute_arbitration_split(caller, index, client_bps, freelancer_bps) —
 * arbiter applies a client/freelancer split to a disputed milestone.
 * `clientBps + freelancerBps` must equal 10_000 (see resolution_vote_form).
 */
export function buildApplyDisputeArbitrationSplit({
  caller,
  index,
  clientBps,
  freelancerBps,
}: ApplyDisputeArbitrationSplitArgs) {
  return {
    method: "apply_dispute_arbitration_split",
    args: [
      { type: "address", value: caller },
      { type: "u32", value: index.toString() },
      { type: "i128", value: clientBps.toString() },
      { type: "i128", value: freelancerBps.toString() },
    ] as ContractArg[],
  };
}

/** admin_override_release(caller, index) — admin releases funds to freelancer. */
export function buildAdminOverrideRelease({ caller, index }: AdminOverrideReleaseArgs) {
  return {
    method: "admin_override_release",
    args: [
      { type: "address", value: caller },
      { type: "u32", value: index.toString() },
    ] as ContractArg[],
  };
}

/** admin_override_refund(caller, index) — admin refunds funds to client. */
export function buildAdminOverrideRefund({ caller, index }: AdminOverrideRefundArgs) {
  return {
    method: "admin_override_refund",
    args: [
      { type: "address", value: caller },
      { type: "u32", value: index.toString() },
    ] as ContractArg[],
  };
}

/** emergency_unpause(caller) — admin lifts an emergency freeze. */
export function buildEmergencyUnpause({ caller }: EmergencyUnpauseArgs) {
  return {
    method: "emergency_unpause",
    args: [{ type: "address", value: caller }] as ContractArg[],
  };
}

/** admin_pause_escrow(caller) — admin freezes the escrow contract. */
export function buildAdminPauseEscrow({ caller }: AdminPauseEscrowArgs) {
  return {
    method: "admin_pause_escrow",
    args: [{ type: "address", value: caller }] as ContractArg[],
  };
}

/** admin_resume_escrow(caller) — admin resumes a paused escrow contract. */
export function buildAdminResumeEscrow({ caller }: AdminResumeEscrowArgs) {
  return {
    method: "admin_resume_escrow",
    args: [{ type: "address", value: caller }] as ContractArg[],
  };
}

/** withdraw(caller) — recipient collects an owed balance credited by the contract. */
export function buildWithdraw({ caller }: WithdrawArgs) {
  return {
    method: "withdraw",
    args: [{ type: "address", value: caller }] as ContractArg[],
  };
}

/** escalate_dispute(caller, index) — either party escalates an aged dispute. */
export function buildEscalateDispute({ caller, index }: EscalateDisputeArgs) {
  return {
    method: "escalate_dispute",
    args: [
      { type: "address", value: caller },
      { type: "u32", value: index.toString() },
    ] as ContractArg[],
  };
}

/**
 * request_revision(client, index, note_hash) — client sends a delivered
 * milestone back for rework. `note_hash` is the SHA-256 of the requested
 * changes, stored off-chain.
 */
export function buildRequestRevision({ caller, index, noteHash }: RequestRevisionArgs) {
  return {
    method: "request_revision",
    args: [
      { type: "address", value: caller },
      { type: "u32", value: index.toString() },
      { type: "bytes", value: noteHash },
    ] as ContractArg[],
  };
}
