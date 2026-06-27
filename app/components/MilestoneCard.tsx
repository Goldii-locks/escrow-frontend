"use client";

import { useState } from "react";
import ButtonSpinner from "@/app/components/ButtonSpinner";
import TxStatusBanner from "@/app/components/TxStatusBanner";
import { ActionState } from "@/app/hooks/useActionStates";
import { getPhaseLabel } from "@/app/lib/transactions";

interface Milestone {
  index: number;
  amount: string;
  status: string;
  releasedAmount?: string;
}

interface Props {
  milestone?: Milestone | null;
  isClient: boolean;
  isFreelancer: boolean;
  partialReleaseState: ActionState;
  claimAutoReleaseState: ActionState;
  isPartialReleasePending: boolean;
  isClaimAutoReleasePending: boolean;
  onPartialRelease?: (index: number, amount: string) => void;
  onClaimAutoRelease?: (index: number) => void;
  onMarkDelivered?: (i: number) => void;
  onApprove?: (i: number) => void;
  onDispute?: (i: number) => void;
}

const statusColor: Record<string, string> = {
  Pending: "bg-warning-soft/10 text-warning-soft border-warning-soft/20",
  Delivered: "bg-info-soft/10 text-info-soft border-info-soft/20",
  Released: "bg-success-soft/10 text-success-soft border-success-soft/20",
  Disputed: "bg-danger-soft/10 text-danger-soft border-danger-soft/20",
  Refunded: "bg-text-muted/10 text-text-muted border-text-muted/20",
};

/** Human-readable milestone number (1-indexed). */
function milestoneLabel(index: number) {
  return `Milestone ${index + 1}`;
}

export default function MilestoneCard({
  milestone,
  isClient,
  isFreelancer,
  partialReleaseState,
  claimAutoReleaseState,
  isPartialReleasePending,
  isClaimAutoReleasePending,
  onPartialRelease,
  onClaimAutoRelease,
  onMarkDelivered,
  onApprove,
  onDispute,
}: Props) {
  if (
    !milestone ||
    typeof milestone.index !== "number" ||
    typeof milestone.amount !== "string" ||
    typeof milestone.status !== "string"
  ) {
    return (
      <div
        data-testid="milestone-empty-state"
        className="border border-border-strong rounded-lg p-4 bg-surface-card flex flex-col gap-2"
      >
        <p className="text-sm font-semibold text-text-secondary">No milestones available</p>
        <p className="text-xs text-text-muted">Add milestones in the create job form to begin tracking work and releases.</p>
        <p className="text-xs text-accent-soft">Next step: create a job with at least one milestone amount.</p>
      </div>
    );
  }

  return (
    <div
      data-testid="milestone-card"
      className="
        border border-border-strong rounded-lg p-4 bg-surface-card
        flex flex-col gap-3
        sm:flex-row sm:items-center sm:justify-between sm:gap-4
      "
    >
      {/* Milestone info */}
      <div className="min-w-0">
        <p className="text-sm text-text-muted">Milestone {milestone.index + 1}</p>
        <p className="font-mono text-text-primary text-sm mt-1 truncate">
          {milestone.amount} stroops
        </p>
      </div>

      {/* ── Right: status badge + action buttons ─────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap justify-end">
        {/*
         * role="status" – live region so assistive technologies announce
         * status changes without requiring focus.
         * aria-label on the <span> gives context beyond the bare word.
         */}
        <span
          className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap ${
            statusColor[milestone.status] ?? "bg-surface-field text-text-muted border-border-subtle"
          }`}
        >
          {milestone.status}
        </span>

        {canMarkDelivered && (
          <button
            type="button"
            onClick={() => onMarkDelivered?.(milestone.index)}
            className="text-xs bg-info-soft hover:opacity-90 text-text-primary px-3 py-1.5 rounded-lg transition whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
          >
            Mark Delivered
          </button>
        )}

        {canApprove && (
          <button
            type="button"
            onClick={() => onApprove?.(milestone.index)}
            className="text-xs bg-success hover:opacity-90 text-text-primary px-3 py-1.5 rounded-lg transition whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
          >
            Approve
          </button>
        )}

        {(isClient || isFreelancer) &&
          ["Pending", "Delivered"].includes(milestone.status) && (
            <button
              onClick={() => onDispute?.(milestone.index)}
              className="text-xs bg-danger hover:opacity-90 text-text-primary px-3 py-1.5 rounded-lg transition whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
            >
              Dispute
            </button>
          )}
      </div>
    </article>
  );
}
