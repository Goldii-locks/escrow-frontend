"use client";

import { useCallback } from "react";
import type { Job } from "@/app/lib/api_schemas";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";
import CopyButton from "@/app/components/CopyButton";
import EscrowLockBanner from "@/app/components/EscrowLockBanner";
import { ArbiterPanelPlaceholder } from "@/app/components/ArbiterActionPanel";
import { getArbiterJobEmptyState } from "@/app/lib/arbiter_action_panel";
import MilestoneCard from "@/app/components/MilestoneCard";
import JobActivityTimeline from "@/app/components/JobActivityTimeline";
import RecoverExcessFunds from "@/app/components/RecoverExcessFunds";
import { canFund } from "@/app/lib/milestone_actions";
import { MAX_BATCH_APPROVALS } from "@/app/lib/batch_approval";
import { BATCH_APPROVE_KEY, actionKey } from "@/app/hooks/useJobActions";
import type { ActionState } from "@/app/hooks/useActionStates";
import type { EscrowLockState } from "@/app/lib/escrow_lock_state";

export interface JobDetailsPanelProps {
  job: Job;
  address: string | null;
  milestoneList: Array<{ index: number; amount: string; status: string; releasedAmount?: string }>;
  /** Detail loading / error state for the expanded job. */
  detailsLoading: boolean;
  detailsError: string | null;
  onRetryDetails: () => void;
  /** Label (persisted on this device). */
  jobLabel: string;
  onJobLabelChange: (value: string) => void;
  /** Whether this job's detail came from the contract fallback. */
  isContractFallback: boolean;
  /** Escrow pause / cancel-lock state. */
  escrowLock: EscrowLockState;
  /** Whether to show the "no disputes" arbiter placeholder. */
  hasDispute: boolean;
  /** Arbiter-fee state for disputed jobs. */
  feeBps: number | undefined;
  isFeeLoading: boolean;
  /** Auto-release deadlines keyed by milestone index. */
  deadlines: Record<number, number | null>;
  actions: {
    handleFund: () => Promise<void>;
    handleApprove: (index: number) => Promise<void>;
    handleMarkDelivered: (index: number) => Promise<void>;
    handlePartialRelease: (index: number, amount: string) => Promise<void>;
    handleClaimAutoRelease: (index: number) => Promise<void>;
    handleResolveDispute: (index: number, releaseToFreelancer: boolean) => Promise<void>;
    handleDispute: (index: number) => void;
    handleSweepExcess: (token: string) => Promise<string | null>;
  };
  /** Transaction-state lookups for the milestone cards. */
  getState: (key: string) => ActionState;
  isPending: (key: string) => boolean;
  batch: {
    offerBatchApproval: boolean;
    selectedForBatch: number[];
    onSelectChange: (index: number, selected: boolean) => void;
    onBatchApprove: () => void;
  };
  /** The job/milestone to scroll to and highlight after opening from the panel. */
  focusTarget: { jobId: string; milestoneIndex: number | null; nonce: number } | null;
}

export function JobDetailsPanel({
  job,
  address,
  milestoneList,
  detailsLoading,
  detailsError,
  onRetryDetails,
  jobLabel,
  onJobLabelChange,
  isContractFallback,
  escrowLock,
  hasDispute,
  feeBps,
  isFeeLoading,
  deadlines,
  actions: {
    handleFund,
    handleApprove,
    handleMarkDelivered,
    handlePartialRelease,
    handleClaimAutoRelease,
    handleResolveDispute,
    handleDispute,
    handleSweepExcess,
  },
  getState,
  isPending,
  batch: { offerBatchApproval, selectedForBatch, onSelectChange, onBatchApprove },
  focusTarget,
}: JobDetailsPanelProps) {
  const isClient = address === job.client;
  const isFreelancer = address === job.freelancer;
  const isArbiter = address === job.arbiter;
  const showArbiterNoDisputes = isArbiter && getArbiterJobEmptyState(milestoneList) === "no-disputes";
  const tokenDecimals = job.tokenDecimals ?? 7;
  const tokenSymbol = job.tokenSymbol ?? "XLM";
  const expandedJobHasDispute = hasDispute;
  const expandedJobFeeBps = feeBps ?? undefined;

  const handleBatchSelectChange = useCallback(
    (index: number, selected: boolean) => {
      onSelectChange(index, selected);
    },
    [onSelectChange]
  );

  if (detailsLoading) {
    return <LoadingSkeleton />;
  }
  if (detailsError) {
    return (
      <div className="bg-red-950/40 border border-red-800/60 rounded-lg p-3 sm:p-4 my-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-red-400 font-semibold text-sm">Failed to load job details</p>
          <p className="text-red-300/80 text-xs mt-0.5">{detailsError}</p>
        </div>
        <button
          type="button"
          onClick={onRetryDetails}
          className="px-3 py-1.5 bg-red-800 hover:bg-red-700 text-white rounded text-xs font-medium transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const canFundJob = canFund(job, isClient);

  return (
    <>
      <label className="block mb-3 text-xs text-text-muted">
        Label (saved on this device)
        <input
          type="text"
          value={jobLabel}
          maxLength={60}
          placeholder={`Job #${job.id.slice(0, 8)}`}
          onChange={(e) => onJobLabelChange(e.target.value)}
          className="mt-1 block w-full rounded border border-border-subtle bg-surface-field px-2 py-1 text-sm text-text-primary"
        />
      </label>
      {isContractFallback && (
        <p
          data-testid="contract-fallback-banner"
          className="text-xs text-amber-300 bg-amber-900/30 border border-amber-700/50 rounded px-3 py-2"
          role="status"
          aria-live="polite"
        >
          Live from the contract; history may be delayed.
        </p>
      )}
      {offerBatchApproval && (
        <div
          data-testid="batch-approve-bar"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-border-subtle bg-surface-field px-3 py-2"
        >
          <p className="text-xs text-text-muted" aria-live="polite">
            {selectedForBatch.length === 0
              ? `Select delivered milestones to approve them in one transaction (up to ${MAX_BATCH_APPROVALS}).`
              : `${selectedForBatch.length} selected`}
          </p>
          <button
            type="button"
            data-testid="batch-approve-button"
            onClick={onBatchApprove}
            disabled={
              selectedForBatch.length === 0 ||
              isPending(BATCH_APPROVE_KEY) ||
              escrowLock.actionsDisabled
            }
            title={escrowLock.actionsDisabled ? escrowLock.tooltip : undefined}
            className="text-xs px-3 py-1.5 rounded-lg bg-success text-surface-page font-medium hover:bg-success/80 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-soft disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending(BATCH_APPROVE_KEY)
              ? "Approving…"
              : `Approve selected${selectedForBatch.length > 0 ? ` (${selectedForBatch.length})` : ""}`}
          </button>
        </div>
      )}
      <div className="space-y-3 sm:space-y-4" role="region" aria-label="Milestones">
        <EscrowLockBanner kind={escrowLock.kind} message={escrowLock.message} />
        {showArbiterNoDisputes && <ArbiterPanelPlaceholder variant="no-disputes" />}
        {milestoneList.length > 0 ? (
          milestoneList.map((m) => (
            <div
              key={`${job.id}-${m.index}`}
              id={`milestone-${job.id}-${m.index}`}
              tabIndex={-1}
              data-testid="milestone-focus-target"
              data-focused={
                focusTarget?.jobId === job.id && focusTarget.milestoneIndex === m.index ? "true" : undefined
              }
              className={
                focusTarget?.jobId === job.id && focusTarget.milestoneIndex === m.index
                  ? "rounded-lg ring-2 ring-accent-soft ring-offset-2 ring-offset-surface-page focus:outline-none"
                  : "focus:outline-none"
              }
            >
              <MilestoneCard
                milestone={m}
                isClient={isClient}
                isFreelancer={isFreelancer}
                isArbiter={isArbiter}
                amountDecimals={tokenDecimals}
                amountSymbol={tokenSymbol}
                freelancerAddress={job.freelancer}
                resolveDisputeState={getState(actionKey(job.id, "resolve", m.index))}
                isResolveDisputePending={isPending(actionKey(job.id, "resolve", m.index))}
                onResolveDispute={handleResolveDispute}
                partialReleaseState={getState(actionKey(job.id, "partial", m.index))}
                claimAutoReleaseState={getState(actionKey(job.id, "claim", m.index))}
                isPartialReleasePending={isPending(actionKey(job.id, "partial", m.index))}
                isClaimAutoReleasePending={isPending(actionKey(job.id, "claim", m.index))}
                autoReleaseDeadline={deadlines[m.index] ?? null}
                onPartialRelease={handlePartialRelease}
                onClaimAutoRelease={handleClaimAutoRelease}
                onMarkDelivered={handleMarkDelivered}
                onApprove={handleApprove}
                onDispute={handleDispute}
                escrowLocked={escrowLock.actionsDisabled}
                lockTooltip={escrowLock.tooltip}
                arbiterFeeBps={expandedJobHasDispute ? expandedJobFeeBps : undefined}
                isArbiterFeeLoading={expandedJobHasDispute && expandedJobFeeBps === undefined}
                selectable={offerBatchApproval}
                selected={selectedForBatch.includes(m.index)}
                onSelectChange={handleBatchSelectChange}
              />
            </div>
          ))
        ) : (
          <MilestoneCard
            milestone={null}
            isClient={isClient}
            isFreelancer={isFreelancer}
            partialReleaseState={getState("empty")}
            claimAutoReleaseState={getState("empty")}
            isPartialReleasePending={false}
            isClaimAutoReleasePending={false}
          />
        )}
      </div>

      {isClient && canFundJob && (
        <div className="bg-amber-950/40 border border-amber-600/50 rounded-lg p-3 sm:p-4 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-amber-300 font-semibold text-sm">Escrow Unfunded</p>
            <p className="text-amber-200/80 text-xs mt-0.5">
              Deposit the escrow tokens so the freelancer can begin delivery.
            </p>
          </div>
          <button
            type="button"
            onClick={handleFund}
            disabled={isPending(actionKey(job.id, "fund"))}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold transition"
          >
            {isPending(actionKey(job.id, "fund")) ? "Funding..." : "Fund escrow"}
          </button>
        </div>
      )}

      {isClient && address && (
        <RecoverExcessFunds
          contractId={job.id}
          clientAddress={address}
          jobToken={job.token ?? null}
          jobTokenSymbol={tokenSymbol}
          jobTokenDecimals={tokenDecimals}
          onSweep={handleSweepExcess}
          getSweepState={(token) => getState(`sweep-${token}`)}
          isSweepPending={(token) => isPending(`sweep-${token}`)}
        />
      )}

      <JobActivityTimeline
        key={job.id}
        contractId={job.id}
        refreshKey={[
          job.latestLedger ?? "",
          job.funded ? 1 : 0,
          milestoneList.map((m) => `${m.status}:${m.releasedAmount ?? ""}`).join(","),
        ].join("|")}
      />
    </>
  );
}
