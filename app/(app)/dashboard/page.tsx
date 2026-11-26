"use client";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/app/context/WalletContext";
import Navbar from "@/app/components/Navbar";
import { useActionStates } from "@/app/hooks/useActionStates";
import { useJobList } from "@/app/hooks/useJobList";
import { useJobDetails } from "@/app/hooks/useJobDetails";
import { useJobActions, actionKey, BATCH_APPROVE_KEY } from "@/app/hooks/useJobActions";
import { JobList } from "@/app/components/dashboard/JobList";
import DisputeRaiseModal from "@/app/components/DisputeRaiseModal";
import BatchApproveModal from "@/app/components/BatchApproveModal";
import { fetchAllAutoReleaseDeadlines } from "@/app/lib/autoRelease";
import { fetchArbiterFeeBps } from "@/app/lib/arbiter_fee";
import { getEscrowLockState } from "@/app/lib/escrow_lock_state";
import { type Job } from "@/app/lib/api_schemas";
import { getJobLabel, setJobLabel } from "@/app/lib/job_list_summary";
import {
  shouldOfferBatchApproval,
  pruneBatchSelection,
  getBatchApprovalTotal,
  toggleBatchSelection,
} from "@/app/lib/batch_approval";
export default function Dashboard() {
  const { address, signTransaction, connect, isConnecting, registerPendingAction } = useWallet();
  const { getState, isPending, setPhase, setError: setActionError, setTxHash } = useActionStates();
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<"all" | "client" | "freelancer" | "arbiter">("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobLabels, setJobLabels] = useState<Record<string, string>>({});
  const [batchSelection, setBatchSelection] = useState<{ jobId: string | null; indices: number[] }>({ jobId: null, indices: [] });
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeMilestoneIndex, setDisputeMilestoneIndex] = useState<number | null>(null);
  const [pinnedJob, setPinnedJob] = useState<Job | null>(null);
  const pinnedJobIdRef = useRef<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<{
    jobId: string;
    milestoneIndex: number | null;
    nonce: number;
  } | null>(null);
  const lastFocusNonceRef = useRef<number | null>(null);
  const [contractFallbackIds, setContractFallbackIds] = useState<Set<string>>(new Set());
  const [arbiterFeeBps, setArbiterFeeBps] = useState<Record<string, number | null>>({});
  const [autoReleaseDeadlines, setAutoReleaseDeadlines] = useState<Record<number, number | null>>({});
  const toggleContractFallback = (jobId: string, usedFallback: boolean) =>
    setContractFallbackIds((prev) => {
      const next = new Set(prev);
      usedFallback ? next.add(jobId) : next.delete(jobId);
      return next;
    });
  const { jobs, total, fetchLoading, error, refetch: refetchJobs } = useJobList({
    address,
    page,
    roleFilter,
  });
  const { job: expandedJob, loading: detailsLoading, error: detailsError, refetch: refetchDetails } =
    useJobDetails({ id: expandedJobId, onContractFallback: toggleContractFallback });
  const milestoneList = Array.isArray(expandedJob?.milestones) ? expandedJob.milestones : [];
  const isClient = Boolean(expandedJob && address === expandedJob.client);
  const expandedJobHasDispute = milestoneList.some((m) => m.status === "Disputed");
  const expandedJobFeeBps = expandedJobId !== null && expandedJobId in arbiterFeeBps ? arbiterFeeBps[expandedJobId] ?? undefined : undefined;
  const offerBatchApproval = isClient && shouldOfferBatchApproval(milestoneList);
  const selectedForBatch = offerBatchApproval && batchSelection.jobId === expandedJobId ? pruneBatchSelection(batchSelection.indices, milestoneList) : [];
  const batchTotal = getBatchApprovalTotal(selectedForBatch, milestoneList);
  const actions = useJobActions(expandedJob, {
    address,
    signTransaction,
    registerPendingAction,
    isPending,
    setPhase,
    setError: setActionError,
    setTxHash,
    refetchJobs: refetchJobs,
    refetchDetails: refetchDetails,
    onJobDetailUpdated: () => {},
    onContractFallback: toggleContractFallback,
    onBatchConfirmed: () => {
      setBatchModalOpen(false);
      setBatchSelection({ jobId: null, indices: [] });
    },
    selectedForBatch,
    disputeMilestoneIndex,
    onDisputeOpen: (index) => {
      setDisputeMilestoneIndex(index);
      setDisputeModalOpen(true);
    },
    onDisputeClose: () => {
      setDisputeModalOpen(false);
      setDisputeMilestoneIndex(null);
    },
  });

  const {
    handleBatchApprove,
    handleDisputeSubmit,
    handleFund,
    handleApprove,
    handleMarkDelivered,
    handlePartialRelease,
    handleClaimAutoRelease,
    handleResolveDispute,
    handleDispute,
    handleSweepExcess,
  } = actions;
  useEffect(() => {
    if (!expandedJobId || !expandedJobHasDispute || expandedJobId in arbiterFeeBps) return;
    let active = true;
    const jobId = expandedJobId;
    void fetchArbiterFeeBps(jobId).then((bps) => {
      if (active) setArbiterFeeBps((current) => ({ ...current, [jobId]: bps }));
    });
    return () => {
      active = false;
    };
  }, [expandedJobId, expandedJobHasDispute, arbiterFeeBps]);
  useEffect(() => {
    const controller = new AbortController();
    const jobId = expandedJob?.id;
    const deliveredIndexes = milestoneList
      .filter((m) => m.status === "Delivered")
      .map((m) => m.index);
    (async () => {
      if (!jobId || deliveredIndexes.length === 0) {
        await Promise.resolve();
        if (!controller.signal.aborted) setAutoReleaseDeadlines({});
        return;
      }
      const deadlines = await fetchAllAutoReleaseDeadlines(jobId, deliveredIndexes, {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setAutoReleaseDeadlines(deadlines);
    })();
    return () => controller.abort();
  }, [expandedJob]);
  const panel = expandedJob
    ? {
        job: expandedJob,
        address,
        milestoneList,
        detailsLoading,
        detailsError,
        onRetryDetails: () => void refetchDetails(true),
        jobLabel: jobLabels[expandedJobId!] ?? getJobLabel(expandedJobId!),
        onJobLabelChange: (value: string) => {
          setJobLabels((prev) => ({ ...prev, [expandedJobId!]: value }));
          setJobLabel(expandedJobId!, value);
        },
        isContractFallback: contractFallbackIds.has(expandedJobId!),
        escrowLock: getEscrowLockState({
          pausedByAdmin: expandedJob?.pausedByAdmin,
          pausedByEmergency: expandedJob?.pausedByEmergency,
          cancelLocked: expandedJob?.cancelLocked,
        }),
        hasDispute: expandedJobHasDispute,
        feeBps: expandedJobFeeBps,
        isFeeLoading: expandedJobHasDispute && expandedJobFeeBps === undefined,
        deadlines: autoReleaseDeadlines,
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
        batch: {
          offerBatchApproval,
          selectedForBatch,
          onSelectChange: (index: number, selected: boolean) => {
            setBatchSelection((current) => {
              const base = current.jobId === expandedJobId ? current.indices : [];
              return { jobId: expandedJobId, indices: toggleBatchSelection(base, index, selected) };
            });
          },
          onBatchApprove: () => setBatchModalOpen(true),
        },
        focusTarget,
      }
    : null;
  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      <Navbar />
      <JobList
        jobs={jobs}
        total={total}
        page={page}
        setPage={setPage}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        address={address}
        expandedJobId={expandedJobId}
        setExpandedJobId={setExpandedJobId}
        connect={connect}
        isConnecting={isConnecting}
        onToggle={(jobId, isExpanded) => {
          setExpandedJobId(isExpanded ? null : jobId);
          if (pinnedJobIdRef.current && (isExpanded || jobId !== pinnedJobIdRef.current)) {
            pinnedJobIdRef.current = null;
            setPinnedJob(null);
          }
          setFocusTarget(null);
        }}
        onNeedsActionSelect={(job, milestoneIndex) => {
          const onPage = jobs.some((j) => j.id === job.id);
          pinnedJobIdRef.current = onPage ? null : job.id;
          setPinnedJob(onPage ? null : job);
          setExpandedJobId(job.id);
          setFocusTarget({ jobId: job.id, milestoneIndex, nonce: Date.now() });
        }}
        onSearch={(event: React.FormEvent) => {
          event.preventDefault();
          setPage(1);
          setSearchQuery(searchInput.trim());
        }}
        jobLabels={jobLabels}
        isUpdating={(jobId) => actions.updatingJobIds.has(jobId)}
        panel={panel}
        fetchLoading={fetchLoading}
        error={error}
        refetchJobs={refetchJobs}
        pinnedJob={pinnedJob}
        setPinnedJob={setPinnedJob}
      />
      {batchModalOpen && expandedJob && (
        <BatchApproveModal
          isOpen
          onClose={() => setBatchModalOpen(false)}
          onConfirm={() => void handleBatchApprove()}
          milestones={milestoneList.filter((m) => selectedForBatch.includes(m.index))}
          totalStroops={(batchTotal ?? BigInt(0)).toString()}
          decimals={expandedJob.tokenDecimals ?? 7}
          symbol={expandedJob.tokenSymbol ?? "XLM"}
          recipientAddress={expandedJob.freelancer}
          isConfirming={isPending(BATCH_APPROVE_KEY)}
          errorMessage={getState(BATCH_APPROVE_KEY).error}
        />
      )}
      {disputeMilestoneIndex !== null && (
        <DisputeRaiseModal
          isOpen={disputeModalOpen}
          onClose={() => {
            setDisputeModalOpen(false);
            setDisputeMilestoneIndex(null);
          }}
          onSubmit={handleDisputeSubmit}
          milestoneIndex={disputeMilestoneIndex}
          isLoading={
            expandedJobId
              ? isPending(actionKey(expandedJobId, "dispute", disputeMilestoneIndex!))
              : false
          }
          submissionError={
            expandedJobId
              ? getState(actionKey(expandedJobId, "dispute", disputeMilestoneIndex!))?.error
              : undefined
          }
        />
      )}
    </div>
  );
}
