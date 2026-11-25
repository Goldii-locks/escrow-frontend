"use client";

import {
  acceptanceBlockedMessage,
  isJobAccepted,
  type JobAcceptance,
} from "@/app/lib/job_acceptance";

const baseBtn =
  "text-xs px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:opacity-40 disabled:cursor-not-allowed";

function AcceptanceStatus({
  label,
  accepted,
  testId,
}: {
  label: string;
  accepted: boolean;
  testId: string;
}) {
  return (
    <li className="flex items-center gap-2 text-xs" data-testid={testId}>
      <span
        aria-hidden="true"
        className={`inline-block h-2 w-2 rounded-full ${
          accepted ? "bg-success-soft" : "bg-warning-soft"
        }`}
      />
      <span className="text-text-secondary">{label}</span>
      <span className={accepted ? "text-success-soft" : "text-warning-soft"}>
        {accepted ? "Accepted" : "Waiting"}
      </span>
    </li>
  );
}

/**
 * Job acceptance (#802): shows which of the freelancer and arbiter have
 * accepted the job, and offers the viewer's own missing acceptance.
 *
 * The contract blocks `mark_delivered`, `raise_dispute` and `resolve_dispute`
 * with `NotAccepted` until both have accepted, so this panel also explains
 * why those actions are disabled on the milestone cards.
 */
export default function JobAcceptancePanel({
  acceptance,
  loading = false,
  isFreelancer,
  isArbiter,
  onAcceptJob,
  onAcceptArbiter,
  isAcceptJobPending = false,
  isAcceptArbiterPending = false,
  acceptJobError,
  acceptArbiterError,
}: {
  /** `null` when the acceptance state could not be read. */
  acceptance: JobAcceptance | null;
  loading?: boolean;
  isFreelancer: boolean;
  isArbiter: boolean;
  onAcceptJob?: () => void;
  onAcceptArbiter?: () => void;
  isAcceptJobPending?: boolean;
  isAcceptArbiterPending?: boolean;
  acceptJobError?: string | null;
  acceptArbiterError?: string | null;
}) {
  const fullyAccepted = isJobAccepted(acceptance);
  // Unknown state still offers acceptance: the contract itself rejects a
  // duplicate, and hiding the button would strand a genuinely new job when
  // the history read fails.
  const canAcceptJob = isFreelancer && !acceptance?.freelancerAccepted;
  const canAcceptArbiter = isArbiter && !acceptance?.arbiterAccepted;
  const waitingMessage = acceptance ? acceptanceBlockedMessage(acceptance) : null;

  return (
    <section
      data-testid="job-acceptance-panel"
      aria-labelledby="job-acceptance-heading"
      className="rounded-lg border border-border-subtle bg-surface-field px-3 py-2.5 sm:px-4 sm:py-3 space-y-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="job-acceptance-heading" className="text-sm font-semibold">
          Job acceptance
        </h3>
        {fullyAccepted && (
          <span
            data-testid="job-acceptance-complete"
            className="text-xs text-success-soft"
            role="status"
          >
            Both parties accepted
          </span>
        )}
      </div>

      {loading && !acceptance ? (
        <p className="text-xs text-text-muted" role="status">
          Checking acceptance…
        </p>
      ) : !acceptance ? (
        <p className="text-xs text-warning-soft" role="status" data-testid="job-acceptance-unknown">
          Couldn&apos;t read the acceptance state. You can still accept: the contract rejects a
          second acceptance.
        </p>
      ) : (
        <>
          <ul className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-5">
            <AcceptanceStatus
              label="Freelancer"
              accepted={acceptance.freelancerAccepted}
              testId="job-acceptance-freelancer"
            />
            <AcceptanceStatus
              label="Arbiter"
              accepted={acceptance.arbiterAccepted}
              testId="job-acceptance-arbiter"
            />
          </ul>
          {waitingMessage && (
            <p
              className="text-xs text-warning-soft"
              role="status"
              data-testid="job-acceptance-waiting"
            >
              {waitingMessage} before this job can be delivered or disputed.
            </p>
          )}
        </>
      )}

      {(canAcceptJob || canAcceptArbiter) && !(loading && !acceptance) && (
        <div className="flex flex-wrap items-center gap-2">
          {canAcceptJob && (
            <button
              type="button"
              onClick={() => onAcceptJob?.()}
              disabled={!onAcceptJob || isAcceptJobPending}
              aria-disabled={!onAcceptJob || isAcceptJobPending}
              data-testid="accept-job-button"
              className={`${baseBtn} bg-accent text-text-primary hover:bg-accent-hover disabled:hover:bg-accent`}
            >
              {isAcceptJobPending ? "Accepting…" : "Accept job"}
            </button>
          )}
          {canAcceptArbiter && (
            <button
              type="button"
              onClick={() => onAcceptArbiter?.()}
              disabled={!onAcceptArbiter || isAcceptArbiterPending}
              aria-disabled={!onAcceptArbiter || isAcceptArbiterPending}
              data-testid="accept-arbiter-button"
              className={`${baseBtn} bg-accent text-text-primary hover:bg-accent-hover disabled:hover:bg-accent`}
            >
              {isAcceptArbiterPending ? "Accepting…" : "Accept as arbiter"}
            </button>
          )}
        </div>
      )}

      {acceptJobError && (
        <p className="text-xs text-danger-soft" role="alert" data-testid="accept-job-error">
          {acceptJobError}
        </p>
      )}
      {acceptArbiterError && (
        <p className="text-xs text-danger-soft" role="alert" data-testid="accept-arbiter-error">
          {acceptArbiterError}
        </p>
      )}
    </section>
  );
}
