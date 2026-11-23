"use client";

import { useMemo } from "react";
import type { Job } from "@/app/lib/api_schemas";
import type { JobDetailsPanelProps } from "@/app/components/dashboard/JobDetailsPanel";
import EmptyStateCard from "@/app/components/EmptyStateCard";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";
import NeedsActionPanel from "@/app/components/NeedsActionPanel";
import { Pagination } from "@/app/components/dashboard/Pagination";
import { JobDetailsPanel } from "@/app/components/dashboard/JobDetailsPanel";
import {
  formatLatestActivity,
  formatMilestoneProgress,
  getCounterparty,
  getJobLabel,
  getJobRoles,
  roleLabel,
  shortAddress,
} from "@/app/lib/job_list_summary";
import Link from "next/link";

type RoleFilter = "all" | "client" | "freelancer" | "arbiter";

const LIMIT = 5;

const roleFilterLabels: Array<{ id: RoleFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "client", label: "As Client" },
  { id: "freelancer", label: "As Freelancer" },
  { id: "arbiter", label: "As Arbiter" },
];

export interface JobListProps {
  jobs: Job[];
  total: number;
  page: number;
  setPage: (page: number) => void;
  roleFilter: RoleFilter;
  setRoleFilter: (id: RoleFilter) => void;
  searchInput: string;
  setSearchInput: (value: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  address: string | null;
  expandedJobId: string | null;
  setExpandedJobId: (id: string | null) => void;
  connect: () => void;
  isConnecting: boolean;
  onToggle: (jobId: string, isExpanded: boolean) => void;
  onNeedsActionSelect: (job: Job, milestoneIndex: number | null) => void;
  onSearch: (event: React.FormEvent) => void;
  jobLabels: Record<string, string>;
  isUpdating: (jobId: string) => boolean;
  panel: JobDetailsPanelProps | null;
  fetchLoading: boolean;
  error: string | null;
  refetchJobs: () => void;
  pinnedJob: Job | null;
  setPinnedJob: (job: Job | null) => void;
}

export function JobList({
  jobs,
  total,
  page,
  setPage,
  roleFilter,
  setRoleFilter,
  searchInput,
  setSearchInput,
  searchQuery,
  setSearchQuery,
  address,
  expandedJobId,
  setExpandedJobId,
  connect,
  isConnecting,
  onToggle,
  onNeedsActionSelect,
  onSearch,
  jobLabels,
  isUpdating,
  panel,
  fetchLoading,
  error,
  refetchJobs,
  pinnedJob,
  setPinnedJob,
}: JobListProps) {
  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return jobs.filter((job) => {
      if (roleFilter !== "all" && !getJobRoles(job, address).includes(roleFilter)) return false;
      if (!q) return true;
      const haystack = [job.id, job.client, job.freelancer, job.arbiter, job.tokenSymbol ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [address, jobs, roleFilter, searchQuery]);

  const isFiltering = roleFilter !== "all" || searchQuery.trim().length > 0;
  const displayedJobs = useMemo(() => {
    if (
      !pinnedJob ||
      (roleFilter !== "all" && !getJobRoles(pinnedJob, address).includes(roleFilter)) ||
      filteredJobs.some((job) => job.id === pinnedJob.id)
    ) {
      return filteredJobs;
    }
    return [pinnedJob, ...filteredJobs];
  }, [address, filteredJobs, pinnedJob, roleFilter]);

  const totalPages = Math.max(1, Math.ceil((total || jobs.length || 1) / LIMIT));

  const needsActionRefreshKey = [
    jobs.map((job) => `${job.id}:${job.latestLedger ?? ""}:${job.releasedCount ?? ""}`).join(","),
    expandedJobId ?? "",
  ].join("|");

  if (!address) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <EmptyStateCard
          testId="dashboard-connect-wallet"
          ariaLabel="Connect wallet"
          title="Connect your wallet to view your jobs"
          description="Connect a Stellar wallet to see the escrow jobs you're involved in as a client, freelancer, or arbiter."
          statusTitle
        >
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={() => void connect()}
              disabled={isConnecting}
              className="px-4 py-2 rounded-lg bg-accent text-sm font-medium text-text-primary transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? "Connecting…" : "Connect wallet"}
            </button>
            <Link
              href="/#how-it-works"
              className="text-sm text-accent-soft hover:text-accent-soft-hover underline-offset-2 hover:underline"
            >
              How it works
            </Link>
          </div>
        </EmptyStateCard>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <NeedsActionPanel
        address={address}
        refreshKey={needsActionRefreshKey}
        onSelect={onNeedsActionSelect}
      />

      <form onSubmit={onSearch} className="flex flex-col gap-2 sm:gap-3">
        <label htmlFor="search-input" className="sr-only">
          Search by contract or job ID
        </label>
        <input
          id="search-input"
          type="text"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search by contract/job ID"
          className="w-full bg-surface-card border border-border-subtle rounded-lg px-3 sm:px-4 py-2 text-xs sm:text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page hover:border-border-hover"
          aria-label="Search by contract ID"
          aria-describedby="search-help"
        />
        <span id="search-help" className="sr-only">
          Enter a contract or job ID to search for jobs
        </span>
        <button
          type="submit"
          className="w-full sm:w-auto bg-accent hover:bg-accent-hover active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Submit search query"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2 sm:gap-3" role="group" aria-label="Filter jobs by role">
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
              aria-label={`Filter jobs: ${role.label}`}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page ${
                active
                  ? "bg-accent border-accent-soft text-text-primary focus-visible:ring-accent-soft"
                  : "bg-surface-card border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-hover hover:bg-surface-field active:bg-surface-raised focus-visible:ring-accent-soft"
              }`}
            >
              {role.label}
            </button>
          );
        })}
      </div>

      {fetchLoading && !error ? (
        <LoadingSkeleton />
      ) : error ? (
        <EmptyStateCard
          testId="dashboard-error-alert"
          ariaLabel="Error loading jobs"
          title="Error loading jobs"
          description={error}
          icon="briefcase"
          className="border-red-800 bg-red-950/20 animate-shake"
          action={
            <button
              type="button"
              onClick={() => void refetchJobs()}
              disabled={fetchLoading}
              data-testid="dashboard-retry-button"
              aria-label="Retry loading jobs"
              className="bg-accent hover:bg-accent-hover active:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {fetchLoading ? "Retrying…" : "Retry"}
            </button>
          }
        />
      ) : jobs.length === 0 && !pinnedJob ? (
        <EmptyStateCard
          testId="dashboard-empty-state"
          ariaLabel="No jobs"
          title="No jobs found"
          description="You don't have any jobs yet. Connect your wallet to see jobs you're involved in as a client, freelancer, or arbiter. Create one to get started."
          icon="briefcase"
          badges={["Client", "Freelancer", "Arbiter"]}
        />
      ) : displayedJobs.length === 0 ? (
        <EmptyStateCard
          testId="dashboard-filter-empty-state"
          ariaLabel="No matching jobs"
          title="No matching jobs"
          description="No jobs on this page match the selected filters. Try a different role or search."
          icon="briefcase"
        />
      ) : (
        <div className="space-y-3 sm:space-y-5">
          {isFiltering && (
            <p data-testid="dashboard-filter-hint" className="text-xs text-text-muted" role="status" aria-live="polite">
              Showing {filteredJobs.length} of {jobs.length} jobs on this page
            </p>
          )}
          <div className="border border-border-strong rounded-lg sm:rounded-xl bg-surface-card overflow-hidden overflow-x-auto" role="region" aria-label="Jobs list">
            {displayedJobs.map((job) => {
              const isExpanded = expandedJobId === job.id;
              const roles = getJobRoles(job, address);
              const roleBadges = roles.map(roleLabel);
              const counterparty = getCounterparty(job, roles);
              const progress = formatMilestoneProgress(job);
              const activity = formatLatestActivity(job);
              const label = jobLabels[job.id] ?? getJobLabel(job.id);

              return (
                <div key={job.id} data-testid="dashboard-list-item" className="border-b border-border-strong last:border-b-0 animate-slide-in">
                  <button
                    type="button"
                    onClick={() => onToggle(job.id, isExpanded)}
                    className="w-full text-left px-3 sm:px-5 py-3 sm:py-4 hover:bg-surface-field/50 transition-all duration-200 active:scale-[0.99] active:bg-surface-field/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-soft"
                    aria-expanded={isExpanded}
                    aria-label={`Job #${job.id.slice(0, 8)}, ${job.funded ? "Funded" : "Not funded"}, ${isExpanded ? "collapse details" : "expand details"}`}
                    aria-controls={`job-details-${job.id}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm sm:text-base truncate">
                          {label || `Job #${job.id.slice(0, 8)}`}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5 sm:mt-1">
                          {job.funded ? "Funded" : "Not funded"}
                        </p>
                        <p className="text-xs text-text-disabled mt-0.5" data-testid="job-row-summary">
                          {[counterparty ? `with ${shortAddress(counterparty)}` : null, progress, activity]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
                        {isUpdating(job.id) && (
                          <span
                            data-testid="updating-badge"
                            className="text-xs px-2 py-0.5 sm:py-1 rounded-full border border-yellow-600 bg-yellow-900/40 text-yellow-300 whitespace-nowrap animate-pulse"
                            role="status"
                            aria-live="polite"
                            aria-label="Updating job status"
                          >
                            Updating…
                          </span>
                        )}
                        {roleBadges.map((badge) => (
                          <span
                            key={`${job.id}-${badge}`}
                            className="text-xs px-2 py-0.5 sm:py-1 rounded-full border border-border-subtle bg-surface-field text-text-secondary whitespace-nowrap"
                            role="status"
                            aria-label={`Your role: ${badge}`}
                          >
                            {badge}
                          </span>
                        ))}
                        <span className="text-xs text-accent-soft-hover whitespace-nowrap" aria-hidden="true">
                          {isExpanded ? "Collapse" : "Expand"}
                        </span>
                      </div>
                    </div>
                  </button>
                  {isExpanded && panel && <JobDetailsPanel {...panel} />}
                </div>
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
