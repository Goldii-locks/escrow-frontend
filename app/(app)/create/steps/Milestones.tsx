"use client";

import { validateMilestoneAmount } from "@/app/lib/milestone_amount_validation";
import { isMilestoneCapReached, milestoneLimitHint } from "@/app/lib/milestone_limits";
import type { CreateJobForm } from "../useCreateJobForm";
import {
  addButtonClassName,
  EmptyCollectionState,
  inputClassName,
  removeButtonClassName,
  StepPanel,
} from "../ui";

/** Step 2: milestone amounts. */
export default function Milestones({ form }: { form: CreateJobForm }) {
  const { loading, setActiveSection } = form;
  const s = form.scope;
  const onFocus = () => setActiveSection("milestones");
  const showPartialWarning = s.hasPartialMilestones && !s.hasNoMilestones;

  return (
    <StepPanel
      id="milestones"
      title="Scope and release plan"
      description="Define the milestone amounts for this escrow."
      focusLabel="Focus Scope and Release Plan section"
      onActivate={onFocus}
    >
      <div className="space-y-5">
        <fieldset aria-describedby={showPartialWarning ? "milestone-warning" : undefined}>
          <legend className="block text-sm text-text-muted mb-2">Milestones</legend>
          <div className="mb-2 flex items-center justify-end">
            <button
              type="button"
              onClick={s.addMilestone}
              aria-label="Add milestone"
              disabled={isMilestoneCapReached(s.milestoneCount)}
              className={`${addButtonClassName} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              + Add Milestone
            </button>
          </div>
          <p className="mb-2 text-xs text-text-muted" data-testid="milestone-limit-hint">
            {milestoneLimitHint()}
          </p>
          {s.hasNoMilestones ? (
            <EmptyCollectionState
              title="No milestones available."
              description="Add your first milestone to define how funds should be released across the engagement."
              actionLabel="Add first milestone"
              onAction={s.addMilestone}
              testId="milestone-empty-state"
            />
          ) : (
            <ul
              className="space-y-2"
              data-testid="milestone-list"
              role="list"
              aria-label="Milestone amounts"
            >
              {s.milestones.map((m, i) => {
                const amountError = validateMilestoneAmount(m.amount);
                return (
                  <li key={i} className="flex flex-wrap gap-2 items-center animate-slide-in">
                    <input
                      id={`milestone-input-${i}`}
                      className={`${inputClassName} flex-1 min-w-0`}
                      value={m.amount}
                      onChange={(e) => s.updateMilestone(i, e.target.value)}
                      onFocus={onFocus}
                      placeholder={`Milestone ${i + 1} amount`}
                      aria-label={`Milestone ${i + 1} amount`}
                      aria-required="true"
                      type="text"
                      inputMode="decimal"
                      required
                      pattern="^[0-9]+(\.[0-9]+)?$"
                      aria-invalid={amountError !== null}
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => s.removeMilestone(i)}
                      aria-label={`Remove milestone ${i + 1}`}
                      className={removeButtonClassName}
                      disabled={loading}
                    >
                      ✕
                    </button>
                    {amountError && (
                      <p
                        role="alert"
                        className="basis-full text-xs text-danger-soft"
                        data-testid={`milestone-error-${i}`}
                      >
                        {amountError}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {/*
           * The warning paragraph is always rendered (empty when no error) so
           * AT registers the live region before content is injected, ensuring
           * reliable announcement.
           */}
          <p
            id="milestone-warning"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={`mt-2 text-xs text-warning-soft transition-opacity duration-150 ${
              showPartialWarning ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            {showPartialWarning ? "Complete each milestone amount to continue." : ""}
          </p>
        </fieldset>
      </div>
    </StepPanel>
  );
}
