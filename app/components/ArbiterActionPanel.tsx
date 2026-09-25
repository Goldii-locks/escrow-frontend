"use client";

import { useId, useState } from "react";
import type { ActionState } from "@/app/hooks/useActionStates";
import { useArbiterPanelViewport } from "@/app/hooks/useArbiterPanelViewport";
import {
  ARBITER_EMPTY_COPY,
  ARBITER_PANEL_CLASSES,
  ARBITER_PANEL_MOTION,
  ARBITER_SUBMIT_TONE,
  getArbiterPanelConfigError,
  getArbiterPanelLayout,
  getArbiterPanelState,
  isValidMilestoneIndex,
  validateArbiterResolution,
  type ArbiterEmptyVariant,
  type ArbiterFieldErrors,
  type ArbiterOutcome,
} from "@/app/lib/arbiter_action_panel";
import ButtonSpinner from "./ButtonSpinner";
import TxStatusBanner from "./TxStatusBanner";

export interface ArbiterActionPanelProps {
  /**
   * Zero-based milestone index under dispute. Displayed one-based. A missing
   * or invalid index renders the "no dispute selected" placeholder.
   */
  milestoneIndex?: number | null;
  /** Disputed amount, pre-formatted for display (e.g. "30 XLM"). */
  displayAmount?: string | null;
  /**
   * Funds still in escrow for the milestone, in base units. A value of zero
   * or less blocks resolution with a panel-level alert.
   */
  escrowAmount?: string | null;
  /** Called once the resolution passes validation. */
  onResolve?: (index: number, releaseToFreelancer: boolean) => void;
  /** Whether a resolve transaction is in flight. */
  isPending?: boolean;
  /** Transaction state for the resolve call; shown once it leaves `idle`. */
  resolveState?: ActionState | null;
  /** Externally supplied panel-level error (e.g. a provider failure). */
  errorMessage?: string | null;
  className?: string;
}

const OUTCOMES: ReadonlyArray<{
  value: ArbiterOutcome;
  label: string;
  hint: string;
}> = [
  {
    value: "release",
    label: "Release to Freelancer",
    hint: "Pay the disputed funds to the freelancer.",
  },
  {
    value: "refund",
    label: "Refund to Client",
    hint: "Return the disputed funds to the client.",
  },
];

export interface ArbiterPanelPlaceholderProps {
  variant: ArbiterEmptyVariant;
  className?: string;
}

/**
 * Descriptive placeholder for the arbiter's empty data states: no milestone
 * handed to the panel, a job with no disputed milestones, or a job with no
 * milestones at all. Announced politely as a status, never as an error.
 */
export function ArbiterPanelPlaceholder({
  variant,
  className = "",
}: ArbiterPanelPlaceholderProps) {
  const copy = ARBITER_EMPTY_COPY[variant];
  const titleId = `${useId()}-title`;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-labelledby={titleId}
      data-testid="arbiter-panel-placeholder"
      data-variant={variant}
      className={`${ARBITER_PANEL_CLASSES.placeholder} ${ARBITER_PANEL_MOTION.enter} ${className}`}
    >
      <span aria-hidden="true" className={ARBITER_PANEL_CLASSES.placeholderIcon}>
        {copy.icon}
      </span>
      <p
        id={titleId}
        data-testid="arbiter-panel-placeholder-title"
        className={ARBITER_PANEL_CLASSES.placeholderTitle}
      >
        {copy.title}
      </p>
      <p
        data-testid="arbiter-panel-placeholder-description"
        className={ARBITER_PANEL_CLASSES.placeholderDescription}
      >
        {copy.description}
      </p>
    </div>
  );
}

/**
 * Arbiter dispute resolution panel.
 *
 * The arbiter picks an outcome from a native radio group (so arrow keys move
 * between options) and ticks a finality confirmation before submitting. Both
 * are validated on submit: each failing field gets an inline message linked
 * through `aria-describedby`, and is flagged with `aria-invalid`. Problems with
 * the panel's own configuration (no handler, no funds left) render as a
 * panel-level alert and disable the controls.
 *
 * Layout is mobile-first: outcomes stack in one column with a full-width
 * submit button on phones, and sit side by side with an auto-width button
 * from `sm:` upward. On mobile the panel doubles as an overlay wrapper capped
 * to the screen height: its body scrolls and the submit bar is pinned to the
 * bottom, so the button stays tappable on short screens.
 *
 * Interactions animate subtly (see `ARBITER_PANEL_MOTION`), and every
 * animation is dropped under `prefers-reduced-motion`.
 */
export default function ArbiterActionPanel(props: ArbiterActionPanelProps) {
  if (!isValidMilestoneIndex(props.milestoneIndex)) {
    return <ArbiterPanelPlaceholder variant="no-milestone" className={props.className} />;
  }
  return <ArbiterActionPanelBody {...props} milestoneIndex={props.milestoneIndex} />;
}

function ArbiterActionPanelBody({
  milestoneIndex,
  displayAmount = null,
  escrowAmount = null,
  onResolve,
  isPending = false,
  resolveState = null,
  errorMessage = null,
  className = "",
}: ArbiterActionPanelProps & { milestoneIndex: number }) {
  const layout = getArbiterPanelLayout(useArbiterPanelViewport());
  const baseId = useId();
  const ids = {
    heading: `${baseId}-heading`,
    description: `${baseId}-description`,
    alert: `${baseId}-alert`,
    outcomeError: `${baseId}-outcome-error`,
    confirm: `${baseId}-confirm`,
    confirmError: `${baseId}-confirm-error`,
  };

  const [outcome, setOutcome] = useState<ArbiterOutcome | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ArbiterFieldErrors>({});
  // Bumped on every failed submit and used as a key on the error text, so
  // its entrance animation replays each time instead of only the first.
  const [failedAttempts, setFailedAttempts] = useState(0);

  const milestoneNumber = milestoneIndex + 1;
  const configError = getArbiterPanelConfigError({
    hasHandler: typeof onResolve === "function",
    escrowAmount,
  });
  const panelError = configError ?? errorMessage;
  const controlsDisabled = isPending || configError !== null;
  const panelState = getArbiterPanelState({
    isPending,
    configError,
    fieldErrors,
    outcome,
    confirmed,
  });

  function handleOutcomeChange(value: ArbiterOutcome) {
    setOutcome(value);
    setFieldErrors(({ outcome: _cleared, ...rest }) => {
      void _cleared;
      return rest;
    });
  }

  function handleConfirmChange(value: boolean) {
    setConfirmed(value);
    if (value) {
      setFieldErrors(({ confirmation: _cleared, ...rest }) => {
        void _cleared;
        return rest;
      });
    }
  }

  function handleSubmit() {
    if (controlsDisabled) return;
    const result = validateArbiterResolution({ outcome, confirmed });
    setFieldErrors(result.errors);
    if (!result.valid || outcome === null) {
      setFailedAttempts((n) => n + 1);
      return;
    }
    onResolve?.(milestoneIndex, outcome === "release");
  }

  const submitLabel = isPending
    ? outcome === "refund"
      ? "Refunding..."
      : "Releasing..."
    : outcome === "release"
      ? "Release to Freelancer"
      : outcome === "refund"
        ? "Refund to Client"
        : "Resolve Dispute";

  return (
    <section
      data-testid="arbiter-action-panel"
      data-viewport={layout.viewport}
      data-constrained={layout.constrainHeight}
      data-state={panelState}
      aria-labelledby={ids.heading}
      aria-describedby={ids.description}
      aria-busy={isPending}
      className={`${ARBITER_PANEL_CLASSES.container} ${ARBITER_PANEL_MOTION.enter} ${ARBITER_PANEL_MOTION.stateTint} ${className}`}
    >
      <div
        data-testid="arbiter-panel-scroll"
        className={ARBITER_PANEL_CLASSES.scrollableContent}
      >
        <h3 id={ids.heading} className={ARBITER_PANEL_CLASSES.title}>
          Resolve dispute — Milestone {milestoneNumber}
        </h3>
        <p id={ids.description} className={ARBITER_PANEL_CLASSES.description}>
          {displayAmount
            ? `Decide where the disputed ${displayAmount} goes. `
            : "Decide where the disputed funds go. "}
          This decision is final and cannot be undone.
        </p>

        {panelError && (
          <div
            id={ids.alert}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            data-testid="arbiter-panel-alert"
            className={`${ARBITER_PANEL_CLASSES.alert} ${ARBITER_PANEL_MOTION.alert}`}
          >
            {panelError}
          </div>
        )}

        <fieldset
          data-testid="arbiter-outcome-fieldset"
          aria-invalid={fieldErrors.outcome ? true : undefined}
          aria-describedby={fieldErrors.outcome ? ids.outcomeError : undefined}
          aria-required="true"
          disabled={controlsDisabled}
          className={ARBITER_PANEL_CLASSES.fieldset}
        >
          <legend className="mb-2 text-xs font-medium text-text-secondary">
            Outcome
          </legend>
          <div
            data-testid="arbiter-outcome-grid"
            data-columns={layout.outcomeColumns}
            className={ARBITER_PANEL_CLASSES.outcomeGrid}
          >
            {OUTCOMES.map((option) => (
              <label
                key={option.value}
                data-testid={`arbiter-outcome-${option.value}`}
                data-checked={outcome === option.value}
                className={`${ARBITER_PANEL_CLASSES.outcomeOption} ${
                  fieldErrors.outcome ? ARBITER_PANEL_CLASSES.outcomeOptionInvalid : ""
                }`}
              >
                <input
                  type="radio"
                  name={`${baseId}-outcome`}
                  value={option.value}
                  checked={outcome === option.value}
                  onChange={() => handleOutcomeChange(option.value)}
                  aria-label={`${option.label} for Milestone ${milestoneNumber}`}
                  className={ARBITER_PANEL_CLASSES.radio}
                />
                <span className="min-w-0">
                  <span className="block font-medium">{option.label}</span>
                  <span className="block text-xs text-text-muted">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {fieldErrors.outcome && (
            <p
              key={`outcome-error-${failedAttempts}`}
              id={ids.outcomeError}
              role="alert"
              aria-live="polite"
              data-testid="arbiter-outcome-error"
              className={`mt-1 ${ARBITER_PANEL_CLASSES.fieldError} ${ARBITER_PANEL_MOTION.fieldError}`}
            >
              {fieldErrors.outcome}
            </p>
          )}
        </fieldset>

        <div>
          <label htmlFor={ids.confirm} className={ARBITER_PANEL_CLASSES.confirmRow}>
            <input
              id={ids.confirm}
              type="checkbox"
              data-testid="arbiter-confirm-checkbox"
              checked={confirmed}
              disabled={controlsDisabled}
              onChange={(e) => handleConfirmChange(e.target.checked)}
              aria-required="true"
              aria-invalid={fieldErrors.confirmation ? true : undefined}
              aria-describedby={fieldErrors.confirmation ? ids.confirmError : undefined}
              className={ARBITER_PANEL_CLASSES.checkbox}
            />
            <span>I understand this decision is final.</span>
          </label>
          {fieldErrors.confirmation && (
            <p
              key={`confirm-error-${failedAttempts}`}
              id={ids.confirmError}
              role="alert"
              aria-live="polite"
              data-testid="arbiter-confirm-error"
              className={`${ARBITER_PANEL_CLASSES.fieldError} ${ARBITER_PANEL_MOTION.fieldError}`}
            >
              {fieldErrors.confirmation}
            </p>
          )}
        </div>

        {resolveState && resolveState.phase !== "idle" && (
          <div
            data-testid="arbiter-panel-status"
            className={ARBITER_PANEL_MOTION.status}
          >
            <TxStatusBanner
              state={resolveState}
              successMessage="Dispute resolved successfully. Funds have been distributed."
            />
          </div>
        )}
      </div>

      <div
        data-testid="arbiter-panel-actions"
        data-stacked={layout.stackActions}
        data-full-width={layout.fullWidthActions}
        data-sticky={layout.constrainHeight}
        className={`${ARBITER_PANEL_CLASSES.actions} ${ARBITER_PANEL_CLASSES.stickyFooter}`}
      >
        <button
          type="button"
          onClick={handleSubmit}
          disabled={controlsDisabled}
          aria-disabled={controlsDisabled}
          aria-describedby={panelError ? ids.alert : undefined}
          data-testid="arbiter-submit"
          className={`${ARBITER_PANEL_CLASSES.submit} ${ARBITER_SUBMIT_TONE[outcome ?? "none"]}`}
        >
          {isPending && <ButtonSpinner />}
          <span
            key={submitLabel}
            data-testid="arbiter-submit-label"
            className={ARBITER_PANEL_MOTION.labelSwap}
          >
            {submitLabel}
          </span>
        </button>
      </div>
    </section>
  );
}
