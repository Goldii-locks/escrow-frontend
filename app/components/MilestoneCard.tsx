"use client";

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

const baseBtn =
  "text-xs px-3 py-1.5 rounded-lg transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:opacity-40 disabled:cursor-not-allowed";

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
        transition-all duration-200
        hover:border-accent-soft/40 hover:bg-surface-card/80
        focus-within:outline-none focus-within:ring-2 focus-within:ring-accent-soft focus-within:ring-offset-2 focus-within:ring-offset-surface-page
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
          className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap transition-colors ${
            statusColor[milestone.status] ?? "bg-surface-field text-text-muted border-border-subtle"
          }`}
        >
          {milestone.status}
        </span>

        {isFreelancer && milestone.status === "Pending" && (
          <button
            onClick={() => onMarkDelivered?.(milestone.index)}
            disabled={!onMarkDelivered}
            className={`${baseBtn} bg-info-soft text-text-primary hover:bg-info-soft/80 active:scale-[0.97] focus-visible:ring-info-soft disabled:hover:bg-info-soft disabled:active:scale-100`}
          >
            Mark Delivered
          </button>
        )}

        {isClient && milestone.status === "Delivered" && (
          <button
            onClick={() => onApprove?.(milestone.index)}
            disabled={!onApprove}
            className={`${baseBtn} bg-success text-text-primary hover:bg-success/80 active:scale-[0.97] focus-visible:ring-success-soft disabled:hover:bg-success disabled:active:scale-100`}
          >
            Approve
          </button>
        )}

        {(isClient || isFreelancer) &&
          ["Pending", "Delivered"].includes(milestone.status) && (
            <button
              onClick={() => onDispute?.(milestone.index)}
              disabled={!onDispute}
              className={`${baseBtn} bg-danger text-text-primary hover:bg-danger/80 active:scale-[0.97] focus-visible:ring-danger-soft disabled:hover:bg-danger disabled:active:scale-100`}
            >
              Dispute
            </button>
          )}
      </div>
    </div>
  );
}
