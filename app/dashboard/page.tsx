"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useWallet } from "@/app/context/WalletContext";
import Navbar from "@/app/components/Navbar";
import MilestoneCard from "@/app/components/MilestoneCard";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";
import EmptyStateCard from "@/app/components/EmptyStateCard";
import DisputeRaiseModal from "@/app/components/DisputeRaiseModal";
import { ArbiterPanelPlaceholder } from "@/app/components/ArbiterActionPanel";
import { getArbiterJobEmptyState } from "@/app/lib/arbiter_action_panel";
import { useActionStates } from "@/app/hooks/useActionStates";
import { useToast } from "@/app/context/ToastContext";
import {
  BACKEND_URL,
  runContractAction,
  submitContractTransaction,
} from "@/app/lib/transactions";
import { fetchAutoReleaseInfo } from "@/app/lib/autoRelease";
import {
  buildCancelEscrow,
  buildRevokeCancelApproval,
  buildExtendMilestoneDeadline,
  buildApplyDisputeArbitrationSplit,
  buildAdminOverrideRelease,
  buildAdminOverrideRefund,
  buildEmergencyUnpause,
  buildAdminPauseEscrow,
  buildAdminResumeEscrow,
  buildWithdraw,
  buildEscalateDispute,
  buildRequestRevision,
} from "@/app/lib/contract_actions";
import CancelRevokeModal from "@/app/components/CancelRevokeModal";
import ExtendDeadlineModal from "@/app/components/ExtendDeadlineModal";
import SplitResolutionModal from "@/app/components/SplitResolutionModal";
import AdminOverrideModal from "@/app/components/AdminOverrideModal";
import WithdrawOwedModal from "@/app/components/WithdrawOwedModal";
import EscalateDisputeModal from "@/app/components/EscalateDisputeModal";
import RequestRevisionModal from "@/app/components/RequestRevisionModal";

interface Milestone {
  index: number;
  amount: string;
  status: string;
  releasedAmount?: string;
  /** #819: number of revisions already requested for this milestone. */
  revisionCount?: number | null;
  /** #818: epoch ms when the dispute was raised. */
  disputedAtMs?: number | null;
  /** #818: escrow dispute timeout in ms. */
  disputeTimeoutMs?: number | null;
}

interface Job {
  id: string;
  client: string;
  freelancer: string;
  arbiter: string;
  admin?: string;
  funded: boolean;
  milestones?: Milestone[];
  token?: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  /** #817: owed base units (stroops) for the connected wallet on this job. */
  owedBaseUnits?: string | null;
  /** #596: whether a cancel approval is currently pending. */
  cancelPending?: boolean;
}

type RoleFilter = "all" | "client" | "freelancer" | "arbiter";

interface JobPageResponse {
  success?: boolean;
  data?: unknown;
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
  };
  page?: number;
  limit?: number;
  total?: number;
  totalItems?: number;
  error?: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeJob(item: unknown): Job | null {
  if (!isObject(item) || typeof item.id !== "string") return null;

  return {
    id: item.id,
    client: typeof item.client === "string" ? item.client : "",
    freelancer: typeof item.freelancer === "string" ? item.freelancer : "",
    arbiter: typeof item.arbiter === "string" ? item.arbiter : "",
    admin: typeof item.admin === "string" ? item.admin : undefined,
    funded: Boolean(item.funded),
    milestones: Array.isArray(item.milestones)
      ? (item.milestones as Milestone[]).map((m) => ({
          index: typeof m.index === "number" ? m.index : 0,
          amount: typeof m.amount === "string" ? m.amount : "0",
          status: typeof m.status === "string" ? m.status : "Pending",
          releasedAmount:
            typeof m.releasedAmount === "string" ? m.releasedAmount : undefined,
          revisionCount:
            typeof m.revisionCount === "number" ? m.revisionCount : null,
          disputedAtMs:
            typeof m.disputedAtMs === "number" ? m.disputedAtMs : null,
          disputeTimeoutMs:
            typeof m.disputeTimeoutMs === "number" ? m.disputeTimeoutMs : null,
        }))
      : undefined,
    token: typeof item.token === "string" ? item.token : undefined,
    tokenSymbol: typeof item.tokenSymbol === "string" ? item.tokenSymbol : undefined,
    tokenDecimals:
      typeof item.tokenDecimals === "number" && Number.isFinite(item.tokenDecimals)
        ? item.tokenDecimals
        : undefined,
    owedBaseUnits:
      typeof item.owedBaseUnits === "string" ? item.owedBaseUnits : null,
    cancelPending: Boolean(item.cancelPending),
  };
}

function parsePageResponse(payload: JobPageResponse): {
  jobs: Job[];
  page: number;
  limit: number;
  total: number;
} {
  const fallback = { jobs: [] as Job[], page: 1, limit: 5, total: 0 };

  if (!payload || payload.success === false) {
    return fallback;
  }

  let rows: unknown[] = [];
  let page = payload.page ?? payload.pagination?.page ?? 1;
  let limit = payload.limit ?? payload.pagination?.limit ?? 5;
  let total = payload.total ?? payload.totalItems ?? payload.pagination?.total ?? 0;

  if (Array.isArray(payload.data)) {
    rows = payload.data;
  } else if (isObject(payload.data)) {
    const embedded = payload.data as Record<string, unknown>;
    if (Array.isArray(embedded.jobs)) {
      rows = embedded.jobs;
    } else if (Array.isArray(embedded.items)) {
      rows = embedded.items;
    } else if (typeof embedded.id === "string") {
      rows = [embedded];
      page = 1;
      limit = 1;
      total = 1;
    }

    if (typeof embedded.page === "number") page = embedded.page;
    if (typeof embedded.limit === "number") limit = embedded.limit;
    if (typeof embedded.total === "number") total = embedded.total;
    if (typeof embedded.totalItems === "number") total = embedded.totalItems;
  }

  const jobs = rows
    .map(normalizeJob)
    .filter((job): job is Job => job !== null);

  return {
    jobs,
    page,
    limit,
    total: total || jobs.length,
  };
}

const roleFilterLabels: Array<{ id: RoleFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "client", label: "As Client" },
  { id: "freelancer", label: "As Freelancer" },
  { id: "arbiter", label: "As Arbiter" },
];

export default function Dashboard() {
  const { address, signTransaction } = useWallet();
  const { showToast } = useToast();
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobDetails, setJobDetails] = useState<Record<string, Job>>({});
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [limit] = useState(5);
  const [total, setTotal] = useState(0);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeMilestoneIndex, setDisputeMilestoneIndex] = useState<number | null>(null);
  /** #596: cancel / revoke cancel approval modal. */
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelRole, setCancelRole] = useState<"client" | "freelancer">("client");
  /** #596: extend deadline modal. */
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendMilestoneIndex, setExtendMilestoneIndex] = useState<number | null>(null);
  const [extendCurrentSeconds, setExtendCurrentSeconds] = useState<number | null>(null);
  /** #596: split resolution modal (arbiter). */
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitMilestoneIndex, setSplitMilestoneIndex] = useState<number | null>(null);
  /** #596: admin override modal. */
  const [adminOverrideModalOpen, setAdminOverrideModalOpen] = useState(false);
  const [adminOverrideKind, setAdminOverrideKind] = useState<"release" | "refund">("release");
  const [adminOverrideMilestoneIndex, setAdminOverrideMilestoneIndex] = useState<number | null>(null);
  /** #817: withdraw owed modal. */
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  /** #818: escalate dispute modal. */
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [escalateMilestoneIndex, setEscalateMilestoneIndex] = useState<number | null>(null);
  /** #819: request revision modal. */
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [revisionMilestoneIndex, setRevisionMilestoneIndex] = useState<number | null>(null);

  const { getState, isPending, setPhase, setError: setActionError, setTxHash } =
    useActionStates();

  const totalPages = Math.max(1, Math.ceil((total || jobs.length || 1) / limit));

  const fetchJobs = useCallback(async () => {
    if (!address) {
      setFetchLoading(false);
      setJobs([]);
      setExpandedJobId(null);
      return;
    }

    setFetchLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (roleFilter !== "all") {
        params.set("role", roleFilter);
      }

      if (searchQuery.trim().length > 0) {
        params.set("contractId", searchQuery.trim());
      }

      const res = await fetch(
        `${BACKEND_URL}/api/jobs/by-wallet/${encodeURIComponent(address)}?${params.toString()}`
      );
      const data = (await res.json()) as JobPageResponse;

      if (data.success === false) {
        setError(data.error || "Failed to fetch jobs");
        setJobs([]);
        setTotal(0);
        setExpandedJobId(null);
        return;
      }

      const parsed = parsePageResponse(data);
      setJobs(parsed.jobs);
      setPage(parsed.page || page);
      setTotal(parsed.total);

      setExpandedJobId((previous) => {
        if (!parsed.jobs.length) return null;
        if (previous && parsed.jobs.some((job) => job.id === previous)) {
          return previous;
        }
        return parsed.jobs[0].id;
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to connect to backend");
      setJobs([]);
      setTotal(0);
      setExpandedJobId(null);
    } finally {
      setFetchLoading(false);
    }
  }, [address, page, limit, roleFilter, searchQuery]);

  const fetchJobDetails = useCallback(
    async (jobId: string, force = false) => {
      if (!address || !jobId) return;
      if (!force && jobDetails[jobId]) return;

      setDetailsLoading((current) => ({ ...current, [jobId]: true }));

      try {
        const res = await fetch(`${BACKEND_URL}/api/jobs/${encodeURIComponent(jobId)}`);
        const payload = (await res.json()) as JobPageResponse;
        const candidate = isObject(payload.data) ? normalizeJob(payload.data) : null;

        if (candidate) {
          setJobDetails((current) => ({ ...current, [jobId]: candidate }));
          return;
        }

        const fallback = jobs.find((job) => job.id === jobId);
        if (fallback) {
          setJobDetails((current) => ({ ...current, [jobId]: fallback }));
        }
      } catch {
        const fallback = jobs.find((job) => job.id === jobId);
        if (fallback) {
          setJobDetails((current) => ({ ...current, [jobId]: fallback }));
        }
      } finally {
        setDetailsLoading((current) => ({ ...current, [jobId]: false }));
      }
    },
    [address, jobDetails, jobs]
  );

  useEffect(() => {
    let active = true;

    Promise.resolve().then(() => {
      if (active) {
        void fetchJobs();
      }
    });

    return () => {
      active = false;
    };
  }, [fetchJobs]);

  useEffect(() => {
    let active = true;

    Promise.resolve().then(() => {
      if (active && expandedJobId) {
        void fetchJobDetails(expandedJobId);
      }
    });

    return () => {
      active = false;
    };
  }, [expandedJobId, fetchJobDetails]);

  useEffect(() => {
    if (!address) return;

    const interval = setInterval(() => {
      void fetchJobs();
      if (expandedJobId) {
        void fetchJobDetails(expandedJobId, true);
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [address, expandedJobId, fetchJobs, fetchJobDetails]);

  const expandedJob = expandedJobId ? jobDetails[expandedJobId] ?? null : null;
  const milestoneList = Array.isArray(expandedJob?.milestones)
    ? expandedJob.milestones
    : [];

  /** #817: whether the connected wallet has an owed balance on this job. */
  const hasOwed = (() => {
    if (!expandedJob?.owedBaseUnits) return false;
    try {
      return BigInt(expandedJob.owedBaseUnits) > BigInt(0);
    } catch {
      return false;
    }
  })();

  const isClient = !!(expandedJob && address === expandedJob.client);
  const isFreelancer = !!(expandedJob && address === expandedJob.freelancer);
  const isArbiter = !!(expandedJob && address === expandedJob.arbiter);
  const isAdmin = !!(expandedJob && expandedJob.admin && address === expandedJob.admin);
  // A job with no milestones already shows MilestoneCard's own empty state,
  // so the arbiter placeholder only covers "milestones, but none disputed".
  const showArbiterNoDisputes =
    isArbiter && getArbiterJobEmptyState(milestoneList) === "no-disputes";

  const [autoReleaseDeadlines, setAutoReleaseDeadlines] = useState<
    Record<number, number | null>
  >({});

  useEffect(() => {
    const controller = new AbortController();
    const jobId = expandedJob?.id;
    const deliveredIndexes = (Array.isArray(expandedJob?.milestones)
      ? expandedJob.milestones
      : []
    )
      .filter((m) => m.status === "Delivered")
      .map((m) => m.index);

    (async () => {
      if (!jobId || deliveredIndexes.length === 0) {
        await Promise.resolve();
        if (!controller.signal.aborted) setAutoReleaseDeadlines({});
        return;
      }

      const entries = await Promise.all(
        deliveredIndexes.map(async (index) => {
          const info = await fetchAutoReleaseInfo(jobId, index, {
            signal: controller.signal,
          });
          return [index, info.deadlineMs] as const;
        })
      );
      if (!controller.signal.aborted) {
        setAutoReleaseDeadlines(Object.fromEntries(entries));
      }
    })();

    return () => controller.abort();
  }, [expandedJob]);

  const executeTx = useCallback(
    async (actionKey: string, method: string, args: { type: string; value: unknown }[]) => {
      if (!address) return null;

      const txHash = await runContractAction(
        actionKey,
        (onPhase) =>
          submitContractTransaction({
            method,
            args,
            sourceAddress: address,
            signTransaction,
            onPhase,
          }),
        { isPending, setPhase, setError: setActionError, setTxHash }
      );

      if (txHash !== null) {
        await fetchJobs();
        if (expandedJobId) {
          await fetchJobDetails(expandedJobId, true);
        }
      }

      return txHash;
    },
    [
      address,
      signTransaction,
      isPending,
      setPhase,
      setActionError,
      setTxHash,
      fetchJobs,
      expandedJobId,
      fetchJobDetails,
    ]
  );

  const handlePartialRelease = async (index: number, amount: string) => {
    if (!address || !amount) return;

    await executeTx(`partial-${index}`, "approve_partial", [
      { type: "address", value: address },
      { type: "u32", value: index.toString() },
      { type: "i128", value: amount },
    ]);
  };

  const handleClaimAutoRelease = async (index: number) => {
    if (!address) return;

    await executeTx(`claim-${index}`, "claim_auto_release", [
      { type: "address", value: address },
      { type: "u32", value: index.toString() },
    ]);
  };

  const handleMarkDelivered = async (i: number) => {
    showToast(`Mark milestone ${i + 1} delivered (wired to contract soon)`, "info");
  };

  const handleApprove = async (i: number) => {
    showToast(`Approve milestone ${i + 1} (wired to contract soon)`, "info");
  };

  const handleDispute = (i: number) => {
    setDisputeMilestoneIndex(i);
    setDisputeModalOpen(true);
  };

  const handleDisputeSubmit = async (reason: string) => {
    if (!address || disputeMilestoneIndex === null) return;

    await executeTx(`dispute-${disputeMilestoneIndex}`, "raise_dispute", [
      { type: "address", value: address },
      { type: "u32", value: disputeMilestoneIndex.toString() },
      { type: "string", value: reason },
    ]);

    setDisputeModalOpen(false);
    setDisputeMilestoneIndex(null);
  };

  const handleResolveDispute = async (index: number, releaseToFreelancer: boolean) => {
    if (!address) return;

    await executeTx(`resolve-${index}`, "resolve_dispute", [
      { type: "address", value: address },
      { type: "u32", value: index.toString() },
      { type: "bool", value: releaseToFreelancer },
    ]);
  };

  /** #596: cancel escrow or revoke cancel approval (client / freelancer). */
  const handleCancel = async (kind: "cancel" | "revoke") => {
    if (!address) return;

    const { method, args } =
      kind === "cancel"
        ? buildCancelEscrow({ caller: address })
        : buildRevokeCancelApproval({ caller: address });

    await executeTx(`cancel-${kind}`, method, args);

    setCancelModalOpen(false);
  };

  /** #596: extend milestone deadline (client, Delivered). */
  const handleExtend = async (index: number) => {
    if (!address) return;

    const { method, args } = buildExtendMilestoneDeadline({
      caller: address,
      index,
      extensionSeconds: extendCurrentSeconds ?? 7 * 24 * 60 * 60,
    });

    await executeTx(`extend-${index}`, method, args);

    setExtendModalOpen(false);
    setExtendMilestoneIndex(null);
    setExtendCurrentSeconds(null);
  };

  /** #596: apply dispute arbitration split (arbiter, Disputed). */
  const handleApplySplit = async (index: number) => {
    if (!address) return;

    // Even 50/50 split by default; the modal lets the arbiter adjust.
    const { method, args } = buildApplyDisputeArbitrationSplit({
      caller: address,
      index,
      clientBps: 5000,
      freelancerBps: 5000,
    });

    await executeTx(`split-${index}`, method, args);

    setSplitModalOpen(false);
    setSplitMilestoneIndex(null);
  };

  /** #596: admin override release / refund. */
  const handleAdminOverride = async (kind: "release" | "refund", index: number) => {
    if (!address) return;

    const { method, args } =
      kind === "release"
        ? buildAdminOverrideRelease({ caller: address, index })
        : buildAdminOverrideRefund({ caller: address, index });

    await executeTx(`admin-override-${kind}-${index}`, method, args);

    setAdminOverrideModalOpen(false);
    setAdminOverrideMilestoneIndex(null);
  };

  /** #596: emergency unpause / pause / resume (admin). */
  const handleAdminPause = async (pause: boolean) => {
    if (!address) return;

    const { method, args } = pause
      ? buildAdminPauseEscrow({ caller: address })
      : buildAdminResumeEscrow({ caller: address });

    await executeTx(`admin-pause-${pause}`, method, args);
  };

  /** #596: emergency unpause (admin). Alias of resume for clarity. */
  const handleEmergencyUnpause = async () => {
    if (!address) return;

    const { method, args } = buildEmergencyUnpause({ caller: address });

    await executeTx("admin-emergency-unpause", method, args);
  };

  /** #817: withdraw owed credits. */
  const handleWithdraw = async () => {
    if (!address) return;

    const { method, args } = buildWithdraw({ caller: address });

    await executeTx("withdraw", method, args);

    setWithdrawModalOpen(false);
  };

  /** #818: escalate dispute (client / freelancer, Disputed). */
  const handleEscalate = async (index: number) => {
    if (!address) return;

    const { method, args } = buildEscalateDispute({ caller: address, index });

    await executeTx(`escalate-${index}`, method, args);

    setEscalateModalOpen(false);
    setEscalateMilestoneIndex(null);
  };

  /** #819: request revision (client, Delivered). */
  const handleRequestRevision = async (index: number) => {
    if (!address) return;

    // note_hash is computed off-chain from the note; the contract only stores
    // the hash. The modal captures the note text; the hash is derived by the
    // backend at build-tx time from the stored off-chain content.
    const { method, args } = buildRequestRevision({
      caller: address,
      index,
      noteHash: "",
    });

    await executeTx(`revision-${index}`, method, args);

    setRevisionModalOpen(false);
    setRevisionMilestoneIndex(null);
  };

  const paginationButtons = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);

    for (let p = start; p <= end; p += 1) {
      pages.push(p);
    }

    return pages;
  }, [page, totalPages]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <main className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-12">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6">Job Dashboard</h1>

        {!address ? (
          <p className="text-center text-gray-400 text-sm sm:text-base" role="status" aria-live="polite">
            Connect your wallet to view your jobs
          </p>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            <form onSubmit={handleSearch} className="flex flex-col gap-2 sm:gap-3">
              <label htmlFor="search-input" className="sr-only">
                Search by contract or job ID
              </label>
              <input
                id="search-input"
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by contract/job ID"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 hover:border-gray-600"
                aria-label="Search by contract ID"
                aria-describedby="search-help"
              />
              <span id="search-help" className="sr-only">
                Enter a contract or job ID to search for jobs
              </span>
              <button
                type="submit"
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Submit search query"
              >
                Search
              </button>
            </form>

            <div className="flex flex-wrap gap-2 sm:gap-3" role="tablist" aria-label="Filter jobs by role">
              {roleFilterLabels.map((role) => {
                const active = roleFilter === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => {
                      setRoleFilter(role.id);
                      setPage(1);
                    }}
                    role="tab"
                    aria-selected={active}
                    aria-label={`Filter jobs: ${role.label}`}
                    className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 ${
                      active
                        ? "bg-indigo-600 border-indigo-500 text-white focus-visible:ring-indigo-400"
                        : "bg-gray-900 border-gray-700 text-gray-300 hover:text-white hover:border-gray-600 hover:bg-gray-800 active:bg-gray-700 focus-visible:ring-indigo-500"
                    }`}
                  >
                    {role.label}
                  </button>
                );
              })}
            </div>

            {fetchLoading ? (
              <LoadingSkeleton />
            ) : error ? (
              <div
                className="text-center text-red-400 bg-red-950/20 border border-red-800 rounded-lg p-4 animate-shake"
                role="alert"
                aria-live="assertive"
                data-testid="dashboard-error-alert"
              >
                <p className="font-semibold mb-1">Error loading jobs</p>
                <p className="text-sm">{error}</p>
              </div>
            ) : jobs.length === 0 ? (
              <EmptyStateCard
                testId="dashboard-empty-state"
                ariaLabel="No jobs"
                title="No jobs found"
                description="You don't have any jobs yet. Connect your wallet to see jobs you're involved in as a client, freelancer, or arbiter. Create one to get started."
                icon="briefcase"
                badges={["Client", "Freelancer", "Arbiter"]}
              />
            ) : (
              <div className="space-y-3 sm:space-y-5">
                <div className="border border-gray-800 rounded-lg sm:rounded-xl bg-gray-900 overflow-hidden overflow-x-auto" role="region" aria-label="Jobs list">
                  {jobs.map((job, index) => {
                    const isExpanded = expandedJobId === job.id;
                    const roleBadges = [
                      address === job.client ? "Client" : null,
                      address === job.freelancer ? "Freelancer" : null,
                      address === job.arbiter ? "Arbiter" : null,
                    ].filter(Boolean) as string[];

                    return (
                      <div
                        key={job.id}
                        data-testid="dashboard-list-item"
                        className="border-b border-gray-800 last:border-b-0 animate-slide-in"
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                          className="w-full text-left px-3 sm:px-5 py-3 sm:py-4 hover:bg-gray-800/50 transition-all duration-200 active:scale-[0.99] active:bg-gray-800/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                          aria-expanded={isExpanded}
                          aria-label={`Job #${job.id.slice(0, 8)}, ${job.funded ? "Funded" : "Not funded"}, ${isExpanded ? "collapse details" : "expand details"}`}
                          aria-controls={`job-details-${job.id}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm sm:text-base truncate">Job #{job.id.slice(0, 8)}</p>
                              <p className="text-xs text-gray-400 mt-0.5 sm:mt-1">
                                {job.funded ? "Funded" : "Not funded"}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
                              {roleBadges.map((badge) => (
                                <span
                                  key={`${job.id}-${badge}`}
                                  className="text-xs px-2 py-0.5 sm:py-1 rounded-full border border-gray-700 bg-gray-800 text-gray-200 whitespace-nowrap"
                                  role="status"
                                  aria-label={`Your role: ${badge}`}
                                >
                                  {badge}
                                </span>
                              ))}
                              <span className="text-xs text-indigo-300 whitespace-nowrap" aria-hidden="true">
                                {isExpanded ? "Collapse" : "Expand"}
                              </span>
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div
                            data-testid="dashboard-expanded-panel"
                            id={`job-details-${job.id}`}
                            className="px-3 sm:px-5 pb-3 sm:pb-5 space-y-3 sm:space-y-4 border-t border-gray-800/50 animate-fade-in"
                            role="region"
                            aria-label={`Details for job #${job.id.slice(0, 8)}`}
                          >
                            {detailsLoading[job.id] ? (
                              <LoadingSkeleton />
                            ) : !expandedJob ? (
                              <p className="text-xs sm:text-sm text-gray-400" role="status">Unable to load job details.</p>
                            ) : (
                              <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm">
                                  <div className="bg-gray-800 rounded-lg p-2 sm:p-3 min-w-0">
                                    <p className="text-gray-400 text-xs mb-1 font-semibold">Client</p>
                                    <p className="font-mono text-xs break-all" aria-label={`Client address: ${expandedJob.client}`}>{expandedJob.client}</p>
                                  </div>
                                  <div className="bg-gray-800 rounded-lg p-2 sm:p-3 min-w-0">
                                    <p className="text-gray-400 text-xs mb-1 font-semibold">Freelancer</p>
                                    <p className="font-mono text-xs break-all" aria-label={`Freelancer address: ${expandedJob.freelancer}`}>{expandedJob.freelancer}</p>
                                  </div>
                                  <div className="bg-gray-800 rounded-lg p-2 sm:p-3 min-w-0">
                                    <p className="text-gray-400 text-xs mb-1 font-semibold">Arbiter</p>
                                    <p className="font-mono text-xs break-all" aria-label={`Arbiter address: ${expandedJob.arbiter}`}>{expandedJob.arbiter}</p>
                                  </div>
                                  </div>

                                {/* #596: job-level cancel / revoke (client, freelancer). */}
                                {(isClient || isFreelancer) && (
                                  <div
                                    className="mt-3 sm:mt-4 rounded-lg border border-gray-700 bg-gray-800 p-3 sm:p-4"
                                    data-testid="job-cancel-actions"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCancelRole(
                                          address === expandedJob.client
                                            ? "client"
                                            : "freelancer",
                                        );
                                        setCancelModalOpen(true);
                                      }}
                                      disabled={
                                        isPending("cancel-cancel") ||
                                        !address
                                      }
                                      aria-disabled={
                                        isPending("cancel-cancel") || !address
                                      }
                                      data-testid="job-cancel-button"
                                      className="w-full text-xs sm:text-sm px-3 py-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      {expandedJob.cancelPending
                                        ? "Revoke Cancel Approval"
                                        : "Cancel Escrow"}
                                    </button>
                                    <p className="mt-1 text-xs text-gray-500">
                                      {expandedJob.cancelPending
                                        ? "A cancel is pending. Revoking your approval keeps the escrow active."
                                        : "Canceling returns escrowed funds and ends the job. Cannot be undone."}
                                    </p>
                                  </div>
                                )}

                                {/* #817: owed withdraw banner (any wallet with an owed balance). */}
                                {hasOwed && (
                                    <div
                                      className="mt-3 sm:mt-4 rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 sm:p-4"
                                      data-testid="job-owed-banner"
                                    >
                                      <p className="text-xs sm:text-sm text-amber-200 font-semibold mb-1">
                                        You have credits waiting to withdraw
                                      </p>
                                      <p className="text-xs sm:text-sm text-amber-200 mb-3">
                                        {formatBaseUnits(
                                          expandedJob.owedBaseUnits,
                                          {
                                            decimals: expandedJob.tokenDecimals ?? 7,
                                          },
                                        )}{" "}
                                        {expandedJob.tokenSymbol ?? "XLM"}
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() => setWithdrawModalOpen(true)}
                                        disabled={isPending("withdraw") || !address}
                                        aria-disabled={isPending("withdraw") || !address}
                                        data-testid="job-withdraw-button"
                                        className="w-full sm:w-auto text-xs sm:text-sm px-3 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        {isPending("withdraw")
                                          ? "Withdrawing…"
                                          : "Withdraw"}
                                      </button>
                                    </div>
                                  )}

                                {/* #596: admin overrides + pause/resume (admin job view). */}
                                {isAdmin && (
                                  <div
                                    className="mt-3 sm:mt-4 rounded-lg border border-gray-700 bg-gray-800 p-3 sm:p-4"
                                    data-testid="job-admin-actions"
                                  >
                                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAdminOverrideKind("release");
                                          setAdminOverrideMilestoneIndex(null);
                                          setAdminOverrideModalOpen(true);
                                        }}
                                        disabled={isPending("admin-override-release-null")}
                                        data-testid="job-admin-override-release"
                                        className="flex-1 text-xs sm:text-sm px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        Override: Release
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAdminOverrideKind("refund");
                                          setAdminOverrideMilestoneIndex(null);
                                          setAdminOverrideModalOpen(true);
                                        }}
                                        disabled={isPending("admin-override-refund-null")}
                                        data-testid="job-admin-override-refund"
                                        className="flex-1 text-xs sm:text-sm px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        Override: Refund
                                      </button>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                      <button
                                        type="button"
                                        onClick={() => handleAdminPause(false)}
                                        disabled={isPending("admin-pause-false") || !address}
                                        data-testid="job-admin-resume"
                                        className="flex-1 text-xs sm:text-sm px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        Resume Escrow
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleAdminPause(true)}
                                        disabled={isPending("admin-pause-true") || !address}
                                        data-testid="job-admin-pause"
                                        className="flex-1 text-xs sm:text-sm px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
                                      >
                                        Pause Escrow
                                      </button>
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">
                                      Admin override applies to the selected milestone
                                      (choose from a milestone card). Pause/resume
                                      affects the whole contract.
                                    </p>
                                  </div>
                                )}

                                <div className="space-y-3 sm:space-y-4" role="region" aria-label="Milestones">
                                  {showArbiterNoDisputes && (
                                    <ArbiterPanelPlaceholder variant="no-disputes" />
                                  )}
                                  {milestoneList.length > 0 ? (
                                    milestoneList.map((m) => (
                                      <MilestoneCard
                                        key={`${expandedJob.id}-${m.index}`}
                                        milestone={m}
                                        isClient={isClient}
                                        isFreelancer={isFreelancer}
                                        isArbiter={isArbiter}
                                        amountDecimals={expandedJob.tokenDecimals ?? 7}
                                        amountSymbol={expandedJob.tokenSymbol ?? "XLM"}
                                        resolveDisputeState={getState(`resolve-${m.index}`)}
                                        isResolveDisputePending={isPending(`resolve-${m.index}`)}
                                        onResolveDispute={handleResolveDispute}
                                        partialReleaseState={getState(`partial-${m.index}`)}
                                        claimAutoReleaseState={getState(`claim-${m.index}`)}
                                        isPartialReleasePending={isPending(`partial-${m.index}`)}
                                        isClaimAutoReleasePending={isPending(`claim-${m.index}`)}
                                        autoReleaseDeadline={autoReleaseDeadlines[m.index] ?? null}
                                        onPartialRelease={handlePartialRelease}
                                        onClaimAutoRelease={handleClaimAutoRelease}
                                        onMarkDelivered={handleMarkDelivered}
                                        onApprove={handleApprove}
                                        onDispute={handleDispute}
                                        onExtend={handleExtend}
                                        onSplit={handleApplySplit}
                                        onEscalate={handleEscalate}
                                        disputedAtMs={m.disputedAtMs ?? null}
                                        disputeTimeoutMs={m.disputeTimeoutMs ?? null}
                                        onRequestRevision={handleRequestRevision}
                                        revisionCount={m.revisionCount ?? null}
                                      />
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
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <nav className="flex flex-col xs:flex-row items-center justify-between gap-3 overflow-x-auto" aria-label="Pagination navigation">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="w-full xs:w-auto px-3 py-2 rounded-lg border border-gray-700 bg-gray-900 text-xs sm:text-sm transition-all duration-200 hover:bg-gray-800 hover:border-gray-600 active:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-900 disabled:hover:border-gray-700"
                    aria-label={`Previous page, current page is ${page} of ${totalPages}`}
                  >
                    Previous
                  </button>

                  <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto" aria-label="Pagination buttons" role="group">
                    {paginationButtons.map((value) => {
                      const active = value === page;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setPage(value)}
                          aria-current={active ? "page" : undefined}
                          aria-label={active ? `Current page, page ${value}` : `Go to page ${value}`}
                          className={`h-8 min-w-8 px-1.5 sm:px-2 rounded-md text-xs sm:text-sm border whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 ${
                            active
                              ? "bg-indigo-600 border-indigo-500 text-white focus-visible:ring-indigo-400"
                              : "bg-gray-900 border-gray-700 text-gray-200 hover:bg-gray-800 hover:border-gray-600 active:bg-gray-700 focus-visible:ring-indigo-500"
                          }`}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="w-full xs:w-auto px-3 py-2 rounded-lg border border-gray-700 bg-gray-900 text-xs sm:text-sm transition-all duration-200 hover:bg-gray-800 hover:border-gray-600 active:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-900 disabled:hover:border-gray-700"
                    aria-label={`Next page, current page is ${page} of ${totalPages}`}
                  >
                    Next
                  </button>
                </nav>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Dispute Raise Modal */}
      {disputeMilestoneIndex !== null && (
        <DisputeRaiseModal
          isOpen={disputeModalOpen}
          onClose={() => {
            setDisputeModalOpen(false);
            setDisputeMilestoneIndex(null);
          }}
          onSubmit={handleDisputeSubmit}
          milestoneIndex={disputeMilestoneIndex}
          isLoading={isPending(`dispute-${disputeMilestoneIndex}`)}
          submissionError={getState(`dispute-${disputeMilestoneIndex}`)?.error}
        />
      )}

      {/* #596: Cancel / revoke cancel approval modal (job header). */}
      {cancelModalOpen && (
        <CancelRevokeModal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          role={cancelRole}
          cancelPending={expandedJob?.cancelPending ?? false}
          state={getState("cancel-cancel")}
        />
      )}

      {/* #596: Extend deadline modal. */}
      {extendMilestoneIndex !== null && (
        <ExtendDeadlineModal
          isOpen={extendModalOpen}
          onClose={() => {
            setExtendModalOpen(false);
            setExtendMilestoneIndex(null);
            setExtendCurrentSeconds(null);
          }}
          milestoneIndex={extendMilestoneIndex}
          currentExtensionSeconds={extendCurrentSeconds}
          state={getState(`extend-${extendMilestoneIndex}`)}
        />
      )}

      {/* #596: Split resolution modal (arbiter). */}
      {splitMilestoneIndex !== null && (
        <SplitResolutionModal
          isOpen={splitModalOpen}
          onClose={() => {
            setSplitModalOpen(false);
            setSplitMilestoneIndex(null);
          }}
          milestoneIndex={splitMilestoneIndex}
          amount={
            expandedJob?.milestones?.[splitMilestoneIndex]?.amount ?? null
          }
          state={getState(`split-${splitMilestoneIndex}`)}
        />
      )}

      {/* #596: Admin override modal. */}
      {adminOverrideModalOpen && adminOverrideMilestoneIndex !== null && (
        <AdminOverrideModal
          isOpen={adminOverrideModalOpen}
          onClose={() => {
            setAdminOverrideModalOpen(false);
            setAdminOverrideMilestoneIndex(null);
          }}
          milestoneIndex={adminOverrideMilestoneIndex}
          kind={adminOverrideKind}
          state={getState(
            `admin-override-${adminOverrideKind}-${adminOverrideMilestoneIndex}`
          )}
        />
      )}

      {/* #817: Withdraw owed modal. */}
      {withdrawModalOpen && expandedJob && (
        <WithdrawOwedModal
          isOpen={withdrawModalOpen}
          onClose={() => setWithdrawModalOpen(false)}
          owedBaseUnits={expandedJob.owedBaseUnits ?? "0"}
          decimals={expandedJob.tokenDecimals ?? 7}
          symbol={expandedJob.tokenSymbol ?? "XLM"}
          withdrawState={getState("withdraw")}
        />
      )}

      {/* #818: Escalate dispute modal. */}
      {escalateMilestoneIndex !== null && (
        <EscalateDisputeModal
          isOpen={escalateModalOpen}
          onClose={() => {
            setEscalateModalOpen(false);
            setEscalateMilestoneIndex(null);
          }}
          milestoneIndex={escalateMilestoneIndex}
          disputedAtMs={
            expandedJob?.milestones?.[escalateMilestoneIndex]?.disputedAtMs ??
            null
          }
          disputeTimeoutMs={
            expandedJob?.milestones?.[escalateMilestoneIndex]?.disputeTimeoutMs ??
            null
          }
          state={getState(`escalate-${escalateMilestoneIndex}`)}
        />
      )}

      {/* #819: Request revision modal. */}
      {revisionMilestoneIndex !== null && (
        <RequestRevisionModal
          isOpen={revisionModalOpen}
          onClose={() => {
            setRevisionModalOpen(false);
            setRevisionMilestoneIndex(null);
          }}
          milestoneIndex={revisionMilestoneIndex}
          revisionCount={
            expandedJob?.milestones?.[revisionMilestoneIndex]?.revisionCount ??
            null
          }
          state={getState(`revision-${revisionMilestoneIndex}`)}
        />
      )}
    </div>
  );
}
