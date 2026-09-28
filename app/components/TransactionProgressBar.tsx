"use client";

import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import {
  type StepItem,
  PROGRESS_BAR_THEME_CLASSES,
  PROGRESS_BAR_INTERACTIVE_CLASSES,
  PROGRESS_BAR_ANIMATION_CLASSES,
  PROGRESS_BAR_EMPTY_COPY,
  PROGRESS_BAR_PLACEHOLDER_CLASSES,
  MOBILE_OVERLAY_WRAPPER_CLASSES,
  getProgressAnnouncement,
  getProgressBarLayout,
  getProgressStepName,
  getProgressStepState,
  isProgressBarEmpty,
  validateProgressBarConfig,
  PROGRESS_STEP_STATE_LABEL,
} from "@/app/lib/transaction_progress_bar";
import { useTransactionProgressWidth } from "@/app/hooks/useTransactionProgressWidth";

export interface TransactionProgressBarProps {
  /**
   * Array of steps to display. Omitted → the default four-step flow. An
   * empty list (or `null`) means no transaction is in flight and renders a
   * descriptive placeholder instead of the step track.
   */
  steps?: StepItem[] | null;
  /** Active step index (0-based) */
  currentStepIndex?: number;
  /** Status of the active step: in-progress, completed, or failed */
  status?: "active" | "completed" | "failed";
  /** Optional interactive click handler when clicking a previous or current step */
  onStepClick?: (stepIndex: number) => void;
  /** Whether entire progress bar is disabled */
  disabled?: boolean;
  /** Explicit error message override to render in an alert */
  errorMessage?: string | null;
  /**
   * When true, renders inside a mobile overlay modal wrapper fitting constraints
   * on mobile device screen heights (Issue #416).
   */
  mobileOverlay?: boolean;
  /** Optional close callback when displayed in overlay mode; also fired by Escape. */
  onCloseOverlay?: () => void;
  className?: string;
}

export const DEFAULT_TRANSACTION_STEPS: StepItem[] = [
  { id: "prepare", title: "Prepare", description: "Fetch transaction quote and assemble payload" },
  { id: "sign", title: "Sign", description: "Approve transaction via connected wallet" },
  { id: "submit", title: "Submit", description: "Broadcast transaction to Stellar ledger" },
  { id: "confirm", title: "Confirm", description: "Verify ledger confirmation and state update" },
];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-soft)] " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-card)]";

/** Decorative SVG props: hidden from assistive tech and never focusable. */
const DECORATIVE_SVG = { "aria-hidden": true, focusable: false } as const;

/** Placeholder shown when there are no steps to track (Issue: empty data states). */
function ProgressBarPlaceholder({ titleId }: { titleId: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-labelledby={titleId}
      className={PROGRESS_BAR_PLACEHOLDER_CLASSES.container}
      data-testid="progress-bar-placeholder"
    >
      {/* Ghost track echoing the real step indicator, purely decorative */}
      <div
        aria-hidden="true"
        className={PROGRESS_BAR_PLACEHOLDER_CLASSES.track}
        data-testid="progress-bar-placeholder-track"
      >
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="flex items-center gap-2">
            {i > 0 && <span className={PROGRESS_BAR_PLACEHOLDER_CLASSES.trackLine} />}
            <span className={PROGRESS_BAR_PLACEHOLDER_CLASSES.trackDot} />
          </span>
        ))}
      </div>
      <p
        id={titleId}
        className={PROGRESS_BAR_PLACEHOLDER_CLASSES.title}
        data-testid="progress-bar-placeholder-title"
      >
        {PROGRESS_BAR_EMPTY_COPY.title}
      </p>
      <p
        className={PROGRESS_BAR_PLACEHOLDER_CLASSES.description}
        data-testid="progress-bar-placeholder-description"
      >
        {PROGRESS_BAR_EMPTY_COPY.description}
      </p>
    </div>
  );
}

export default function TransactionProgressBar({
  steps = DEFAULT_TRANSACTION_STEPS,
  currentStepIndex = 0,
  status = "active",
  onStepClick,
  disabled = false,
  errorMessage = null,
  mobileOverlay = false,
  onCloseOverlay,
  className = "",
}: TransactionProgressBarProps) {
  const viewportWidth = useTransactionProgressWidth();
  const baseId = useId();
  const ids = {
    overlayTitle: `${baseId}-overlay-title`,
    placeholderTitle: `${baseId}-placeholder-title`,
  };
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Move focus into the overlay dialog when it opens so keyboard users land
  // on its only control rather than behind the backdrop.
  useEffect(() => {
    if (mobileOverlay) closeButtonRef.current?.focus();
  }, [mobileOverlay]);

  const isEmpty = isProgressBarEmpty(steps);
  const stepList: StepItem[] = isEmpty ? [] : (steps as StepItem[]);

  // 1. Validation Check (Issue #414). An empty list is a normal "nothing in
  // flight" state handled by the placeholder, so it raises no alert.
  const validation = validateProgressBarConfig(stepList, currentStepIndex);
  const activeAlert = errorMessage || (isEmpty ? null : validation.alertMessage);
  const announcement = isEmpty
    ? null
    : getProgressAnnouncement(stepList, currentStepIndex, status);

  // 2. Responsive Layout (Issue #412, #416)
  const layout = getProgressBarLayout(viewportWidth, mobileOverlay);

  const content = (
    <div
      className={`rounded-xl border p-4 sm:p-6 ${PROGRESS_BAR_THEME_CLASSES.container} ${className}`}
      data-testid="transaction-progress-bar-container"
      data-viewport={layout.viewport}
      data-empty={isEmpty}
    >
      {/* Mobile Overlay Header if active */}
      {mobileOverlay && (
        <div className="flex items-center justify-between border-b border-[var(--color-border-strong)] pb-3 mb-4">
          <h2
            id={ids.overlayTitle}
            className={`text-sm font-bold ${PROGRESS_BAR_THEME_CLASSES.labelPrimary}`}
          >
            Transaction Status
          </h2>
          {onCloseOverlay && (
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onCloseOverlay}
              className={`min-h-[44px] min-w-[44px] rounded px-2 py-1 text-xs transition-colors bg-[var(--color-surface-field)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] ${FOCUS_RING}`}
              aria-label="Close transaction overlay"
            >
              Close <span aria-hidden="true">✕</span>
            </button>
          )}
        </div>
      )}

      {/* Validation Alert with Micro-animation shake (Issue #414, #415) */}
      {activeAlert && (
        <div
          role="alert"
          aria-live="assertive"
          className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-xs font-medium ${PROGRESS_BAR_THEME_CLASSES.alertError} ${PROGRESS_BAR_ANIMATION_CLASSES.errorAlert}`}
          data-testid="progress-bar-validation-alert"
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...DECORATIVE_SVG}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{activeAlert}</span>
        </div>
      )}

      {isEmpty ? (
        <ProgressBarPlaceholder titleId={ids.placeholderTitle} />
      ) : (
        <>
          {/* Polite live region: announces step and status changes */}
          <p
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-testid="progress-bar-announcement"
          >
            {announcement}
          </p>

          {/* Steps Flow (Issue #417, #412, #411, #415) */}
          <ol
            className={`flex ${
              layout.stackSteps ? "flex-col space-y-4" : "flex-row items-center justify-between"
            }`}
            aria-label="Transaction progress steps"
          >
            {stepList.map((step, idx) => {
              const state = getProgressStepState(idx, currentStepIndex, status);
              const isCompleted = state === "completed";
              const isActive = state === "active";
              const isFailed = state === "failed";
              const isCurrent = idx === currentStepIndex;
              const stepName = getProgressStepName(step.title, idx, stepList.length, state);
              const descriptionId = `${baseId}-step-${idx}-description`;
              const showDescription = layout.showDescriptions && Boolean(step.description);

              let stepThemeClass: string = PROGRESS_BAR_THEME_CLASSES.stepDefault;
              if (isActive) stepThemeClass = `${PROGRESS_BAR_THEME_CLASSES.stepActive} ${PROGRESS_BAR_ANIMATION_CLASSES.activePulse}`;
              else if (isCompleted) stepThemeClass = `${PROGRESS_BAR_THEME_CLASSES.stepCompleted} ${PROGRESS_BAR_ANIMATION_CLASSES.completedCheck}`;
              else if (isFailed) stepThemeClass = PROGRESS_BAR_THEME_CLASSES.stepFailed;

              // Steps are only controls when a click handler exists; otherwise
              // they are static indicators and stay out of the tab order.
              const isInteractive = Boolean(onStepClick);
              const isClickable = !disabled && isInteractive && idx <= currentStepIndex;
              const interactiveClass = isClickable
                ? `${PROGRESS_BAR_INTERACTIVE_CLASSES.stepInteractive} ${PROGRESS_BAR_ANIMATION_CLASSES.stepHover}`
                : disabled
                ? PROGRESS_BAR_INTERACTIVE_CLASSES.stepDisabled
                : "";
              const nodeClass = `relative z-10 flex shrink-0 items-center justify-center rounded-full border font-semibold ${layout.indicatorSizeClass} ${stepThemeClass} ${interactiveClass} ${PROGRESS_BAR_ANIMATION_CLASSES.nodeTransition}`;

              const nodeContent = isCompleted ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...DECORATIVE_SVG}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : isFailed ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" {...DECORATIVE_SVG}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <span aria-hidden="true">{idx + 1}</span>
              );

              return (
                <li
                  key={step.id || idx}
                  className={`flex ${layout.stackSteps ? "items-start gap-3" : "flex-1 flex-col items-center"} relative`}
                  data-testid={`progress-step-${idx}`}
                  data-state={state}
                  // Interactive steps mark the button instead, since that is
                  // what receives focus.
                  aria-current={isCurrent && !isInteractive ? "step" : undefined}
                >
                  {/* Connector line for horizontal desktop/tablet */}
                  {!layout.stackSteps && idx > 0 && (
                    <div
                      aria-hidden="true"
                      className={`absolute top-4 sm:top-5 -left-1/2 w-full h-0.5 -z-0 transition-colors duration-300 ${
                        isCompleted || isActive
                          ? PROGRESS_BAR_THEME_CLASSES.connectorCompleted
                          : PROGRESS_BAR_THEME_CLASSES.connectorDefault
                      }`}
                    />
                  )}

                  {/* Step indicator node with micro-animation transitions */}
                  {isInteractive ? (
                    <button
                      type="button"
                      disabled={disabled || !isClickable}
                      onClick={() => isClickable && onStepClick?.(idx)}
                      aria-current={isCurrent ? "step" : undefined}
                      aria-label={stepName}
                      aria-describedby={showDescription ? descriptionId : undefined}
                      className={nodeClass}
                      data-testid={`step-node-${idx}`}
                      data-state={state}
                    >
                      {nodeContent}
                    </button>
                  ) : (
                    <span
                      aria-hidden="true"
                      className={nodeClass}
                      data-testid={`step-node-${idx}`}
                      data-state={state}
                    >
                      {nodeContent}
                    </span>
                  )}

                  {/* Step Label and Description. For interactive steps the
                      button carries the name, so the visible title is hidden
                      from AT to avoid reading it twice. */}
                  <div className={`${layout.stackSteps ? "text-left" : "mt-2 text-center"}`}>
                    <div
                      aria-hidden={isInteractive ? true : undefined}
                      className={`text-xs font-semibold ${
                        isActive
                          ? PROGRESS_BAR_THEME_CLASSES.labelPrimary
                          : isCompleted
                          ? PROGRESS_BAR_THEME_CLASSES.labelSecondary
                          : PROGRESS_BAR_THEME_CLASSES.labelMuted
                      }`}
                    >
                      {!isInteractive && (
                        <span className="sr-only">{`Step ${idx + 1} of ${stepList.length}: `}</span>
                      )}
                      {step.title}
                      {!isInteractive && (
                        <span className="sr-only">{`, ${PROGRESS_STEP_STATE_LABEL[state]}`}</span>
                      )}
                    </div>
                    {showDescription && (
                      <div
                        id={descriptionId}
                        className={`mt-0.5 text-[10px] leading-tight ${PROGRESS_BAR_THEME_CLASSES.labelMuted}`}
                      >
                        {step.description}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );

  // Mobile Viewport Navigation Overlay Wrapper (Issue #416)
  if (mobileOverlay) {
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape" && onCloseOverlay) {
        event.stopPropagation();
        onCloseOverlay();
      }
    };

    return (
      <div
        className={MOBILE_OVERLAY_WRAPPER_CLASSES.backdrop}
        data-testid="mobile-overlay-wrapper"
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.overlayTitle}
        onKeyDown={handleKeyDown}
      >
        <div className={MOBILE_OVERLAY_WRAPPER_CLASSES.panel}>{content}</div>
      </div>
    );
  }

  return content;
}
