"use client";

import { useState } from "react";
import { ActionState } from "@/app/hooks/useActionStates";
import CountdownTimer from "@/app/components/CountdownTimer";
import TxStatusBanner from "@/app/components/TxStatusBanner";
import ButtonSpinner from "@/app/components/ButtonSpinner";
import { formatBaseUnits } from "@/app/lib/amounts";

interface Milestone {
  index: number;
  amount: string;
  status: string;
  releasedAmount?: string;
}

/**
 * Field-level and general error messages surfaced inside the card.
 *
 * - `amount`     – shown beneath the amount value (e.g. "Amount must be greater than 0")
 * - `status`     – shown beneath the status badge (e.g. "Unknown status value")
 * - `general`    – shown as a top-level alert banner above the card body
 * - `partialAmt` – validation error on the partial-release amount input
 */
export interface MilestoneCardErrors {
  amount?: string;
  status?: string;
  general?: string;
  partialAmt?: string;
}

interface Props {
  milestone?: Milestone | null;
  isClient: boolean;
  isFreelancer: boolean;
  isArbiter?: boolean;
  resolveDisputeState?: ActionState;
  isResolveDisputePending?: boolean;
  onResolveDispute?: (index: number, releaseToFreelancer: boolean) => void;
  partialReleaseState: ActionState;
  claimAutoReleaseState: ActionState;
  isPartialReleasePending: boolean;
  isClaimAutoReleasePending: boolean;
  amountDecimals?: number;
  amountSymbol?: string;
  /** Optional field-level / general error messages to render inside the card. */
  errors?: MilestoneCardErrors;
  /**
   * Absolute auto-release deadline (epoch ms) for a Delivered milestone. When
   * provided, a CountdownTimer is shown next to the status badge.
   */
  autoReleaseDeadline?: number | null;
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
  PartiallyReleased: "bg-partial/10 text-partial border-partial/30",
  Disputed: "bg-danger-soft/10 text-danger-soft border-danger-soft/20",
  Refunded: "bg-text-muted/10 text-text-muted border-text-muted/20",
};

const baseBtn =
  "text-xs px-3 py-1.5 rounded-lg transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * Compute the release percentage (0–100) for PartiallyReleased milestones.
 * Returns null if either value is missing, zero, or non-numeric.
 */
function getReleasePercent(
  releasedAmount: string | undefined,
  totalAmount: string
): number | null {
  const released = Number(releasedAmount);
  const total = Number(totalAmount);
  if (!releasedAmount || isNaN(released) || isNaN(total) || total <= 0) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.round((released / total) * 100)));
}

/**
 * Compute the unreleased balance (in stroops) for a milestone.
 * Returns null if the total or released amount isn't a valid integer string.
 */
function unreleasedBalance(milestone: Milestone): bigint | null {
  try {
    const total = BigInt(milestone.amount);
    const released = BigInt(milestone.releasedAmount ?? "0");
    return total - released;
  } catch {
    return null;
  }
}

export default function MilestoneCard({
  milestone,
  isClient,
  isFreelancer,
  isArbiter,
  resolveDisputeState,
  isResolveDisputePending,
  onResolveDispute,
  errors,
  autoReleaseDeadline,
  amountDecimals = 7,
  amountSymbol = "XLM",
  onMarkDelivered,
  onApprove,
  onDispute,
  onClaimAutoRelease,
  isClaimAutoReleasePending,
  partialReleaseState,
  isPartialReleasePending,
  onPartialRelease,
  ...unusedProps
}: Props) {
  void unusedProps;

  // Local state for the partial-release amount input and its validation error
  const [partialAmount, setPartialAmount] = useState("");
  const [partialAmtError, setPartialAmtError] = useState<string | null>(null);

  /** Client-side validation + submission handler for partial release. */
  function handlePartialReleaseSubmit() {
    if (!milestone) return;
    setPartialAmtError(null);

    const trimmed = partialAmount.trim();
    if (!trimmed) {
      setPartialAmtError("Enter an amount to release.");
      return;
    }

    let parsed: bigint;
    try {
      parsed = BigInt(trimmed);
    } catch {
      setPartialAmtError("Amount must be a whole number of stroops.");
      return;
    }

    if (parsed <= BigInt(0)) {
      setPartialAmtError("Amount must be greater than 0.");
      return;
    }

    const remaining = unreleasedBalance(milestone);
    if (remaining !== null && parsed > remaining) {
      setPartialAmtError(
        `Amount exceeds the unreleased balance of ${remaining.toString()} stroops.`
      );
      return;
    }

    onPartialRelease?.(milestone.index, trimmed);
  }

  if (
  !milestone ||
  milestone.index === undefined ||
  milestone.amount === undefined ||
  milestone.status === undefined ||
  typeof milestone.index !== "number" ||
  typeof milestone.amount !== "string" ||
  typeof milestone.status !== "string"
) {
    return (
      <div
        data-testid="milestone-empty-state"
        role="region"
        aria-label="No milestones"
        className="max-h-[85vh] overflow-y-auto sm:max-h-none sm:overflow-visible border border-border-strong rounded-lg p-4 bg-surface-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-text-secondary">No milestones available</p>
          <p className="text-xs text-text-muted">
            This job has no milestone data yet. Add milestones in the create job form to
            track delivery and releases.
          </p>
        </div>
        <span
          aria-label="Status: waiting for milestones"
          className="text-xs px-2 py-1 rounded-full border border-border-subtle bg-surface-field text-text-muted whitespace-nowrap"
        >
          Waiting for milestones
        </span>
      </div>
    );
  }

  // Human-readable milestone number (1-based) used in aria labels
  const milestoneNumber = milestone.index + 1;
  const milestoneLabel = `Milestone ${milestoneNumber}`;

  // Unique id for the error live region so buttons can reference it
  const errorRegionId = `milestone-${milestone.index}-errors`;

  const isDeadlineElapsed =
    typeof autoReleaseDeadline === "number" && autoReleaseDeadline <= Date.now();

  const isPartiallyReleased = milestone.status === "PartiallyReleased";
  const displayAmount = formatBaseUnits(milestone.amount, { decimals: amountDecimals });
  const displayReleasedAmount = milestone.releasedAmount
    ? formatBaseUnits(milestone.releasedAmount, { decimals: amountDecimals })
    : null;
  const releasePercent = isPartiallyReleased
    ? getReleasePercent(milestone.releasedAmount, milestone.amount)
    : null;

  return (
    <div
      data-testid="milestone-card"
      role="region"
      aria-label={milestoneLabel}
      aria-describedby={errors?.general ? errorRegionId : undefined}
      className="
        max-h-[85vh] overflow-y-auto sm:max-h-none sm:overflow-visible
        border border-border-strong rounded-lg p-4 bg-surface-card
        flex flex-col gap-3
        sm:flex-row sm:items-center sm:justify-between sm:gap-4
        transition-all duration-200
        hover:border-accent-soft/40 hover:bg-surface-card/80
        focus-within:outline-none focus-within:ring-2 focus-within:ring-accent-soft focus-within:ring-offset-2 focus-within:ring-offset-surface-page
      "
    >
      {/* General error alert banner — aria-live so it announces dynamically */}
      {errors?.general && (
        <div
          id={errorRegionId}
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
          data-testid="milestone-card-error-alert"
          className="w-full rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-sm text-danger-soft sm:col-span-full"
        >
          {errors.general}
        </div>
      )}

      {/* Milestone info */}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text-muted" aria-hidden="true">
          {milestoneLabel}
        </p>
        <p
          className="font-mono text-text-primary text-sm mt-1 truncate"
          aria-label={`${milestoneLabel} amount: ${displayAmount} ${amountSymbol}`}
        >
          {displayAmount} {amountSymbol}
        </p>
        {/* Amount field error */}
        {errors?.amount && (
          <p
            role="alert"
            aria-live="polite"
            data-testid="milestone-card-amount-error"
            className="mt-1 text-xs text-danger-soft"
          >
            {errors.amount}
          </p>
        )}

        {/* Progress bar — only shown for PartiallyReleased milestones */}
        {isPartiallyReleased && releasePercent !== null && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Released</span>
              <span
                data-testid="milestone-release-percent"
                aria-label={`${releasePercent}% released`}
                className="font-mono font-semibold text-partial"
              >
                {releasePercent}%
              </span>
            </div>
            {/* Track */}
            <div
              role="progressbar"
              aria-valuenow={releasePercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${milestoneLabel} release progress: ${releasePercent}% of funds released`}
              data-testid="milestone-progress-bar"
              className="relative h-2 w-full rounded-full bg-surface-field overflow-hidden"
            >
              {/* Fill */}
              <div
                data-testid="milestone-progress-fill"
                className="h-full rounded-full bg-partial transition-all duration-500"
                style={{ width: `${releasePercent}%` }}
              />
            </div>
            {/* Released amount vs total in stroops */}
            <p className="text-xs text-text-muted font-mono">
              <span className="text-partial">{milestone.releasedAmount}</span>
              {" / "}
              {displayAmount} {amountSymbol}
            </p>
          </div>
        )}
      </div>

      {/* Status badge + action buttons wrapper */}
      <div className="flex flex-col gap-3 items-end justify-center">
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
          <div className="flex flex-col items-start gap-1">
            <span
              aria-label={`${milestoneLabel} status: ${milestone.status}`}
              data-testid="milestone-status-badge"
              className={`text-xs px-2 py-1 rounded-full border whitespace-nowrap transition-colors ${
                statusColor[milestone.status] ?? "bg-surface-field text-text-muted border-border-subtle"
              }`}
            >
              {isPartiallyReleased ? "Partially Released" : milestone.status}
            </span>
            {/* Auto-release countdown for delivered milestones */}
            {milestone.status === "Delivered" &&
              typeof autoReleaseDeadline === "number" && (
                <CountdownTimer deadline={autoReleaseDeadline} />
              )}
            {/* Status field error */}
            {errors?.status && (
              <p
                role="alert"
                aria-live="polite"
                data-testid="milestone-card-status-error"
                className="text-xs text-warning-soft"
              >
                {errors.status}
              </p>
            )}
          </div>

          {isFreelancer && milestone.status === "Pending" && (
            <button
              onClick={() => onMarkDelivered?.(milestone.index)}
              disabled={!onMarkDelivered}
              aria-disabled={!onMarkDelivered}
              aria-label={`Mark ${milestoneLabel} as delivered`}
              className={`${baseBtn} bg-info-soft text-surface-page font-medium hover:bg-info-soft/80 active:scale-[0.97] focus-visible:ring-info-soft disabled:hover:bg-info-soft disabled:active:scale-100`}
            >
              Mark Delivered
            </button>
          )}

          {isClient && milestone.status === "Delivered" && (
            <button
              onClick={() => onApprove?.(milestone.index)}
              disabled={!onApprove}
              aria-disabled={!onApprove}
              aria-label={`Approve ${milestoneLabel}`}
              className={`${baseBtn} bg-success text-surface-page font-medium hover:bg-success/80 active:scale-[0.97] focus-visible:ring-success-soft disabled:hover:bg-success disabled:active:scale-100`}
            >
              Approve
            </button>
          )}

          {(isClient || isFreelancer) &&
            ["Pending", "Delivered"].includes(milestone.status) && (
              <button
                onClick={() => onDispute?.(milestone.index)}
                disabled={!onDispute}
                aria-disabled={!onDispute}
                aria-label={`Dispute ${milestoneLabel}`}
                className={`${baseBtn} bg-danger text-text-primary hover:bg-danger/80 active:scale-[0.97] focus-visible:ring-danger-soft disabled:hover:bg-danger disabled:active:scale-100`}
              >
                Dispute
              </button>
            )}
            
          {isArbiter && milestone.status === "Disputed" && (
            <>
              <button
                onClick={() => onResolveDispute?.(milestone.index, true)}
                disabled={!onResolveDispute || isResolveDisputePending}
                className={`${baseBtn} bg-success text-surface-page font-medium hover:bg-success/80 disabled:opacity-50`}
              >
                {isResolveDisputePending ? "Releasing..." : "Release to Freelancer"}
              </button>

              <button
                onClick={() => onResolveDispute?.(milestone.index, false)}
                disabled={!onResolveDispute || isResolveDisputePending}
                className={`${baseBtn} bg-danger text-text-primary hover:bg-danger/80 disabled:opacity-50`}
              >
                {isResolveDisputePending ? "Refunding..." : "Refund to Client"}
              </button>
            </>
          )}
        </div>

        {/* TxStatusBanner rendered cleanly inside the layout alignment */}
        {resolveDisputeState && resolveDisputeState.phase !== "idle" && (
          <div className="w-full min-w-[240px]">
            <TxStatusBanner 
              state={resolveDisputeState} 
              successMessage="Dispute resolved successfully. Funds have been distributed." 
            />
          </div>
        )}
      </div>

      {/* Partial release form — visible to client when milestone is Delivered or PartiallyReleased */}
      {isClient && ["Delivered", "PartiallyReleased"].includes(milestone.status) && (
        <div
          className="w-full mt-1 pt-3 border-t border-border-subtle flex flex-col gap-2"
          data-testid="partial-release-section"
        >
          {/* Remaining balance hint */}
          {milestone.releasedAmount && (
            <p className="text-xs text-text-muted">
              Released so far:{" "}
              <span className="font-mono">{milestone.releasedAmount} stroops</span>
              {unreleasedBalance(milestone) !== null && (
                <>
                  {" · "}Remaining:{" "}
                  <span className="font-mono">
                    {unreleasedBalance(milestone)!.toString()} stroops
                  </span>
                </>
              )}
            </p>
          )}

          <div className="flex flex-wrap items-start gap-2">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <label
                htmlFor={`partial-amount-${milestone.index}`}
                className="text-xs text-text-muted sr-only"
              >
                Release amount in stroops for {milestoneLabel}
              </label>
              <input
                id={`partial-amount-${milestone.index}`}
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                placeholder="Amount in stroops"
                value={partialAmount}
                onChange={(e) => {
                  setPartialAmount(e.target.value);
                  setPartialAmtError(null);
                }}
                disabled={isPartialReleasePending}
                aria-label={`Partial release amount for ${milestoneLabel}`}
                aria-describedby={
                  partialAmtError ? `partial-amt-err-${milestone.index}` : undefined
                }
                aria-invalid={!!partialAmtError}
                className="text-xs px-3 py-1.5 rounded-lg bg-surface-field border border-border-subtle text-text-primary placeholder:text-text-muted
                  focus:outline-none focus:ring-2 focus:ring-accent-soft focus:ring-offset-1 focus:ring-offset-surface-page
                  disabled:opacity-40 disabled:cursor-not-allowed
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                data-testid="partial-amount-input"
              />
              {partialAmtError && (
                <p
                  id={`partial-amt-err-${milestone.index}`}
                  role="alert"
                  aria-live="polite"
                  data-testid="partial-amount-error"
                  className="text-xs text-danger-soft"
                >
                  {partialAmtError}
                </p>
              )}
            </div>

            <button
              onClick={handlePartialReleaseSubmit}
              disabled={isPartialReleasePending || !onPartialRelease}
              aria-disabled={isPartialReleasePending || !onPartialRelease}
              aria-label={`Release partial amount for ${milestoneLabel}`}
              className={`${baseBtn} flex items-center gap-1.5 bg-accent-soft text-text-primary hover:bg-accent-soft/80 active:scale-[0.97] focus-visible:ring-accent-soft disabled:hover:bg-accent-soft disabled:active:scale-100`}
              data-testid="partial-release-btn"
            >
              {isPartialReleasePending && <ButtonSpinner />}
              {isPartialReleasePending ? "Releasing…" : "Release Partial Amount"}
            </button>
          </div>

          {/* Tx status banner for partial release */}
          <TxStatusBanner
            state={partialReleaseState}
            successMessage="Partial release submitted. Milestone updated."
          />
        </div>
      )}
    </div>
  );
}