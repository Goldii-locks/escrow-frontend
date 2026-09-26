"use client";

/**
 * Emergency freeze toggle for the escrow contract.
 *
 * Reads the current freeze state and renders a `role="switch"` control that
 * flips it. The status readouts sit in a grid whose column count steps with
 * the viewport so the row aligns on larger screens (Issue #478), and the state
 * is resolved from the backend with a mock fallback so the panel still renders
 * in a test environment (Issue #479).
 */

import { useEffect, useState, useTransition } from "react";
import ButtonSpinner from "./ButtonSpinner";
import {
  CONTRACT_PAUSE_GRID_CLASSES,
  type ContractPauseState,
  fetchContractPauseState,
  getContractPauseReadouts,
} from "@/app/lib/contract_pause_switch";

export interface ContractPauseSwitchProps {
  /** Escrow contract this freeze applies to. */
  contractId?: string;
  /** Controlled freeze state. Omit to let the panel resolve it itself. */
  paused?: boolean;
  /** Pre-resolved freeze state, skipping the backend round trip. */
  initialState?: ContractPauseState;
  /** Optional backend API endpoint. */
  apiEndpoint?: string;
  /** External loading flag that ORs with the internal one. */
  isLoading?: boolean;
  /** `true` while a freeze/unfreeze transaction is in flight. */
  isPending?: boolean;
  /** Disables the toggle (e.g. wallet not connected). */
  disabled?: boolean;
  /** Fired with the requested next freeze state when the toggle is flipped. */
  onToggle?: (nextPaused: boolean) => void;
  className?: string;
}

export default function ContractPauseSwitch({
  contractId,
  paused,
  initialState,
  apiEndpoint,
  isLoading: externalLoading = false,
  isPending = false,
  disabled = false,
  onToggle,
  className = "",
}: ContractPauseSwitchProps) {
  const [state, setState] = useState<ContractPauseState | null>(
    initialState ?? null,
  );
  const [loading, setLoading] = useState<boolean>(!initialState);
  const [, startTransition] = useTransition();

  // Resolve the freeze state from the backend, falling back to the mock
  // snapshot when it is unreachable (Issue #479).
  useEffect(() => {
    if (initialState) {
      startTransition(() => {
        setState(initialState);
        setLoading(false);
      });
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    startTransition(() => setLoading(true));

    fetchContractPauseState({ apiUrl: apiEndpoint, signal: controller.signal })
      .then((data) => {
        if (!isMounted) return;
        startTransition(() => {
          setState(data);
          setLoading(false);
        });
      })
      .catch(() => {
        // `fetchContractPauseState` already falls back to the mock snapshot, so
        // a rejection here means the abort signal fired on unmount.
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [initialState, apiEndpoint]);

  // Controlled mode wins; otherwise fall back to the resolved snapshot.
  const isPaused = paused ?? state?.paused ?? false;
  const readouts =
    state !== null
      ? getContractPauseReadouts({ ...state, contractId: contractId ?? state.contractId })
      : null;
  const isCurrentlyLoading = externalLoading || loading;

  const handleToggle = () => {
    if (disabled || isPending) return;
    onToggle?.(!isPaused);
  };

  const toggleClasses = [
    CONTRACT_PAUSE_GRID_CLASSES.toggle,
    "inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-colors",
    isPaused
      ? "border-danger bg-danger text-white hover:bg-danger-soft"
      : "border-border-subtle bg-surface-field text-text-primary hover:bg-border-strong",
    disabled || isPending ? "cursor-not-allowed opacity-50" : "cursor-pointer",
  ].join(" ");

  return (
    <section
      className={`${CONTRACT_PAUSE_GRID_CLASSES.panel} ${className}`}
      aria-label="Emergency freeze"
      data-testid="contract-pause-switch"
    >
      <div className={CONTRACT_PAUSE_GRID_CLASSES.header}>
        <h2 className={CONTRACT_PAUSE_GRID_CLASSES.title}>Emergency Freeze</h2>
        <p className={CONTRACT_PAUSE_GRID_CLASSES.description}>
          Halts new escrow deposits and milestone releases contract-wide.
        </p>
      </div>

      {/* Issue #478: the readout grid steps 1 → 2 → 3 columns with the
          viewport, and every cell carries `min-w-0` + `break-words` so a long
          contract address cannot push the row out of the panel's max width. */}
      <div
        className={CONTRACT_PAUSE_GRID_CLASSES.statusGrid}
        data-testid="contract-pause-status-grid"
      >
        {isCurrentlyLoading ? (
          <>
            <div
              className={CONTRACT_PAUSE_GRID_CLASSES.loadingCell}
              data-testid="contract-pause-loading"
              aria-hidden="true"
            />
            <div
              className={CONTRACT_PAUSE_GRID_CLASSES.loadingCell}
              aria-hidden="true"
            />
            <div
              className={CONTRACT_PAUSE_GRID_CLASSES.loadingCell}
              aria-hidden="true"
            />
          </>
        ) : (
          <>
            <div
              className={CONTRACT_PAUSE_GRID_CLASSES.statusCell}
              data-testid="contract-pause-cell-contract"
            >
              <span className={CONTRACT_PAUSE_GRID_CLASSES.statusLabel}>
                Contract
              </span>
              <span className={CONTRACT_PAUSE_GRID_CLASSES.statusValue}>
                {readouts?.contractId ?? "—"}
              </span>
            </div>

            <div
              className={CONTRACT_PAUSE_GRID_CLASSES.statusCell}
              data-testid="contract-pause-cell-state"
            >
              <span className={CONTRACT_PAUSE_GRID_CLASSES.statusLabel}>
                Freeze State
              </span>
              <span className={CONTRACT_PAUSE_GRID_CLASSES.statusValue}>
                {readouts?.phase ?? "—"}
              </span>
            </div>

            <div
              className={CONTRACT_PAUSE_GRID_CLASSES.statusCell}
              data-testid="contract-pause-cell-updated"
            >
              <span className={CONTRACT_PAUSE_GRID_CLASSES.statusLabel}>
                Last Updated
              </span>
              <span className={CONTRACT_PAUSE_GRID_CLASSES.statusValue}>
                {readouts?.updatedAt ?? "—"}
              </span>
              <span
                className={`${CONTRACT_PAUSE_GRID_CLASSES.statusValue} mt-1 font-mono text-xs text-text-secondary`}
              >
                {readouts?.updatedBy ?? "—"}
              </span>
            </div>

            <div
              className={`${CONTRACT_PAUSE_GRID_CLASSES.statusCell} sm:col-span-2 lg:col-span-3`}
              data-testid="contract-pause-cell-reason"
            >
              <span className={CONTRACT_PAUSE_GRID_CLASSES.statusLabel}>
                Reason
              </span>
              <span className={CONTRACT_PAUSE_GRID_CLASSES.statusValue}>
                {readouts?.reason ?? "—"}
              </span>
            </div>
          </>
        )}
      </div>

      <div className={CONTRACT_PAUSE_GRID_CLASSES.toggleRow}>
        <div className={CONTRACT_PAUSE_GRID_CLASSES.toggleCaption}>
          <p className={CONTRACT_PAUSE_GRID_CLASSES.toggleCaptionTitle}>
            {isPaused ? "Contract is frozen" : "Contract is live"}
          </p>
          <p className={CONTRACT_PAUSE_GRID_CLASSES.toggleCaptionBody}>
            {isPaused
              ? "Deposits and releases are paused until an admin lifts the freeze."
              : "Turning this on halts all escrow movement immediately."}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={isPaused}
          aria-label="Emergency freeze"
          onClick={handleToggle}
          disabled={disabled || isPending}
          className={toggleClasses}
          data-testid="contract-pause-toggle"
        >
          {isPending && <ButtonSpinner />}
          {isPending ? "Submitting..." : isPaused ? "Lift Freeze" : "Freeze Contract"}
        </button>
      </div>
    </section>
  );
}
