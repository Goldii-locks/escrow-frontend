"use client";

import { useCallback, useRef, useState } from "react";

import { useActionStates } from "@/app/hooks/useActionStates";
import { fetchJobStateFromContract } from "@/app/lib/contract_job_state";
import { runContractAction, submitContractTransaction } from "@/app/lib/transactions";
import { buildApproveMilestonesArgs, validateBatchSelection } from "@/app/lib/batch_approval";
import { buildSweepExcessArgs } from "@/app/lib/sweep_excess";
import { hashDisputeReason } from "@/app/lib/dispute_reason";
import type { Job } from "@/app/lib/api_schemas";

/** Action key for the batch `approve_milestones` transaction (#899). */
export const BATCH_APPROVE_KEY = "approve-batch";

/**
 * Builds a per-job action key so state is never shared across contracts.
 *
 * Without the jobId prefix, `approve-0` on job A and `approve-0` on job B
 * resolve to the same key: job B shows "Submitting…" and its button is
 * disabled while job A's transaction is in flight (#891).
 */
export function actionKey(jobId: string, kind: string, index?: number): string {
  return index === undefined ? `${jobId}:${kind}` : `${jobId}:${kind}:${index}`;
}

export interface UseJobActionsContext {
  address: string | null;
  signTransaction: (xdr: string) => Promise<string>;
  registerPendingAction: (action: { contractId: string; method: string; args: { type: string; value: unknown }[]; sourceAddress: string }) => void;
  isPending: (key: string) => boolean;
  setPhase: (key: string, phase: "idle" | "building" | "signing" | "submitting" | "success" | "error") => void;
  setError: (key: string, error: string | null) => void;
  setTxHash: (key: string, txHash: string | null) => void;
  /** Re-fetch the job list. */
  refetchJobs: () => Promise<void>;
  /** Force-refresh the expanded job's detail. */
  refetchDetails: (force?: boolean) => void;
  /** Store a freshly fetched job detail (e.g. from the contract after an action). */
  onJobDetailUpdated: (job: Job) => void;
  /** Mark/un-mark a job as a contract fallback. */
  onContractFallback: (jobId: string, usedFallback: boolean) => void;
  /** Called once a batch approval transaction lands. */
  onBatchConfirmed: () => void;
  /** Milestone indexes selected for batch approval (pruned to Delivered). */
  selectedForBatch: number[];
  /** Index of the milestone being disputed, if a dispute modal is open. */
  disputeMilestoneIndex: number | null;
  /** Open the dispute modal for a milestone. */
  onDisputeOpen: (index: number) => void;
  /** Close the dispute modal and clear its index. */
  onDisputeClose: () => void;
}

export interface UseJobActionsReturn {
  executeTx: (
    actionKey: string,
    method: string,
    args: { type: string; value: unknown }[]
  ) => Promise<string | null>;
  startUpdatingPoll: (jobId: string) => void;
  updatingJobIds: Set<string>;
  handlePartialRelease: (index: number, amount: string) => Promise<void>;
  handleClaimAutoRelease: (index: number) => Promise<void>;
  handleMarkDelivered: (index: number) => Promise<void>;
  handleFund: () => Promise<void>;
  handleApprove: (index: number) => Promise<void>;
  handleBatchApprove: () => Promise<void>;
  handleSweepExcess: (token: string) => Promise<string | null>;
  handleDispute: (index: number) => void;
  handleDisputeSubmit: (reason: string) => Promise<void>;
  handleResolveDispute: (index: number, releaseToFreelancer: boolean) => Promise<void>;
}

/**
 * All of the dashboard's job-action transaction handlers plus `executeTx` and
 * the post-action "updating" poll (#670).
 */
export function useJobActions(job: Job | null, ctx: UseJobActionsContext): UseJobActionsReturn {
  const {
    address,
    signTransaction,
    registerPendingAction,
    isPending,
    setPhase,
    setError: setActionError,
    setTxHash,
    refetchJobs,
    refetchDetails,
    onJobDetailUpdated,
    onContractFallback,
    onBatchConfirmed,
    selectedForBatch,
    disputeMilestoneIndex,
    onDisputeOpen,
    onDisputeClose,
  } = ctx;

  const jobId = job?.id ?? null;

  // ── Updating poll (#670) ─────────────────────────────────────────────
  const [updatingJobIds, setUpdatingJobIds] = useState<Set<string>>(new Set());
  const updatingPollerRefs = useRef<Map<string, () => void>>(new Map());

  const startUpdatingPoll = useCallback(
    (jid: string) => {
      updatingPollerRefs.current.get(jid)?.();

      setUpdatingJobIds((prev) => {
        const next = new Set(prev);
        next.add(jid);
        return next;
      });

      const MAX_POLL_DURATION_MS = 120_000;
      const BACKOFF_STEPS_MS = [2_000, 4_000, 8_000, 15_000];
      const startedAt = Date.now();
      let stepIndex = 0;
      let timerId: ReturnType<typeof setTimeout> | null = null;
      let cancelled = false;

      const stop = () => {
        cancelled = true;
        if (timerId !== null) clearTimeout(timerId);
        updatingPollerRefs.current.delete(jid);
        setUpdatingJobIds((prev) => {
          const next = new Set(prev);
          next.delete(jid);
          return next;
        });
      };

      const scheduleNext = () => {
        if (cancelled) return;
        if (Date.now() - startedAt >= MAX_POLL_DURATION_MS) {
          stop();
          return;
        }
        const delay = BACKOFF_STEPS_MS[Math.min(stepIndex, BACKOFF_STEPS_MS.length - 1)];
        stepIndex += 1;
        timerId = setTimeout(async () => {
          if (cancelled) return;
          try {
            await refetchJobs();
            stop();
          } catch {
            scheduleNext();
          }
        }, delay);
      };

      scheduleNext();
      updatingPollerRefs.current.set(jid, stop);
    },
    [refetchJobs]
  );

  const executeTx = useCallback(
    async (actionKeyName: string, method: string, args: { type: string; value: unknown }[]) => {
      if (!address || !jobId) return null;
      const contractId = jobId;

      registerPendingAction({ contractId, method, args, sourceAddress: address });

      const txHash = await runContractAction(
        actionKeyName,
        (onPhase) =>
          submitContractTransaction({
            contractId,
            method,
            args,
            sourceAddress: address,
            signTransaction,
            onPhase,
          }),
        { isPending, setPhase, setError: setActionError, setTxHash }
      );

      if (txHash !== null) {
        // Mark the row "Updating…" while the indexer catches up.
        startUpdatingPoll(jobId);

        // Confirm the new state directly from the contract first (#895).
        const contractJob = await fetchJobStateFromContract(jobId);
        if (contractJob) {
          onJobDetailUpdated(contractJob);
          onContractFallback(jobId, true);
        }

        await refetchJobs();
        await refetchDetails(true);
      }

      return txHash;
    },
    [
      address,
      jobId,
      signTransaction,
      registerPendingAction,
      isPending,
      setPhase,
      setActionError,
      setTxHash,
      startUpdatingPoll,
      onJobDetailUpdated,
      onContractFallback,
      refetchJobs,
      refetchDetails,
    ]
  );

  const handlePartialRelease = useCallback(
    async (index: number, amount: string) => {
      if (!address || !amount || !jobId) return;
      await executeTx(actionKey(jobId, "partial", index), "approve_partial", [
        { type: "address", value: address },
        { type: "u32", value: index.toString() },
        { type: "i128", value: amount },
      ]);
    },
    [address, jobId, executeTx]
  );

  const handleClaimAutoRelease = useCallback(
    async (index: number) => {
      if (!address || !jobId) return;
      await executeTx(actionKey(jobId, "claim", index), "claim_auto_release", [
        { type: "address", value: address },
        { type: "u32", value: index.toString() },
      ]);
    },
    [address, jobId, executeTx]
  );

  const handleMarkDelivered = useCallback(
    async (index: number) => {
      if (!address || !jobId) return;
      await executeTx(actionKey(jobId, "deliver", index), "mark_delivered", [
        { type: "address", value: address },
        { type: "u32", value: index.toString() },
      ]);
    },
    [address, jobId, executeTx]
  );

  const handleFund = useCallback(async () => {
    if (!address || !job || !jobId) return;
    await executeTx(actionKey(job.id, "fund"), "fund", [{ type: "address", value: address }]);
  }, [address, job, jobId, executeTx]);

  const handleApprove = useCallback(
    async (index: number) => {
      if (!address || !jobId) return;
      await executeTx(actionKey(jobId, "approve", index), "approve_milestone", [
        { type: "address", value: address },
        { type: "u32", value: index.toString() },
      ]);
    },
    [address, jobId, executeTx]
  );

  const handleBatchApprove = useCallback(async () => {
    if (!address || validateBatchSelection(selectedForBatch) !== null) return;

    const txHash = await executeTx(BATCH_APPROVE_KEY, "approve_milestones", buildApproveMilestonesArgs(address, selectedForBatch));
    if (txHash !== null) {
      onBatchConfirmed();
    }
  }, [address, selectedForBatch, executeTx, onBatchConfirmed]);

  const handleSweepExcess = useCallback(
    async (token: string) => {
      if (!address) return null;
      return executeTx(`sweep-${token}`, "sweep_excess", buildSweepExcessArgs(address, token));
    },
    [address, executeTx]
  );

  const handleDispute = useCallback(
    (index: number) => {
      onDisputeOpen(index);
    },
    [onDisputeOpen]
  );

  const handleDisputeSubmit = useCallback(
    async (reason: string) => {
      if (!address || disputeMilestoneIndex === null || !jobId) return;
      await executeTx(actionKey(jobId, "dispute", disputeMilestoneIndex), "raise_dispute", [
        { type: "address", value: address },
        { type: "u32", value: disputeMilestoneIndex.toString() },
        { type: "bytes", value: await hashDisputeReason(reason) },
      ]);
      onDisputeClose();
    },
    [address, disputeMilestoneIndex, jobId, executeTx, onDisputeClose]
  );

  const handleResolveDispute = useCallback(
    async (index: number, releaseToFreelancer: boolean) => {
      if (!address || !jobId) return;
      await executeTx(actionKey(jobId, "resolve", index), "resolve_dispute", [
        { type: "address", value: address },
        { type: "u32", value: index.toString() },
        { type: "bool", value: releaseToFreelancer },
      ]);
    },
    [address, jobId, executeTx]
  );

  return {
    executeTx,
    startUpdatingPoll,
    updatingJobIds,
    handlePartialRelease,
    handleClaimAutoRelease,
    handleMarkDelivered,
    handleFund,
    handleApprove,
    handleBatchApprove,
    handleSweepExcess,
    handleDispute,
    handleDisputeSubmit,
    handleResolveDispute,
  };
}
