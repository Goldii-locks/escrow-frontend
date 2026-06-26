"use client";

import { useEffect, useState } from "react";

interface Milestone {
    index: number;
    amount: string;
    status: string;
}

interface Props {
  milestone?: Milestone | null;
  isClient: boolean;
  isFreelancer: boolean;
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

export default function MilestoneCard({
    milestone,
    isClient,
    isFreelancer,
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

      {/* Status badge + action buttons */}
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
        <span
          className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap ${
            statusColor[milestone.status] ?? "bg-surface-field text-text-muted border-border-subtle"
          }`}
        >
            <style jsx global>{`
                @keyframes milestonePulse {
                    0%,
                    100% {
                        transform: translateY(0);
                        box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
                    }
                    50% {
                        transform: translateY(-1px);
                        box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.06);
                    }
                }
                @keyframes milestoneCelebrate {
                    0% {
                        transform: scale(0.97);
                        opacity: 0.75;
                    }
                    100% {
                        transform: scale(1);
                        opacity: 1;
                    }
                }
                @keyframes milestoneSoftPop {
                    0% {
                        transform: scale(0.985);
                    }
                    100% {
                        transform: scale(1);
                    }
                }
                @keyframes milestoneShake {
                    0%,
                    100% {
                        transform: translateX(0);
                    }
                    25% {
                        transform: translateX(-2px);
                    }
                    75% {
                        transform: translateX(2px);
                    }
                }
                @keyframes milestoneFade {
                    0% {
                        opacity: 0.75;
                        transform: translateY(2px);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes milestoneClick {
                    0% {
                        transform: scale(1);
                    }
                    45% {
                        transform: scale(1.012);
                    }
                    100% {
                        transform: scale(1);
                    }
                }
            `}</style>

            <div className="min-w-0 transition-transform duration-300 ease-out group-hover:translate-x-1">
                <p className="text-sm text-gray-400">
                    Milestone {milestone.index + 1}
                </p>
                <p className="font-mono text-white text-sm mt-1 truncate">
                    {milestone.amount} stroops
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
                <span
                    data-testid="milestone-status"
                    className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap transition-all duration-300 ease-out ${statusColor[milestone.status] ?? "bg-gray-800 text-gray-400"} ${motion}`}
                >
                    {milestone.status}
                </span>

        {isFreelancer && milestone.status === "Pending" && (
          <button
            onClick={() => onMarkDelivered?.(milestone.index)}
            className="text-xs bg-info-soft hover:opacity-90 text-text-primary px-3 py-1.5 rounded-lg transition whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
          >
            Mark Delivered
          </button>
        )}

        {isClient && milestone.status === "Delivered" && (
          <button
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
    </div>
  );
}
