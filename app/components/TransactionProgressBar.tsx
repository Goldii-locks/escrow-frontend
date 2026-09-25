"use client";

import {
  type StepItem,
  PROGRESS_BAR_THEME_CLASSES,
  PROGRESS_BAR_INTERACTIVE_CLASSES,
  getProgressBarLayout,
  validateProgressBarConfig,
} from "@/app/lib/transaction_progress_bar";
import { useTransactionProgressWidth } from "@/app/hooks/useTransactionProgressWidth";

export interface TransactionProgressBarProps {
  /** Array of steps to display */
  steps?: StepItem[];
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
  className?: string;
}

export const DEFAULT_TRANSACTION_STEPS: StepItem[] = [
  { id: "prepare", title: "Prepare", description: "Fetch transaction quote and assemble payload" },
  { id: "sign", title: "Sign", description: "Approve transaction via connected wallet" },
  { id: "submit", title: "Submit", description: "Broadcast transaction to Stellar ledger" },
  { id: "confirm", title: "Confirm", description: "Verify ledger confirmation and state update" },
];

export default function TransactionProgressBar({
  steps = DEFAULT_TRANSACTION_STEPS,
  currentStepIndex = 0,
  status = "active",
  onStepClick,
  disabled = false,
  errorMessage = null,
  className = "",
}: TransactionProgressBarProps) {
  const viewportWidth = useTransactionProgressWidth();

  // 1. Validation Check (Issue #414)
  const validation = validateProgressBarConfig(steps, currentStepIndex);
  const activeAlert = errorMessage || validation.alertMessage;

  // 2. Responsive Layout (Issue #412)
  const layout = getProgressBarLayout(viewportWidth);

  return (
    <div
      className={`rounded-xl border p-4 sm:p-6 ${PROGRESS_BAR_THEME_CLASSES.container} ${className}`}
      data-testid="transaction-progress-bar-container"
      data-viewport={layout.viewport}
    >
      {/* Validation Message / Alert (Issue #414) */}
      {activeAlert && (
        <div
          role="alert"
          aria-live="assertive"
          className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-xs font-medium ${PROGRESS_BAR_THEME_CLASSES.alertError}`}
          data-testid="progress-bar-validation-alert"
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

      {/* Steps Flow (Issue #417, #412, #411) */}
      <ol
        className={`flex ${
          layout.stackSteps ? "flex-col space-y-4" : "flex-row items-center justify-between"
        }`}
        aria-label="Transaction progress steps"
      >
        {steps.map((step, idx) => {
          const isCompleted = idx < currentStepIndex || (idx === currentStepIndex && status === "completed");
          const isActive = idx === currentStepIndex && status === "active";
          const isFailed = idx === currentStepIndex && status === "failed";
          const isPending = idx > currentStepIndex;

          let stepThemeClass: string = PROGRESS_BAR_THEME_CLASSES.stepDefault;
          if (isActive) stepThemeClass = PROGRESS_BAR_THEME_CLASSES.stepActive;
          else if (isCompleted) stepThemeClass = PROGRESS_BAR_THEME_CLASSES.stepCompleted;
          else if (isFailed) stepThemeClass = PROGRESS_BAR_THEME_CLASSES.stepFailed;

          const isClickable = !disabled && Boolean(onStepClick) && idx <= currentStepIndex;
          const interactiveClass = isClickable
            ? PROGRESS_BAR_INTERACTIVE_CLASSES.stepInteractive
            : disabled
            ? PROGRESS_BAR_INTERACTIVE_CLASSES.stepDisabled
            : "";

          return (
            <li
              key={step.id || idx}
              className={`flex ${layout.stackSteps ? "items-start gap-3" : "flex-1 flex-col items-center"} relative`}
              data-testid={`progress-step-${idx}`}
            >
              {/* Connector line for horizontal desktop/tablet */}
              {!layout.stackSteps && idx > 0 && (
                <div
                  aria-hidden="true"
                  className={`absolute top-4 sm:top-5 -left-1/2 w-full h-0.5 -z-0 transition-colors ${
                    isCompleted || isActive
                      ? PROGRESS_BAR_THEME_CLASSES.connectorCompleted
                      : PROGRESS_BAR_THEME_CLASSES.connectorDefault
                  }`}
                />
              )}

              {/* Step indicator node */}
              <button
                type="button"
                disabled={disabled || !isClickable}
                onClick={() => isClickable && onStepClick?.(idx)}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Step ${idx + 1}: ${step.title}`}
                className={`relative z-10 flex shrink-0 items-center justify-center rounded-full border font-semibold ${layout.indicatorSizeClass} ${stepThemeClass} ${interactiveClass}`}
                data-testid={`step-node-${idx}`}
              >
                {isCompleted ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : isFailed ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <span>{idx + 1}</span>
                )}
              </button>

              {/* Step Label and Description */}
              <div className={`${layout.stackSteps ? "text-left" : "mt-2 text-center"}`}>
                <div
                  className={`text-xs font-semibold ${
                    isActive
                      ? PROGRESS_BAR_THEME_CLASSES.labelPrimary
                      : isCompleted
                      ? PROGRESS_BAR_THEME_CLASSES.labelSecondary
                      : PROGRESS_BAR_THEME_CLASSES.labelMuted
                  }`}
                >
                  {step.title}
                </div>
                {layout.showDescriptions && step.description && (
                  <div className={`mt-0.5 text-[10px] leading-tight ${PROGRESS_BAR_THEME_CLASSES.labelMuted}`}>
                    {step.description}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
