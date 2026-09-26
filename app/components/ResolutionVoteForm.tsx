"use client";

import { useEffect, useId, useRef, useState } from "react";
import LoadingSkeleton from "./LoadingSkeleton";
import { useResolutionDispute } from "@/app/hooks/useResolutionDispute";
import {
  CUSTOM_VOTE_OPTION_ID,
  RESOLUTION_BADGE_STYLES,
  RESOLUTION_BPS_SCALE,
  RESOLUTION_RATIONALE_MAX_LENGTH,
  buildVoteSubmission,
  containsUnsafeMarkup,
  formatBpsAsPercent,
  getResolutionVoteStatus,
  sanitizeBpsInput,
  sanitizeVoteInput,
  type ResolutionDisputeData,
  type ResolutionVoteStatus,
  type ResolutionVoteSubmission,
} from "@/app/lib/resolution_vote_form";

export interface ResolutionVoteFormProps {
  /** Identifier of the dispute being voted on. */
  disputeId: string;
  /** Optional backend endpoint; defaults to `/api/disputes/:id/resolution`. */
  apiEndpoint?: string;
  /** Pre-loaded dispute data; skips the query when provided (`null` = none). */
  initialData?: ResolutionDisputeData | null;
  /**
   * Signs and submits the vote. Only invoked after the arbitrator confirms in
   * the double-confirmation modal (Issue #455).
   */
  onSubmitVote?: (submission: ResolutionVoteSubmission) => void | Promise<void>;
  /** Clock override (ms since epoch) used to classify the status badge. */
  nowMs?: number;
  className?: string;
}

const CONTAINER_CLASS = "rounded-xl border border-gray-800 bg-gray-900/60 p-6 text-gray-200";

/**
 * Arbitrator vote split selector.
 *
 * Loads the dispute through `useResolutionDispute` (#453), renders a status
 * badge for the dispute / vote state (#454), sanitizes every free-text input
 * (#452), and gates signing behind a confirmation modal (#455).
 */
export default function ResolutionVoteForm({
  disputeId,
  apiEndpoint,
  initialData,
  onSubmitVote,
  nowMs,
  className = "",
}: ResolutionVoteFormProps) {
  const query = useResolutionDispute(disputeId, { apiUrl: apiEndpoint, initialData });

  if (query.status === "loading") {
    return (
      <div
        className={`space-y-4 ${CONTAINER_CLASS} ${className}`}
        aria-busy="true"
        aria-label="Loading dispute resolution details"
        data-testid="resolution-vote-form-loading"
      >
        <div className="h-6 w-48 animate-pulse rounded bg-gray-700/60" />
        <LoadingSkeleton className="h-16 w-full" aria-label="Dispute details placeholder" />
        <LoadingSkeleton className="h-24 w-full" aria-label="Vote options placeholder" />
      </div>
    );
  }

  if (query.status === "error") {
    return (
      <div
        role="alert"
        className={`rounded-xl border border-red-500/30 bg-red-950/20 p-6 text-center text-red-200 ${className}`}
        data-testid="resolution-vote-form-error"
      >
        <p className="text-sm">{query.error}</p>
        <button
          type="button"
          onClick={query.reload}
          className="mt-3 min-h-[44px] rounded-lg bg-gray-800 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (query.status === "empty" || !query.data) {
    return (
      <div
        className={`${CONTAINER_CLASS} text-center text-sm text-gray-400 ${className}`}
        data-testid="resolution-vote-form-empty"
      >
        No open resolution vote was found for dispute #{sanitizeVoteInput(disputeId)}.
      </div>
    );
  }

  return (
    <VoteFormBody
      key={query.data.disputeId}
      data={query.data}
      onSubmitVote={onSubmitVote}
      nowMs={nowMs}
      className={className}
    />
  );
}

export function ResolutionStatusBadge({ status }: { status: ResolutionVoteStatus }) {
  const style = RESOLUTION_BADGE_STYLES[status];
  return (
    <span
      data-testid="resolution-vote-status-badge"
      data-status={status}
      data-tone={style.tone}
      className={style.className}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {style.label}
    </span>
  );
}

function defaultOptionId(data: ResolutionDisputeData): string {
  const matching = data.voteOptions.find(
    (o) =>
      o.clientBps === data.currentSplit.clientBps &&
      o.freelancerBps === data.currentSplit.freelancerBps,
  );
  return matching?.id ?? data.voteOptions[0]?.id ?? CUSTOM_VOTE_OPTION_ID;
}

function formatDeadline(deadline: string): string {
  const ms = Date.parse(deadline);
  return Number.isNaN(ms) ? "—" : new Date(ms).toLocaleString();
}

interface VoteFormBodyProps {
  data: ResolutionDisputeData;
  onSubmitVote?: (submission: ResolutionVoteSubmission) => void | Promise<void>;
  nowMs?: number;
  className: string;
}

function VoteFormBody({ data, onSubmitVote, nowMs, className }: VoteFormBodyProps) {
  const idPrefix = useId();
  const [mountedAtMs] = useState(() => Date.now());
  const [optionId, setOptionId] = useState(() => defaultOptionId(data));
  const [customClientBps, setCustomClientBps] = useState(String(data.currentSplit.clientBps));
  const [rationale, setRationale] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<ResolutionVoteSubmission | null>(null);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const status = getResolutionVoteStatus(data, nowMs ?? mountedAtMs, hasVoted);
  const ineligible = data.arbitratorStatus === "ineligible";
  const locked = status === "closed" || status === "voted" || ineligible;
  const rationaleHasMarkup = containsUnsafeMarkup(rationale);

  useEffect(() => {
    if (pending) confirmRef.current?.focus();
  }, [pending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (locked) return;

    const result = buildVoteSubmission(data, { optionId, customClientBps, rationale });
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    // Intercept: nothing is signed until the modal is confirmed.
    setSignError(null);
    setPending(result.submission);
  };

  const handleCancel = () => {
    if (signing) return;
    setPending(null);
    setSignError(null);
  };

  const handleConfirm = async () => {
    if (!pending || signing) return;
    setSigning(true);
    setSignError(null);
    try {
      await onSubmitVote?.(pending);
      setHasVoted(true);
      setPending(null);
    } catch (err) {
      setSignError(err instanceof Error ? err.message : "Failed to sign the vote transaction.");
    } finally {
      setSigning(false);
    }
  };

  const customFreelancerBps =
    customClientBps === "" ? null : RESOLUTION_BPS_SCALE - Number(customClientBps);

  return (
    <div className={`${CONTAINER_CLASS} ${className}`} data-testid="resolution-vote-form">
      {/* Header + status badges (#454) */}
      <div className="flex flex-col gap-2 border-b border-gray-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Resolution Vote</h2>
          <p className="text-xs text-gray-400" data-testid="resolution-vote-dispute-id">
            Dispute #{data.disputeId}
            {data.jobId ? ` · Job ${data.jobId}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ResolutionStatusBadge status={status} />
          {ineligible && (
            <span
              data-testid="resolution-vote-eligibility-badge"
              className="inline-flex items-center rounded-full border border-gray-600/60 bg-gray-800/60 px-2.5 py-0.5 text-xs font-semibold text-gray-300"
            >
              Not Eligible
            </span>
          )}
        </div>
      </div>

      {/* Dispute details bound from the query (#453) */}
      <dl className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-gray-500">Disputed amount</dt>
          <dd className="font-medium text-white" data-testid="resolution-vote-amount">
            {data.amount || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Current split</dt>
          <dd className="font-medium text-white" data-testid="resolution-vote-current-split">
            Client {formatBpsAsPercent(data.currentSplit.clientBps)} / Freelancer{" "}
            {formatBpsAsPercent(data.currentSplit.freelancerBps)}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">Voting deadline</dt>
          <dd className="font-medium text-white" data-testid="resolution-vote-deadline">
            {formatDeadline(data.deadline)}
          </dd>
        </div>
      </dl>

      <form onSubmit={handleSubmit} className="mt-6" noValidate>
        <fieldset disabled={locked || signing} className="space-y-2">
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Choose a split
          </legend>

          {data.voteOptions.map((option) => (
            <label
              key={option.id}
              className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2 text-sm hover:border-gray-700"
            >
              <input
                type="radio"
                name={`${idPrefix}-option`}
                value={option.id}
                checked={optionId === option.id}
                onChange={() => setOptionId(option.id)}
              />
              <span className="flex-1 text-white">{option.label}</span>
              <span className="text-xs text-gray-400">
                {formatBpsAsPercent(option.clientBps)} / {formatBpsAsPercent(option.freelancerBps)}
              </span>
            </label>
          ))}

          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2 text-sm hover:border-gray-700">
            <input
              type="radio"
              name={`${idPrefix}-option`}
              value={CUSTOM_VOTE_OPTION_ID}
              checked={optionId === CUSTOM_VOTE_OPTION_ID}
              onChange={() => setOptionId(CUSTOM_VOTE_OPTION_ID)}
            />
            <span className="flex-1 text-white">Custom split</span>
          </label>

          {optionId === CUSTOM_VOTE_OPTION_ID && (
            <div className="flex flex-col gap-1 pl-1 sm:flex-row sm:items-center sm:gap-3">
              <label htmlFor={`${idPrefix}-custom`} className="text-xs text-gray-400">
                Client share (bps)
              </label>
              <input
                id={`${idPrefix}-custom`}
                type="text"
                inputMode="numeric"
                value={customClientBps}
                onChange={(e) => setCustomClientBps(sanitizeBpsInput(e.target.value))}
                className="w-32 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
              <span className="text-xs text-gray-400" data-testid="resolution-vote-custom-preview">
                {customFreelancerBps === null
                  ? "Enter a client share"
                  : `Freelancer receives ${formatBpsAsPercent(customFreelancerBps)}`}
              </span>
            </div>
          )}

          <div className="pt-3">
            <label
              htmlFor={`${idPrefix}-rationale`}
              className="text-xs font-semibold uppercase tracking-wider text-gray-400"
            >
              Rationale
            </label>
            <textarea
              id={`${idPrefix}-rationale`}
              value={rationale}
              maxLength={RESOLUTION_RATIONALE_MAX_LENGTH * 2}
              onChange={(e) => setRationale(e.target.value)}
              onBlur={(e) => setRationale(sanitizeVoteInput(e.target.value))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
              placeholder="Explain the reasoning behind this split (plain text)"
            />
            {rationaleHasMarkup && (
              <p className="mt-1 text-xs text-amber-300" data-testid="resolution-vote-markup-warning">
                HTML and scripts are not allowed and will be removed before submission.
              </p>
            )}
          </div>
        </fieldset>

        {formError && (
          <div
            role="alert"
            className="mt-3 rounded border border-red-800/40 bg-red-900/30 p-2 text-xs text-red-300"
          >
            {formError}
          </div>
        )}

        {hasVoted && (
          <p role="status" className="mt-3 text-xs text-emerald-300">
            Your vote has been signed and submitted.
          </p>
        )}
        {!hasVoted && locked && (
          <p className="mt-3 text-xs text-gray-400" data-testid="resolution-vote-locked-note">
            {ineligible
              ? "Your wallet is not eligible to vote on this dispute."
              : status === "voted"
                ? "You have already voted on this dispute."
                : "Voting on this dispute has closed."}
          </p>
        )}

        <button
          type="submit"
          disabled={locked || signing}
          className="mt-4 min-h-[44px] rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Submit Vote
        </button>
      </form>

      {/* Double-confirmation modal (#455) */}
      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${idPrefix}-confirm-title`}
          data-testid="resolution-vote-confirm-modal"
          onKeyDown={(e) => {
            if (e.key === "Escape") handleCancel();
          }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
        >
          <div className="w-full rounded-t-2xl border border-gray-800 bg-gray-900 p-6 text-gray-200 sm:max-w-md sm:rounded-xl">
            <h3 id={`${idPrefix}-confirm-title`} className="text-lg font-semibold text-white">
              Confirm your vote
            </h3>
            <p className="mt-1 text-xs text-gray-400">
              Confirming will ask your wallet to sign this vote. A signed vote cannot be changed.
            </p>

            <dl className="mt-4 space-y-2 text-sm" data-testid="resolution-vote-confirm-summary">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-400">Dispute</dt>
                <dd className="text-white">#{pending.disputeId}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-400">Client receives</dt>
                <dd className="text-white" data-testid="resolution-vote-confirm-client">
                  {formatBpsAsPercent(pending.clientBps)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-400">Freelancer receives</dt>
                <dd className="text-white" data-testid="resolution-vote-confirm-freelancer">
                  {formatBpsAsPercent(pending.freelancerBps)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-400">Rationale</dt>
                <dd
                  className="mt-1 break-words text-white"
                  data-testid="resolution-vote-confirm-rationale"
                >
                  {pending.rationale || "No rationale provided."}
                </dd>
              </div>
            </dl>

            {signError && (
              <div
                role="alert"
                className="mt-3 rounded border border-red-800/40 bg-red-900/30 p-2 text-xs text-red-300"
              >
                {signError}
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleCancel}
                disabled={signing}
                className="min-h-[44px] rounded-lg bg-gray-800 px-4 py-1.5 text-sm text-gray-200 hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={handleConfirm}
                disabled={signing}
                aria-busy={signing}
                className="min-h-[44px] rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {signing ? "Signing…" : "Confirm & Sign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
