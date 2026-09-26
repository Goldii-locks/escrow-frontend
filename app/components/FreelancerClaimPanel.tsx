"use client";

import LoadingSkeleton from "@/app/components/LoadingSkeleton";

export interface FreelancerClaimPanelProps {
  /** Job ID for the claim panel. */
  jobId?: string;
  /** Whether data is currently loading. */
  isLoading?: boolean;
  /** Claim action handler. */
  onClaim?: () => void;
  /** Pending state for claim action. */
  isClaimPending?: boolean;
  /** Claimable amount display string. */
  claimableAmount?: string;
  className?: string;
}

/**
 * Freelancer payout trigger view.
 * Displays structured wireframe placeholder loading skeletons while loading data.
 */
export default function FreelancerClaimPanel({
  jobId,
  isLoading = false,
  onClaim,
  isClaimPending = false,
  claimableAmount = "0.00 USDC",
  className = "",
}: FreelancerClaimPanelProps) {
  if (isLoading) {
    return (
      <div
        data-testid="freelancer-claim-panel-loading"
        aria-busy="true"
        aria-label="Loading freelancer claim panel"
        className={`space-y-4 ${className}`}
      >
        <LoadingSkeleton data-testid="freelancer-claim-skeleton" />
      </div>
    );
  }

  return (
    <div
      data-testid="freelancer-claim-panel"
      className={`rounded-xl border border-border-subtle bg-surface-card p-6 space-y-4 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            Freelancer Payout Claim
          </h3>
          {jobId && (
            <p className="text-xs text-text-secondary font-mono mt-1">
              Job ID: {jobId}
            </p>
          )}
        </div>
        <div className="text-right">
          <span className="text-xs uppercase tracking-wide text-text-secondary block">
            Available to Claim
          </span>
          <span className="text-lg font-bold text-text-primary">
            {claimableAmount}
          </span>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={onClaim}
          disabled={isClaimPending}
          data-testid="freelancer-claim-button"
          className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition"
        >
          {isClaimPending ? "Claiming Payout..." : "Claim Payout"}
        </button>
      </div>
    </div>
  );
}
