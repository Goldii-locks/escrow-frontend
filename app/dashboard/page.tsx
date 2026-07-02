"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useWallet } from "@/app/context/WalletContext";
import Navbar from "@/app/components/Navbar";
import MilestoneCard from "@/app/components/MilestoneCard";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";
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

  const expandedJob = expandedJobId ? jobDetails[expandedJobId] ?? null : null;
  const milestoneList = Array.isArray(expandedJob?.milestones)
    ? expandedJob.milestones
    : [];

  const isClient = !!(expandedJob && address === expandedJob.client);
  const isFreelancer = !!(expandedJob && address === expandedJob.freelancer);
  const isArbiter = !!(expandedJob && address === expandedJob.arbiter);

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

  const handleDispute = async (i: number) => {
    showToast(`Dispute milestone ${i + 1} (wired to contract soon)`, "info");
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
      <main className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-6">Job Dashboard</h1>

        {!address ? (
          <p className="text-center text-gray-400">Connect your wallet to view your jobs</p>
        ) : (
          <div className="space-y-6">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by contract/job ID"
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm"
                aria-label="Search by contract ID"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-sm font-medium"
              >
                Search
              </button>
            </form>

            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Role filters">
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
                    aria-pressed={active}
                    className={`px-3 py-1.5 rounded-full text-sm border transition ${
                      active
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-gray-900 border-gray-700 text-gray-300 hover:text-white"
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
              <div className="text-center text-red-400" role="alert">
                Error: {error}
              </div>
            ) : jobs.length === 0 ? (
              <p className="text-center text-gray-400">No jobs found for this wallet</p>
            ) : (
              <div className="space-y-5">
                <div className="border border-gray-800 rounded-xl bg-gray-900 overflow-hidden">
                  {jobs.map((job) => {
                    const isExpanded = expandedJobId === job.id;
                    const roleBadges = [
                      address === job.client ? "Client" : null,
                      address === job.freelancer ? "Freelancer" : null,
                      address === job.arbiter ? "Arbiter" : null,
                    ].filter(Boolean) as string[];

                    return (
                      <div key={job.id} className="border-b border-gray-800 last:border-b-0">
                        <button
                          type="button"
                          onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                          className="w-full text-left px-5 py-4 hover:bg-gray-800/50 transition"
                          aria-expanded={isExpanded}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-semibold">Job #{job.id.slice(0, 8)}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {job.funded ? "Funded" : "Not funded"}
                              </p>
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                              {roleBadges.map((badge) => (
                                <span
                                  key={`${job.id}-${badge}`}
                                  className="text-xs px-2 py-1 rounded-full border border-gray-700 bg-gray-800 text-gray-200"
                                >
                                  {badge}
                                </span>
                              ))}
                              <span className="text-xs text-indigo-300">
                                {isExpanded ? "Collapse" : "Expand"}
                              </span>
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-5 pb-5 space-y-4">
                            {detailsLoading[job.id] ? (
                              <LoadingSkeleton />
                            ) : !expandedJob ? (
                              <p className="text-sm text-gray-400">Unable to load job details.</p>
                            ) : (
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                  <div className="bg-gray-800 rounded-lg p-3 min-w-0">
                                    <p className="text-gray-400">Client</p>
                                    <p className="font-mono text-xs break-all">{expandedJob.client}</p>
                                  </div>
                                  <div className="bg-gray-800 rounded-lg p-3 min-w-0">
                                    <p className="text-gray-400">Freelancer</p>
                                    <p className="font-mono text-xs break-all">{expandedJob.freelancer}</p>
                                  </div>
                                  <div className="bg-gray-800 rounded-lg p-3 min-w-0">
                                    <p className="text-gray-400">Arbiter</p>
                                    <p className="font-mono text-xs break-all">{expandedJob.arbiter}</p>
                                  </div>
                                </div>

                                <div className="space-y-4">
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

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-2 rounded-lg border border-gray-700 bg-gray-900 text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>

                  <div className="flex items-center gap-2" aria-label="Pagination">
                    {paginationButtons.map((value) => {
                      const active = value === page;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setPage(value)}
                          aria-current={active ? "page" : undefined}
                          className={`h-8 min-w-8 px-2 rounded-md text-sm border ${
                            active
                              ? "bg-indigo-600 border-indigo-500"
                              : "bg-gray-900 border-gray-700"
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
                    className="px-3 py-2 rounded-lg border border-gray-700 bg-gray-900 text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
