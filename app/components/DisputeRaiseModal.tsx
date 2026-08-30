"use client";

import { useEffect, useRef } from "react";
import ButtonSpinner from "@/app/components/ButtonSpinner";
import TxStatusBanner from "@/app/components/TxStatusBanner";
import type { ActionState } from "@/app/hooks/useActionStates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DisputeRaiseModalProps {
  /** Whether the modal is currently visible. */
  isOpen: boolean;
  /** Called when the user requests the modal be closed (backdrop click, Escape, or Cancel). */
  onClose: () => void;
  /** Called when the user confirms they want to raise a dispute. */
  onConfirm: () => void;
  /**
   * 0-based milestone index being disputed. When null the modal renders
   * its empty-data placeholder instead of the confirmation body.
   */
  milestoneIndex: number | null;
  /** Human-readable XLM amount for the milestone (e.g. "25.0000000 XLM"). */
  milestoneAmount?: string | null;
  /** Whether the raise-dispute transaction is currently in flight. */
  isPending?: boolean;
  /** Optional ActionState to drive the TxStatusBanner below the actions row. */
  disputeState?: ActionState | null;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a 0-based index to a 1-based human-readable label. */
export function milestoneLabel(index: number | null): string {
  if (index === null || typeof index !== "number" || !isFinite(index)) {
    return "this milestone";
  }
  return `Milestone ${index + 1}`;
}

// ---------------------------------------------------------------------------
// Shared Tailwind class strings
// ---------------------------------------------------------------------------

/**
 * Base button classes shared by both action buttons — mirrors the `baseBtn`
 * string used throughout MilestoneCard and other interactive components.
 */
const baseBtn =
  "text-sm px-4 py-2 rounded-lg transition-all whitespace-nowrap " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-surface-page " +
  "disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * EmptyStatePlaceholder — rendered when milestoneIndex is null.
 *
 * Provides a descriptive placeholder UI so the modal remains accessible and
 * informative even when it is invoked without a valid target milestone.
 */
function EmptyStatePlaceholder() {
  return (
    <div
      data-testid="dispute-modal-empty-state"
      aria-live="polite"
      className={
        "flex flex-col sm:flex-row sm:items-center sm:justify-between " +
        "gap-3 p-4 rounded-lg border border-border-subtle bg-surface-field " +
        "animate-fade-in"
      }
    >
      {/* Left — icon + text */}
      <div className="flex items-start gap-3">
        {/* Decorative warning icon */}
        <span
          aria-hidden="true"
          className="mt-0.5 text-xl leading-none select-none"
        >
          ⚠️
        </span>

        <div className="flex flex-col gap-1">
          <p
            data-testid="dispute-modal-empty-heading"
            className="text-sm font-semibold text-text-primary"
          >
            No milestone selected
          </p>
          <p
            data-testid="dispute-modal-empty-description"
            className="text-xs text-text-muted"
          >
            Select a milestone from your job dashboard before raising a
            dispute. Only milestones in{" "}
            <span className="font-medium text-text-secondary">Pending</span>{" "}
            or{" "}
            <span className="font-medium text-text-secondary">Delivered</span>{" "}
            status can be disputed.
          </p>
        </div>
      </div>

      {/* Right — status badge */}
      <span
        data-testid="dispute-modal-empty-badge"
        aria-label="Status: no milestone selected"
        className={
          "self-start sm:self-auto shrink-0 " +
          "inline-flex items-center px-2.5 py-1 rounded-full border " +
          "text-xs font-medium " +
          "bg-surface-field text-text-muted border-border-subtle"
        }
      >
        Waiting for selection
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * DisputeRaiseModal — confirmation modal for raising a milestone dispute.
 *
 * Accessibility:
 *  - `role="dialog"` + `aria-modal="true"` on the backdrop
 *  - `aria-labelledby` wired to the `<h2>` title
 *  - `aria-describedby` wired to the body description paragraph
 *  - Focus is trapped to the modal panel on open; returns on close
 *  - Escape key closes the modal
 *  - Backdrop click closes the modal (click outside panel)
 *  - Confirm button: `aria-label` includes milestone name for screen readers
 *  - All interactive elements carry `focus-visible` ring styles
 *  - Empty-state container carries `aria-live="polite"` for dynamic updates
 *
 * Interactive states (#331):
 *  - Buttons: hover colour shifts, `active:scale-[0.97]` press feedback
 *  - Confirm: `hover:bg-danger-soft/20 focus-visible:ring-danger-soft`
 *  - Cancel: `hover:bg-border-subtle focus-visible:ring-accent-soft`
 *  - Close ✕: `hover:text-text-primary focus-visible:ring-accent-soft`
 *  - Both buttons carry `disabled:opacity-40 disabled:cursor-not-allowed`
 */
export default function DisputeRaiseModal({
  isOpen,
  onClose,
  onConfirm,
  milestoneIndex,
  milestoneAmount,
  isPending = false,
  disputeState = null,
  className = "",
}: DisputeRaiseModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const label = milestoneLabel(milestoneIndex);
  const hasValidMilestone = milestoneIndex !== null;

  // ── Focus management ────────────────────────────────────────────────────

  // Trap focus inside the modal panel when it opens; restore on close.
  useEffect(() => {
    if (!isOpen) return;

    // Move focus into the panel on open
    const frame = requestAnimationFrame(() => {
      panelRef.current?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }

      // Basic focus trap: cycle Tab/Shift+Tab within the panel
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), ' +
            'select:not([disabled]), textarea:not([disabled]), ' +
            '[tabindex]:not([tabindex="-1"])'
        )
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      cancelAnimationFrame(frame);
    };
  }, [isOpen, onClose]);

  // Guard render
  if (!isOpen) return null;

  // ── IDs for aria wiring ──────────────────────────────────────────────────
  const titleId = "dispute-modal-title";
  const descId = "dispute-modal-desc";

  return (
    /* Backdrop */
    <div
      data-testid="dispute-raise-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={hasValidMilestone ? descId : undefined}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 ${className}`}
      onClick={(e) => {
        // Close when the user clicks the backdrop (outside the panel)
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Panel */}
      <div
        ref={panelRef}
        data-testid="dispute-raise-modal-content"
        tabIndex={-1}
        className={
          "relative bg-surface-card rounded-xl shadow-xl max-w-md w-full mx-4 p-6 " +
          "focus:outline-none animate-fade-in"
        }
        // Stop clicks inside the panel from bubbling to the backdrop
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          <h2
            id={titleId}
            data-testid="dispute-modal-title"
            className="text-lg font-semibold text-text-primary"
          >
            Raise a Dispute
          </h2>

          <button
            type="button"
            data-testid="dispute-modal-close"
            onClick={onClose}
            disabled={isPending}
            aria-label="Close dispute modal"
            className={
              "text-text-secondary transition-colors " +
              "hover:text-text-primary " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft " +
              "focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page " +
              "rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
            }
          >
            ✕
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        {hasValidMilestone ? (
          <div
            data-testid="dispute-modal-body"
            className="flex flex-col gap-4"
          >
            {/* Warning banner */}
            <div
              role="alert"
              data-testid="dispute-modal-warning"
              className={
                "flex items-start gap-3 px-4 py-3 rounded-lg border " +
                "border-danger/40 bg-danger/10 animate-slide-in"
              }
            >
              <span aria-hidden="true" className="mt-0.5 text-base leading-none select-none">
                ⚠️
              </span>
              <p className="text-sm text-danger-soft">
                Raising a dispute will flag{" "}
                <span className="font-semibold">{label}</span> for arbiter
                review. This action cannot be undone once submitted.
              </p>
            </div>

            {/* Details row */}
            <div
              data-testid="dispute-modal-details"
              className={
                "flex flex-col gap-2 px-4 py-3 rounded-lg border " +
                "border-border-subtle bg-surface-field"
              }
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs text-text-muted">Milestone</span>
                <span
                  data-testid="dispute-modal-milestone-label"
                  className="text-sm font-medium text-text-primary"
                >
                  {label}
                </span>
              </div>

              {milestoneAmount && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-text-muted">Amount at stake</span>
                  <span
                    data-testid="dispute-modal-amount"
                    className="text-sm font-mono text-text-primary"
                  >
                    {milestoneAmount}
                  </span>
                </div>
              )}
            </div>

            {/* Description — wired via aria-describedby */}
            <p
              id={descId}
              data-testid="dispute-modal-description"
              className="text-xs text-text-muted leading-relaxed"
            >
              An arbiter will review the dispute and decide whether to release
              the funds to the freelancer or return them to you. Make sure you
              have supporting evidence ready before proceeding.
            </p>
          </div>
        ) : (
          /* Empty / no-selection state (#333) */
          <EmptyStatePlaceholder />
        )}

        {/* ── TxStatusBanner ──────────────────────────────────────────── */}
        {disputeState && disputeState.phase !== "idle" && (
          <div className="mt-4" data-testid="dispute-modal-status-banner">
            <TxStatusBanner
              state={disputeState}
              successMessage="Dispute raised successfully. The arbiter has been notified."
            />
          </div>
        )}

        {/* ── Actions row ─────────────────────────────────────────────── */}
        <div
          data-testid="dispute-modal-actions"
          className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-6"
        >
          {/* Cancel */}
          <button
            type="button"
            data-testid="dispute-modal-cancel"
            onClick={onClose}
            disabled={isPending}
            aria-label="Cancel — do not raise dispute"
            aria-disabled={isPending}
            className={
              `${baseBtn} ` +
              "bg-surface-field text-text-secondary border border-border-subtle " +
              "hover:bg-border-subtle hover:text-text-primary " +
              "focus-visible:ring-accent-soft"
            }
          >
            Cancel
          </button>

          {/* Confirm */}
          <button
            type="button"
            data-testid="dispute-modal-confirm"
            onClick={onConfirm}
            disabled={isPending || !hasValidMilestone}
            aria-label={`Confirm raise dispute for ${label}`}
            aria-disabled={isPending || !hasValidMilestone}
            className={
              `${baseBtn} ` +
              "bg-danger text-text-primary border border-danger " +
              "hover:bg-danger-soft/20 hover:border-danger-soft " +
              "focus-visible:ring-danger-soft"
            }
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <ButtonSpinner />
                Raising dispute…
              </span>
            ) : (
              "Raise Dispute"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
