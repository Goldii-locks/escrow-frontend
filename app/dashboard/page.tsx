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

interface Milestone {
  index: number;
  amount: string;
  status: string;
  releasedAmount?: string;
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
      ? (item.milestones as Milestone[])
      : undefined,
    token: typeof item.token === "string" ? item.token : undefined,
    tokenSymbol: typeof item.tokenSymbol === "string" ? item.tokenSymbol : undefined,
    tokenDecimals:
      typeof item.tokenDecimals === "number" && Number.isFinite(item.tokenDecimals)
        ? item.tokenDecimals
        : undefined,
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

  const isClient = !!(expandedJob && address === expandedJob.client);
  const isFreelancer = !!(expandedJob && address === expandedJob.freelancer);
  const isArbiter = !!(expandedJob && address === expandedJob.arbiter);
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
    </div>
  );
}
