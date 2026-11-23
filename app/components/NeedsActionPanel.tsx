"use client";

import { useEffect, useState } from "react";
import type { Job } from "@/app/lib/api_schemas";
import { getJobLabel, shortAddress } from "@/app/lib/job_list_summary";
import {
  loadNeedsActions,
  NEEDS_ACTION_LABELS,
  type NeedsActionItem,
} from "@/app/lib/needs_action";
import { relativeTime } from "@/app/components/JobActivityTimeline";

function deadlineText(item: NeedsActionItem, now: number): string | null {
  if (item.deadlineMs === null) return null;
  const when = relativeTime(item.deadlineMs, now);
  const date = new Date(item.deadlineMs).toLocaleString();
  if (item.kind === "review_delivery") {
    return item.deadlineMs <= now
      ? `Review window closed ${when} (${date})`
      : `Auto-releases ${when} (${date})`;
  }
  if (item.kind === "claim_auto_release") return `Claimable since ${date}`;
  return `Due ${when} (${date})`;
}

/**
 * "Needs your action" (#888): one row per pending action for the connected
 * wallet across all of its jobs, earliest deadline first. Selecting a row
 * calls `onSelect` with the job and milestone to open.
 *
 * `refreshKey` reloads the list, e.g. when the dashboard poll sees new
 * activity.
 */
export default function NeedsActionPanel({
  address,
  refreshKey,
  onSelect,
}: {
  address: string;
  refreshKey?: string | number;
  onSelect: (job: Job, milestoneIndex: number | null) => void;
}) {
  const [items, setItems] = useState<NeedsActionItem[]>([]);
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [loadedAt, setLoadedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const now = Date.now();
        const result = await loadNeedsActions(address, {
          signal: controller.signal,
          now: () => now,
        });
        if (controller.signal.aborted) return;
        setItems(result.items);
        setJobs(Object.fromEntries(result.jobs.map((job) => [job.id, job])));
        setLoadedAt(now);
        setError(false);
      } catch {
        if (controller.signal.aborted) return;
        setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [address, refreshKey]);

  return (
    <section
      data-testid="needs-action-panel"
      aria-labelledby="needs-action-heading"
      className="border border-border-strong rounded-lg sm:rounded-xl bg-surface-card px-3 sm:px-5 py-3 sm:py-4 space-y-2 sm:space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="needs-action-heading" className="text-sm sm:text-base font-semibold">
          Needs your action
        </h2>
        {items.length > 0 && (
          <span className="text-xs text-text-muted" data-testid="needs-action-count">
            {items.length} pending
          </span>
        )}
      </div>

      {loading && items.length === 0 ? (
        <p className="text-xs text-text-muted" aria-live="polite">
          Checking your jobs…
        </p>
      ) : error && items.length === 0 ? (
        <p className="text-xs text-text-muted" aria-live="polite">
          Couldn&apos;t check your jobs for pending actions.
        </p>
      ) : items.length === 0 ? (
        <p className="text-xs text-text-muted" data-testid="needs-action-empty">
          Nothing needs your action right now.
        </p>
      ) : (
        <ul className="divide-y divide-border-strong/50">
          {items.map((item) => {
            const job = jobs[item.jobId];
            const jobName = getJobLabel(item.jobId) || shortAddress(item.jobId);
            const action = NEEDS_ACTION_LABELS[item.kind];
            const where =
              item.milestoneIndex === null
                ? jobName
                : `${jobName}, milestone ${item.milestoneIndex + 1}`;
            const due = deadlineText(item, loadedAt);
            return (
              <li
                key={item.key}
                data-testid="needs-action-item"
                className="py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {action}{" "}
                    <span className="text-xs font-normal text-text-muted">as {item.role}</span>
                  </p>
                  <p className="text-xs text-text-disabled truncate">{where}</p>
                  {due && (
                    <p className="text-xs text-warning-soft" data-testid="needs-action-deadline">
                      {due}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!job}
                  onClick={() => job && onSelect(job, item.milestoneIndex)}
                  aria-label={`Open ${action.toLowerCase()}: ${where}`}
                  className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-medium text-text-primary transition-all duration-200 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Open
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
