"use client";

import Link from "next/link";
import EmptyStateCard from "@/app/components/EmptyStateCard";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";
import { formatAddress } from "@/app/components/WalletBadge";
import { formatBaseUnits } from "@/app/lib/amounts";
import {
  formatTimeUntilEscalation,
  getArbiterQueueEmptyState,
  type ArbiterDisputeEntry,
} from "@/app/lib/arbiter_dispute_queue";

export interface ArbiterDisputeQueueProps {
  entries: ArbiterDisputeEntry[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

/** Formats an epoch-ms timestamp as a stable, readable UTC string. */
function formatUtc(timestamp: number): string {
  return `${new Date(timestamp).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** Urgency styling for the escalation countdown. */
function urgencyClasses(ms: number | null): string {
  if (ms === null) return "text-text-muted border-border-subtle bg-surface-field";
  if (ms <= 0) return "text-danger-soft border-danger/40 bg-danger/10";
  if (ms <= 24 * 60 * 60 * 1000) {
    return "text-warning-soft border-warning/40 bg-warning/10";
  }
  return "text-text-secondary border-border-subtle bg-surface-field";
}

/**
 * Arbiter-centred queue of every disputed milestone awaiting a decision,
 * sorted by escalation deadline (Issue #881). Each row links to the job on
 * the dashboard, where the arbiter action panel resolves the dispute.
 */
export default function ArbiterDisputeQueue({
  entries,
  loading = false,
  error = null,
  onRefresh,
}: ArbiterDisputeQueueProps) {
  if (loading) {
    return (
      <div data-testid="arbiter-queue-loading">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="arbiter-queue-error"
        role="alert"
        className="border border-danger/40 bg-danger/10 text-danger-soft rounded-lg p-4 text-sm flex items-center justify-between gap-3"
      >
        <span>{error}</span>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="shrink-0 px-3 py-1.5 rounded-lg border border-danger/40 text-sm hover:bg-danger/20 transition"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (entries.length === 0) {
    const empty = getArbiterQueueEmptyState();
    return (
      <EmptyStateCard
        testId="arbiter-queue-empty"
        ariaLabel="No disputes awaiting arbitration"
        title={empty.title}
        description={empty.description}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p
          data-testid="arbiter-queue-count"
          className="text-sm text-text-secondary"
          role="status"
        >
          {entries.length} dispute{entries.length === 1 ? "" : "s"} awaiting your
          decision, most urgent first
        </p>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            data-testid="arbiter-queue-refresh"
            className="text-sm px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-card text-text-secondary hover:text-text-primary transition"
          >
            Refresh
          </button>
        )}
      </div>

      <ul
        data-testid="arbiter-queue-list"
        aria-label="Disputes awaiting arbitration, sorted by escalation deadline"
        className="space-y-3"
      >
        {entries.map((entry) => (
          <li
            key={`${entry.jobId}-${entry.milestoneIndex}`}
            data-testid="arbiter-queue-item"
            data-job-id={entry.jobId}
            data-milestone-index={entry.milestoneIndex}
            className="border border-border-subtle rounded-lg bg-surface-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-semibold text-text-primary">
                Milestone {entry.milestoneIndex + 1}
                <span className="ml-2 font-mono text-xs text-text-muted break-all">
                  {entry.jobId}
                </span>
              </p>
              <p className="text-xs text-text-secondary">
                <span data-testid="arbiter-queue-amount" className="font-mono">
                  {formatBaseUnits(entry.amount, { decimals: entry.tokenDecimals })}{" "}
                  {entry.tokenSymbol}
                </span>
                {" · Raised by "}
                {entry.raisedBy ? (
                  <span className="font-mono">{formatAddress(entry.raisedBy)}</span>
                ) : (
                  <span>unknown party</span>
                )}
                {entry.raisedAt !== null && (
                  <>
                    {" on "}
                    <time dateTime={new Date(entry.raisedAt).toISOString()}>
                      {formatUtc(entry.raisedAt)}
                    </time>
                  </>
                )}
              </p>
            </div>

            <span
              data-testid="arbiter-queue-deadline"
              className={`shrink-0 inline-flex items-center text-xs font-medium px-2 py-1 rounded-full border ${urgencyClasses(entry.msUntilEscalation)}`}
              aria-label={`Time until escalation: ${formatTimeUntilEscalation(entry.msUntilEscalation)}`}
            >
              {formatTimeUntilEscalation(entry.msUntilEscalation)}
            </span>

            <Link
              href={`/dashboard?contractId=${encodeURIComponent(entry.jobId)}`}
              data-testid="arbiter-queue-link"
              className="shrink-0 text-sm px-3 py-2 rounded-lg bg-accent text-text-primary hover:bg-accent-hover transition text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
              aria-label={`View dispute for milestone ${entry.milestoneIndex + 1} of job ${entry.jobId}`}
            >
              View dispute
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}