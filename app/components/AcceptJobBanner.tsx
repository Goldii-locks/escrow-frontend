"use client";

/**
 * AcceptJobBanner — shown on the job detail view when the freelancer or
 * arbiter (or both) have not yet accepted the job. Each party sees only their
 * own call to action; the client sees read-only status of both parties.
 *
 * "Mark delivered" and "Raise dispute" are blocked until both have accepted.
 */

import ButtonSpinner from "@/app/components/ButtonSpinner";
import TxStatusBanner from "@/app/components/TxStatusBanner";
import type { ActionState } from "@/app/hooks/useActionStates";

interface Props {
  /** Whether the freelancer has accepted. `undefined` = backend doesn't expose the field yet (treat as accepted). */
  freelancerAccepted?: boolean;
  /** Whether the arbiter has accepted. `undefined` = treated as accepted. */
  arbiterAccepted?: boolean;
  /** True when the connected wallet belongs to the freelancer. */
  isFreelancer: boolean;
  /** True when the connected wallet belongs to the arbiter. */
  isArbiter: boolean;
  /** Accept-job transaction state (freelancer's action). */
  acceptJobState?: ActionState;
  /** Accept-arbiter transaction state (arbiter's action). */
  acceptArbiterState?: ActionState;
  /** Whether the accept_job tx is pending. */
  isAcceptJobPending?: boolean;
  /** Whether the accept_arbiter tx is pending. */
  isAcceptArbiterPending?: boolean;
  onAcceptJob?: () => void;
  onAcceptArbiter?: () => void;
  /** When true the escrow is locked; buttons are disabled. */
  escrowLocked?: boolean;
  lockTooltip?: string;
}

export default function AcceptJobBanner({
  freelancerAccepted,
  arbiterAccepted,
  isFreelancer,
  isArbiter,
  acceptJobState,
  acceptArbiterState,
  isAcceptJobPending,
  isAcceptArbiterPending,
  onAcceptJob,
  onAcceptArbiter,
  escrowLocked,
  lockTooltip,
}: Props) {
  // If both are accepted (or the backend doesn't expose the fields), render nothing.
  const freelancerDone = freelancerAccepted !== false;
  const arbiterDone = arbiterAccepted !== false;

  if (freelancerDone && arbiterDone) return null;

  return (
    <div
      data-testid="accept-job-banner"
      className="rounded-lg border border-warning/60 bg-warning/10 px-4 py-4 space-y-3"
      role="status"
      aria-label="Job acceptance required"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-warning text-base" aria-hidden="true">⚠</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary">Job acceptance required</p>
          <p className="text-xs text-text-muted mt-0.5">
            Both the freelancer and arbiter must accept before work can begin.
            &ldquo;Mark delivered&rdquo; and &ldquo;Raise dispute&rdquo; are disabled until both have accepted.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {/* Freelancer acceptance row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              data-testid="freelancer-acceptance-status"
              className={freelancerDone ? "text-success text-sm" : "text-warning text-sm"}
              aria-label={freelancerDone ? "Freelancer accepted" : "Freelancer has not accepted"}
            >
              {freelancerDone ? "✓" : "○"}
            </span>
            <span className="text-xs text-text-secondary">Freelancer acceptance</span>
          </div>
          {!freelancerDone && isFreelancer && (
            <div className="flex flex-col items-end gap-1 min-w-0">
              <button
                data-testid="accept-job-button"
                type="button"
                disabled={!!isAcceptJobPending || !!escrowLocked}
                title={escrowLocked ? lockTooltip : undefined}
                onClick={onAcceptJob}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-medium text-white transition-all duration-200 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isAcceptJobPending && <ButtonSpinner className="h-3 w-3" />}
                {isAcceptJobPending ? "Accepting…" : "Accept job"}
              </button>
              {acceptJobState && <TxStatusBanner state={acceptJobState} />}
            </div>
          )}
          {!freelancerDone && !isFreelancer && (
            <span className="text-xs text-text-muted italic">Waiting for freelancer</span>
          )}
        </div>

        {/* Arbiter acceptance row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              data-testid="arbiter-acceptance-status"
              className={arbiterDone ? "text-success text-sm" : "text-warning text-sm"}
              aria-label={arbiterDone ? "Arbiter accepted" : "Arbiter has not accepted"}
            >
              {arbiterDone ? "✓" : "○"}
            </span>
            <span className="text-xs text-text-secondary">Arbiter acceptance</span>
          </div>
          {!arbiterDone && isArbiter && (
            <div className="flex flex-col items-end gap-1 min-w-0">
              <button
                data-testid="accept-arbiter-button"
                type="button"
                disabled={!!isAcceptArbiterPending || !!escrowLocked}
                title={escrowLocked ? lockTooltip : undefined}
                onClick={onAcceptArbiter}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-medium text-white transition-all duration-200 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isAcceptArbiterPending && <ButtonSpinner className="h-3 w-3" />}
                {isAcceptArbiterPending ? "Accepting…" : "Accept as arbiter"}
              </button>
              {acceptArbiterState && <TxStatusBanner state={acceptArbiterState} />}
            </div>
          )}
          {!arbiterDone && !isArbiter && (
            <span className="text-xs text-text-muted italic">Waiting for arbiter</span>
          )}
        </div>
      </div>
    </div>
  );
}
