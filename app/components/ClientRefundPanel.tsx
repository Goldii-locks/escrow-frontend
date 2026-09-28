"use client";

import { useEffect, useState } from "react";
import LoadingSkeleton from "@/app/components/LoadingSkeleton";
import {
  type ClientRefundEntry,
  MOCK_REFUND_PAYLOAD,
  fetchRefundEntries,
  mapRefundPayload,
} from "@/app/lib/client_refund_panel_mapping";
import {
  refundContainsCodeTags,
  sanitizeRefundAmount,
  sanitizeRefundReason,
} from "@/app/lib/client_refund_panel_sanitize";

export interface ClientRefundPanelProps {
  escrowId?: string;
  initialRefunds?: ClientRefundEntry[];
  isLoading?: boolean;
  onSubmitRefund?: (data: {
    reason: string;
    amount: string;
  }) => void | Promise<void>;
  isPending?: boolean;
  apiEndpoint?: string;
  className?: string;
}

export default function ClientRefundPanel({
  escrowId,
  initialRefunds,
  isLoading: externalLoading = false,
  onSubmitRefund,
  isPending = false,
  apiEndpoint,
  className = "",
}: ClientRefundPanelProps) {
  const [refunds, setRefunds] = useState<ClientRefundEntry[]>(
    initialRefunds ?? mapRefundPayload(MOCK_REFUND_PAYLOAD),
  );
  const [loading, setLoading] = useState<boolean>(
    !initialRefunds && externalLoading,
  );
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    if (initialRefunds) {
      setRefunds(initialRefunds);
      return;
    }

    if (apiEndpoint) {
      setLoading(true);
      fetchRefundEntries(apiEndpoint)
        .then((data) => {
          setRefunds(data);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [initialRefunds, apiEndpoint]);

  const handleReasonChange = (val: string) => {
    if (refundContainsCodeTags(val)) {
      setInputError("Code tags and scripts are not permitted in refund reason.");
      setReason(""); // Form ignores input containing code tags (#502)
      return;
    }
    setInputError(null);
    setReason(sanitizeRefundReason(val));
  };

  const handleAmountChange = (val: string) => {
    if (refundContainsCodeTags(val)) {
      setInputError("Invalid characters in amount.");
      setAmount(""); // Form ignores input containing code tags (#502)
      return;
    }
    setInputError(null);
    setAmount(sanitizeRefundAmount(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (refundContainsCodeTags(reason) || refundContainsCodeTags(amount)) {
      setInputError("Cannot submit input containing code tags.");
      return;
    }
    const safeReason = sanitizeRefundReason(reason);
    const safeAmount = sanitizeRefundAmount(amount);
    if (!safeReason || !safeAmount) {
      setInputError("Please provide a valid refund reason and amount.");
      return;
    }
    if (onSubmitRefund) {
      await onSubmitRefund({ reason: safeReason, amount: safeAmount });
      setReason("");
      setAmount("");
    }
  };

  if (externalLoading || loading) {
    return (
      <div
        data-testid="client-refund-panel-loading"
        aria-busy="true"
        aria-label="Loading client refund panel"
        className={`space-y-4 rounded-xl border border-border-subtle bg-surface-card p-6 ${className}`}
      >
        <LoadingSkeleton data-testid="client-refund-skeleton" />
      </div>
    );
  }

  return (
    <div
      data-testid="client-refund-panel"
      className={`rounded-xl border border-border-subtle bg-surface-card p-6 space-y-6 ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border-subtle pb-4">
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            Client Refund Panel
          </h3>
          {escrowId && (
            <p className="text-xs text-text-secondary font-mono mt-1">
              Escrow ID: {escrowId}
            </p>
          )}
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded bg-surface-field text-text-secondary">
          {refunds.length} Refund Request{refunds.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Refund request form */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
        data-testid="client-refund-form"
      >
        <h4 className="text-sm font-medium text-text-primary">
          Request a Refund
        </h4>

        {inputError && (
          <div
            role="alert"
            data-testid="client-refund-error"
            className="rounded-lg bg-danger/10 border border-danger/30 p-3 text-xs text-danger-soft"
          >
            {inputError}
          </div>
        )}

        <div>
          <label
            htmlFor="refund-amount"
            className="block text-xs font-medium uppercase tracking-wide text-text-secondary mb-1"
          >
            Refund Amount
          </label>
          <input
            id="refund-amount"
            data-testid="client-refund-amount-input"
            type="text"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-border-subtle bg-surface-field px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label
            htmlFor="refund-reason"
            className="block text-xs font-medium uppercase tracking-wide text-text-secondary mb-1"
          >
            Reason for Refund
          </label>
          <textarea
            id="refund-reason"
            data-testid="client-refund-reason-input"
            rows={3}
            value={reason}
            onChange={(e) => handleReasonChange(e.target.value)}
            placeholder="Describe the issue or reason for the refund..."
            className="w-full rounded-lg border border-border-subtle bg-surface-field px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          data-testid="client-refund-submit-button"
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          {isPending ? "Submitting..." : "Submit Refund Request"}
        </button>
      </form>

      {/* Refunds list */}
      <div className="space-y-3 pt-2" data-testid="client-refunds-list">
        <h4 className="text-sm font-medium text-text-primary">Refund History</h4>
        {refunds.length === 0 ? (
          <p className="text-xs text-text-secondary">
            No refund requests found.
          </p>
        ) : (
          <div className="space-y-2">
            {refunds.map((refund) => (
              <div
                key={refund.id}
                data-testid={`refund-entry-${refund.id}`}
                className="rounded-lg bg-surface-field p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="font-semibold text-sm text-text-primary">
                    {refund.jobTitle}
                  </span>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {refund.reason}
                  </p>
                  <span className="text-[11px] text-text-muted">
                    {new Date(refund.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-text-primary">
                    {refund.amount} {refund.token}
                  </span>
                  <span className="block text-[11px] uppercase tracking-wide text-text-secondary font-medium mt-0.5">
                    {refund.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
