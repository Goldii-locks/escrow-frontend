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

/**
 * A free-text list (accepted assets, requirements): a group label, an add
 * button, then either an empty state or one input + remove button per row.
 * The <span> labels the group visually; each input carries its own
 * aria-label so no htmlFor is needed.
 */
function TextListField({
  name,
  labelId,
  label,
  itemLabel,
  addLabel,
  addText,
  empty,
  items,
  onAdd,
  onRemove,
  onUpdate,
  onFocus,
  disabled,
}: {
  /** Prefix for ids and test ids: "asset", "requirement". */
  name: string;
  labelId: string;
  label: string;
  /** Per-row label, numbered from 1: "Accepted asset", "Requirement". */
  itemLabel: string;
  addLabel: string;
  addText: string;
  empty: { title: string; description: string; actionLabel: string };
  items: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, value: string) => void;
  onFocus: () => void;
  disabled: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span id={labelId} className="block text-sm text-text-muted">
          {label}
        </span>
        <button type="button" onClick={onAdd} aria-label={addLabel} className={addButtonClassName}>
          {addText}
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyCollectionState {...empty} onAction={onAdd} testId={`${name}-empty-state`} />
      ) : (
        <div
          className="space-y-2"
          data-testid={`${name}-list`}
          role="group"
          aria-labelledby={labelId}
        >
          {items.map((item, index) => (
            <div key={`${name}-${index}`} className="flex items-center gap-2">
              <input
                id={`${name}-input-${index}`}
                className={`${inputClassName} flex-1 min-w-0`}
                value={item}
                onChange={(e) => onUpdate(index, e.target.value)}
                onFocus={onFocus}
                placeholder={`${itemLabel} ${index + 1}`}
                aria-label={`${itemLabel} ${index + 1}`}
                disabled={disabled}
              />
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
                className={removeButtonClassName}
                disabled={disabled}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Step 2: accepted assets, delivery requirements and milestone amounts. */
export default function Milestones({ form }: { form: CreateJobForm }) {
  const { loading, setActiveSection } = form;
  const s = form.scope;
  const onFocus = () => setActiveSection("milestones");
  const showPartialWarning = s.hasPartialMilestones && !s.hasNoMilestones;

  return (
    <StepPanel
      id="milestones"
      title="Scope and release plan"
      description="Document what will be funded and what completion requires."
      focusLabel="Focus Scope and Release Plan section"
      onActivate={onFocus}
    >
      <div className="space-y-5">
        <TextListField
          name="asset"
          labelId="accepted-assets-label"
          label="Accepted assets"
          itemLabel="Accepted asset"
          addLabel="Add accepted asset"
          addText="+ Add Asset"
          empty={{
            title: "No accepted assets selected",
            description:
              "List the token symbols or contract addresses this job can be funded with so contributors know the expected payment rails.",
            actionLabel: "Add accepted asset",
          }}
          items={s.acceptedAssets}
          onAdd={s.addAcceptedAsset}
          onRemove={s.removeAcceptedAsset}
          onUpdate={s.updateAcceptedAsset}
          onFocus={onFocus}
          disabled={loading}
        />

        <TextListField
          name="requirement"
          labelId="requirements-label"
          label="Requirements"
          itemLabel="Requirement"
          addLabel="Add requirement"
          addText="+ Add Requirement"
          empty={{
            title: "No delivery requirements added",
            description:
              "Capture acceptance criteria, references, or handoff notes so the freelancer and approver share the same definition of done.",
            actionLabel: "Add first requirement",
          }}
          items={s.requirements}
          onAdd={s.addRequirement}
          onRemove={s.removeRequirement}
          onUpdate={s.updateRequirement}
          onFocus={onFocus}
          disabled={loading}
        />

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
                      placeholder={`Milestone ${i + 1} amount (stroops)`}
                      aria-label={`Milestone ${i + 1} amount in stroops`}
                      aria-required="true"
                      type="text"
                      inputMode="numeric"
                      required
                      pattern="^[0-9]+$"
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
