"use client";

/**
 * Locked dispute details view.
 *
 * Wraps the whole view in a role check (Issue #480): only the client, the
 * freelancer, and the assigned arbiter named on the record may read a locked
 * escrow. Everyone else — including a disconnected wallet — gets the fallback
 * warning screen instead, and no part of the record reaches the DOM.
 */

import { useEffect, useState, useTransition } from "react";
import { useToast } from "@/app/context/ToastContext";
import {
  ESCROW_ROLE_LABELS,
  UNAUTHORIZED_ARBITRATION_WARNING,
  type ArbitrationEscrowDetailsRecord,
  fetchArbitrationEscrowDetails,
  getArbitrationEscrowReadouts,
  getEscrowAccessDenialReason,
  isEscrowDetailsAuthorized,
  resolveEscrowPartyRole,
} from "@/app/lib/arbitration_escrow_details";

export interface ArbitrationEscrowDetailsProps {
  /** Dispute whose locked escrow should be shown. */
  disputeId: string;
  /** Currently connected wallet address. */
  currentWalletAddress?: string | null;
  /** Optional record override, skipping the backend round trip. */
  initialRecord?: ArbitrationEscrowDetailsRecord;
  /** Extra wallets granted read access without being a party. */
  additionalViewers?: string[];
  /** External loading flag that ORs with the internal one. */
  isLoading?: boolean;
  /** Optional backend API endpoint. */
  apiEndpoint?: string;
  className?: string;
  /** Action callback triggered when an action is executed. */
  onAction?: (actionType: string) => Promise<void> | void;
  /** Action pending flag. */
  isActionPending?: boolean;
  /** Action error message override. */
  actionError?: string | null;
}

export default function ArbitrationEscrowDetails({
  disputeId,
  currentWalletAddress,
  initialRecord,
  additionalViewers,
  isLoading: externalLoading = false,
  apiEndpoint,
  className = "",
  onAction,
  isActionPending = false,
  actionError = null,
}: ArbitrationEscrowDetailsProps) {
  const [record, setRecord] = useState<ArbitrationEscrowDetailsRecord | null>(
    initialRecord ?? null,
  );
  const [loading, setLoading] = useState<boolean>(!initialRecord);
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState<boolean>(false);
  const [, startTransition] = useTransition();
  const { showToast } = useToast();

  useEffect(() => {
    if (initialRecord) {
      startTransition(() => {
        setRecord(initialRecord);
        setLoading(false);
      });
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    startTransition(() => setLoading(true));

    fetchArbitrationEscrowDetails(disputeId, {
      apiUrl: apiEndpoint,
      signal: controller.signal,
    })
      .then((data) => {
        if (!isMounted) return;
        startTransition(() => {
          setRecord(data);
          setLoading(false);
        });
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [disputeId, initialRecord, apiEndpoint]);

  const handleTriggerAction = (actionType: string) => {
    setConfirmingAction(actionType);
    setAcknowledged(false);
  };

  const handleConfirmSubmit = async () => {
    if (!confirmingAction || !acknowledged) return;
    const actionToRun = confirmingAction;
    setConfirmingAction(null);
    setAcknowledged(false);

    try {
      if (onAction) {
        await onAction(actionToRun);
      }
      showToast(`Action '${actionToRun}' completed successfully.`, "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : actionError || "Action failed.";
      showToast(`Action failed: ${msg}`, "error");
    }
  };

  // 1. Access restriction role check (Issue #480). Runs on every render, before
  //    any branch, so no branch below can be reached with an unauthorized
  //    wallet and no record field is read into JSX for one.
  const isAuthorized =
    record !== null &&
    isEscrowDetailsAuthorized(currentWalletAddress, record, { additionalViewers });

  if (externalLoading || (loading && !isAuthorized)) {
    return (
      <div
        className={`rounded-xl border border-border-subtle bg-surface-card p-6 ${className}`}
        aria-busy="true"
        aria-label="Loading locked escrow details"
        data-testid="arbitration-escrow-details-loading"
      >
        <div className="h-6 w-52 animate-pulse rounded bg-surface-field" />
        <div className="mt-4 grid grid-cols-1 items-start gap-3 sm:grid-cols-2 sm:items-stretch sm:gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-12 animate-pulse rounded bg-surface-field"
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    );
  }

  // 2. Fallback warning screen for unauthorized accounts (Issue #480).
  if (!isAuthorized || record === null) {
    const denialReason = getEscrowAccessDenialReason(currentWalletAddress);
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={`rounded-xl border border-danger/40 bg-danger/10 p-6 text-center text-danger-soft ${className}`}
        data-testid="arbitration-escrow-details-unauthorized"
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger/20 text-danger-soft">
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-text-primary">Access Denied</h3>
        <p className="mt-2 text-sm text-danger-soft">
          {UNAUTHORIZED_ARBITRATION_WARNING}
        </p>
        <p className="mt-2 text-xs text-text-secondary">
          {denialReason === "disconnected"
            ? "Connect the wallet that is a party on this dispute to view its details."
            : "This wallet is connected but is not a party on this dispute."}
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Current Wallet: {currentWalletAddress || "Not connected"}
        </p>
      </div>
    );
  }

  // 3. Authorized details view.
  const role = resolveEscrowPartyRole(currentWalletAddress, record);
  const readouts = getArbitrationEscrowReadouts(record);

  return (
    <section
      className={`rounded-xl border border-border-subtle bg-surface-card p-6 ${className}`}
      aria-label="Locked escrow details"
      data-testid="arbitration-escrow-details-container"
    >
      <header className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <h2 className="text-base font-semibold text-text-primary">
          Locked Escrow Details
        </h2>
        <p className="text-xs text-text-secondary">
          {role ? `Viewing as ${ESCROW_ROLE_LABELS[role]}` : "Viewing as authorized wallet"}
        </p>
      </header>

      <div
        className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 sm:items-stretch sm:gap-4 lg:grid-cols-3 lg:gap-6"
        data-testid="arbitration-escrow-details-grid"
      >
        {readouts.map((readout) => (
          <div
            key={readout.label}
            className="min-w-0 rounded-lg bg-surface-field px-3 py-2.5"
          >
            <span className="block text-[11px] font-medium uppercase tracking-wide text-text-secondary">
              {readout.label}
            </span>
            <span className="mt-1 block min-w-0 break-words text-sm text-text-primary">
              {readout.value}
            </span>
          </div>
        ))}
      </div>

      {onAction && (
        <div className="mt-6 flex flex-wrap gap-3" data-testid="arbitration-escrow-details-actions">
          <button
            type="button"
            onClick={() => handleTriggerAction("request_review")}
            disabled={isActionPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            data-testid="action-request-review"
          >
            Request Review
          </button>
        </div>
      )}

      {confirmingAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="arbitration-confirm-modal-title"
          data-testid="arbitration-escrow-details-confirm-modal"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
        >
          <div className="w-full space-y-4 rounded-xl border border-gray-700 bg-gray-900 p-6 sm:max-w-lg">
            <h2 id="arbitration-confirm-modal-title" className="text-lg font-semibold text-white">
              Confirm Action: {confirmingAction}
            </h2>
            <p className="text-sm text-gray-400">
              Please double-confirm before signing the transaction for action &quot;{confirmingAction}&quot;.
            </p>
            <label className="flex items-start gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                className="mt-1"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                data-testid="arbitration-confirm-modal-checkbox"
              />
              <span>I confirm that I want to proceed with this transaction.</span>
            </label>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmingAction(null)}
                className="min-h-[44px] rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                data-testid="arbitration-confirm-modal-cancel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={!acknowledged || isActionPending}
                className="min-h-[44px] rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                data-testid="arbitration-confirm-modal-submit"
              >
                Confirm & Sign
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

