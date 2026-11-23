"use client";

import { useMemo } from "react";
import { formatBaseUnits } from "@/app/lib/amounts";
import {
  getReclaimOverdueEligibility,
  getWithdrawUnacceptedEligibility,
  RECLAIM_GRACE_MS,
  WITHDRAW_UNACCEPTED_WINDOW_MS,
} from "@/app/lib/milestone_actions";
import { type Job } from "@/app/lib/api_schemas";
import RefundConfirmModal from "./RefundConfirmModal";

export interface RefundPanelProps {
  /** The job (detail) whose refunds are being managed. */
  job: Job;
  /** Connected wallet address. */
  address: string | null;
  /** True when the viewer is the job's client. */
  isClient: boolean;
  /** Callback when a refund action is confirmed: (kind, milestoneIndex|null, amountStroops). */
  onRefund: (
    kind: "withdraw_unaccepted" | "reclaim_overdue",
    milestoneIndex: number | null,
    amountStroops: string
  ) => void;
  /** Whether a refund transaction is in flight. */
  isRefundPending?: boolean;
  /** Error message from the last refund attempt. */
  refundError?: string | null;
}

const NOW = Date.now();

function toMs(value: number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? n : null;
}

/** Sum the stroop amounts of all milestones on the job. */
function jobTotalStroops(job: Job): string {
  let total = BigInt(0);
  for (const m of job.milestones ?? []) {
    try {
      total += BigInt(m.amount);
    } catch {
      // ignore unparseable amounts
    }
  }
  return total.toString();
}

export default function RefundPanel({
  job,
  address,
  isClient,
  onRefund,
  isRefundPending = false,
  refundError = null,
}: RefundPanelProps) {
  const funded = job.funded === true;
  const milestoneCount = job.milestoneCount ?? job.milestones?.length ?? 0;
  const acceptedCount = job.acceptedCount ?? 0;
  const fundedMs = toMs(job.fundedAt);

  const withdrawEligibility = useMemo(
    () =>
      getWithdrawUnacceptedEligibility({
        funded,
        acceptedCount,
        milestoneCount,
        fundedAt: fundedMs ?? undefined,
        now: NOW,
      }),
    [funded, acceptedCount, milestoneCount, fundedMs]
  );

  const reclaimable = useMemo(() => {
    const now = NOW;
    return (job.milestones ?? [])
      .map((m) => {
        const eligibility = getReclaimOverdueEligibility({
          status: m.status,
          funded: m.funded,
          dueAt: m.dueAt ?? undefined,
          now,
        });
        const amountStroops = m.amount;
        return { ...m, eligibility, amountStroops };
      })
      .filter((e) => e.eligibility.eligible);
  }, [job.milestones]);

  if (!isClient) return null;
  if (!funded) {
    return (
      <section
        className="rounded-xl border border-border-subtle bg-surface-field p-4 sm:p-5"
        data-testid="refund-panel-not-funded"
      >
        <h3 className="text-sm font-semibold text-text-secondary mb-2">Refunds</h3>
        <p className="text-xs text-text-muted">
          Refunds become available once the escrow is funded.
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-border-subtle bg-surface-field p-4 sm:p-5"
      data-testid="refund-panel"
    >
      <h3 className="text-sm font-semibold text-text-secondary mb-3">Refunds</h3>

      {/* Withdraw unaccepted */}
      <div
        className="mb-4 rounded-lg border p-3 sm:p-4"
        data-testid="refund-panel-withdraw-unaccepted"
        aria-expanded={withdrawEligibility.eligible}
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="text-xs font-semibold text-text-primary">Withdraw unaccepted</h4>
          {withdrawEligibility.windowPassed === false && fundedMs != null && (
            <span
              className="text-xs text-text-muted"
              data-testid="refund-panel-withdraw-timer"
            >
              Available in{" "}
              <span className="font-mono">
                {Math.ceil((WITHDRAW_UNACCEPTED_WINDOW_MS - (NOW - fundedMs)) / 1000 / 60)} min
              </span>
            </span>
          )}
        </div>
        <p className="text-xs text-text-muted mb-2">
          Return the full deposit if the freelancer or arbiter has not accepted within 7 days of
          funding. Amount:{" "}
          <span className="font-mono text-text-primary" data-testid="refund-panel-withdraw-amount">
            {formatBaseUnits(jobTotalStroops(job), { decimals: job.tokenDecimals ?? 7 })}{" "}
            {job.tokenSymbol ?? "XLM"}
          </span>
        </p>
        <button
          type="button"
          disabled={
            !withdrawEligibility.eligible || isRefundPending || !address
          }
          aria-disabled={!withdrawEligibility.eligible || isRefundPending || !address}
          data-testid="refund-panel-withdraw-button"
          onClick={() =>
            withdrawEligibility.eligible && address
              ? onRefund("withdraw_unaccepted", null, jobTotalStroops(job))
              : null
          }
          className="w-full text-xs px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRefundPending ? "Submitting…" : withdrawEligibility.eligible ? "Withdraw" : "Not yet available"}
        </button>
        {!withdrawEligibility.eligible && funded && (
          <p className="mt-1 text-xs text-text-muted">
            {!withdrawEligibility.windowPassed
              ? "Wait for the 7-day acceptance window to pass."
              : withdrawEligibility.fullyAccepted
              ? "All milestones have been accepted."
              : "The escrow must be funded."}
          </p>
        )}
      </div>

      {/* Reclaim overdue milestones */}
      <div data-testid="refund-panel-reclaimable">
        <h4 className="text-xs font-semibold text-text-secondary mb-2">Reclaim overdue</h4>
        <p className="text-xs text-text-muted mb-3">
          Claim back funds for milestones that are still undelivered one day after their due date.
        </p>
        {reclaimable.length === 0 ? (
          <p className="text-xs text-text-muted" data-testid="refund-panel-reclaim-empty">
            No overdue milestones to reclaim.
          </p>
        ) : (
          reclaimable.map((m) => {
            const msRemaining = m.eligibility.msRemaining ?? 0;
            return (
              <div
                key={m.index}
                className="rounded-lg border border-border-subtle bg-surface-card p-2 sm:p-3 mb-2"
                data-testid={`refund-panel-reclaim-${m.index}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <h5 className="text-xs font-semibold text-text-primary">
                      Milestone {m.index + 1}
                    </h5>
                    <p className="text-[10px] text-text-muted">
                      {formatBaseUnits(m.amountStroops, { decimals: job.tokenDecimals ?? 7 })}{" "}
                      {job.tokenSymbol ?? "XLM"}
                    </p>
                  </div>
                  {m.eligibility.msRemaining != null && m.eligibility.msRemaining > 0 && (
                    <span
                      className="text-xs text-text-muted"
                      data-testid={`refund-panel-reclaim-timer-${m.index}`}
                    >
                      Available in {Math.ceil(msRemaining / 1000 / 60)} min
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={isRefundPending || !address}
                  aria-disabled={isRefundPending || !address}
                  data-testid={`refund-panel-reclaim-button-${m.index}`}
                  onClick={() =>
                    address ? onRefund("reclaim_overdue", m.index, m.amountStroops) : null
                  }
                  className="w-full text-xs px-3 py-1.5 rounded-lg bg-accent text-text-primary hover:bg-accent/90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isRefundPending ? "Submitting…" : "Reclaim"}
                </button>
              </div>
            );
          })
        )}
      </div>

      {refundError && (
        <div
          data-testid="refund-panel-error"
          role="alert"
          aria-live="assertive"
          className="mt-3 rounded-lg border border-danger bg-danger/20 px-3 py-2 text-xs text-danger-soft"
        >
          {refundError}
        </div>
      )}

      {/* Confirm modal is rendered by the parent; this panel only triggers it. */}
    </section>
  );
}
