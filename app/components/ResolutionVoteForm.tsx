"use client";

import { useState } from "react";
import ButtonSpinner from "@/app/components/ButtonSpinner";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";

interface Props {
  /** Whether the current wallet is authorized as an arbiter */
  isAuthorizedArbiter?: boolean;
  /** Whether data is still loading */
  isLoading?: boolean;
  /** Callback when freelancer option is selected */
  onVoteFreelancer?: () => void;
  /** Callback when client option is selected */
  onVoteClient?: () => void;
  /** Whether vote submission is in progress */
  isSubmitting?: boolean;
  /** Error message to display */
  error?: string;
}

/**
 * Fallback screen shown when wallet is not authorized as arbiter.
 * Displays clear warning that only arbiters can use this form.
 */
function UnauthorizedWarning() {
  return (
    <div className="w-full max-w-md mx-auto py-12">
      <div className="bg-danger-soft/10 border border-danger-soft/20 rounded-lg p-6 text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h3 className="font-semibold text-lg mb-2 text-danger-soft">
          Access Restricted
        </h3>
        <p className="text-sm text-text-muted mb-4">
          Only authorized arbiters can access the resolution voting form.
        </p>
        <p className="text-xs text-text-muted/70">
          If you believe you should have access, please contact support.
        </p>
      </div>
    </div>
  );
}

/**
 * Loading skeleton component showing placeholder elements while data loads.
 * Uses structured placeholder wireframes to indicate where form content will appear.
 */
function ResolutionVoteFormSkeleton() {
  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <LoadingSkeleton className="h-7 w-64" />
        <LoadingSkeleton className="h-4 w-full" />
      </div>

      {/* Vote options skeleton */}
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="space-y-2">
            <LoadingSkeleton className="h-12 w-full rounded-lg" />
            <LoadingSkeleton className="h-3 w-48" />
          </div>
        ))}
      </div>

      {/* Button skeleton */}
      <LoadingSkeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

export default function ResolutionVoteForm({
  isAuthorizedArbiter = false,
  isLoading = false,
  onVoteFreelancer,
  onVoteClient,
  isSubmitting = false,
  error,
}: Props) {
  const [selectedVote, setSelectedVote] = useState<"freelancer" | "client" | null>(null);

  // Block rendering for unauthorized wallets
  if (!isAuthorizedArbiter && !isLoading) {
    return <UnauthorizedWarning />;
  }

  // Show loading skeletons while data loads
  if (isLoading) {
    return <ResolutionVoteFormSkeleton />;
  }

  const handleVote = (vote: "freelancer" | "client") => {
    setSelectedVote(vote);
    if (vote === "freelancer" && onVoteFreelancer) {
      onVoteFreelancer();
    } else if (vote === "client" && onVoteClient) {
      onVoteClient();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Form header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Resolution Vote</h2>
        <p className="text-sm text-text-muted">
          Select who should receive the disputed milestone amount.
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-danger-soft/10 border border-danger-soft/20 rounded-lg text-sm text-danger-soft">
          {error}
        </div>
      )}

      {/* Vote options container with grid layout */}
      <div className="grid grid-cols-1 gap-3 mb-6">
        {/* Freelancer option */}
        <button
          onClick={() => handleVote("freelancer")}
          disabled={isSubmitting}
          className={`
            relative p-4 rounded-lg border-2 transition-all text-left
            disabled:opacity-50 disabled:cursor-not-allowed
            ${
              selectedVote === "freelancer"
                ? "border-success-soft bg-success-soft/5"
                : "border-border hover:border-success-soft/50"
            }
          `}
        >
          <div className="flex items-center gap-3">
            <div className="text-2xl">👤</div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Release to Freelancer</h3>
              <p className="text-xs text-text-muted">
                Freelancer's work meets the requirements
              </p>
            </div>
            {selectedVote === "freelancer" && (
              <div className="text-success-soft">✓</div>
            )}
          </div>
        </button>

        {/* Client option */}
        <button
          onClick={() => handleVote("client")}
          disabled={isSubmitting}
          className={`
            relative p-4 rounded-lg border-2 transition-all text-left
            disabled:opacity-50 disabled:cursor-not-allowed
            ${
              selectedVote === "client"
                ? "border-info-soft bg-info-soft/5"
                : "border-border hover:border-info-soft/50"
            }
          `}
        >
          <div className="flex items-center gap-3">
            <div className="text-2xl">💰</div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Refund to Client</h3>
              <p className="text-xs text-text-muted">
                Freelancer's work does not meet requirements
              </p>
            </div>
            {selectedVote === "client" && (
              <div className="text-info-soft">✓</div>
            )}
          </div>
        </button>
      </div>

      {/* Submit button */}
      <button
        disabled={!selectedVote || isSubmitting}
        className={`
          w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all
          flex items-center justify-center gap-2
          ${
            selectedVote && !isSubmitting
              ? "bg-primary hover:bg-primary-dark text-white"
              : "bg-surface-secondary text-text-muted cursor-not-allowed"
          }
        `}
      >
        {isSubmitting && <ButtonSpinner />}
        {isSubmitting ? "Submitting Vote..." : "Submit Vote"}
      </button>

      {/* Info text */}
      <p className="text-xs text-text-muted/70 text-center mt-4">
        This action is permanent and cannot be reversed.
      </p>
    </div>
  );
}
