"use client";

import { agreementLines } from "@/app/lib/escrow_agreement";
import type { CreateJobForm } from "../useCreateJobForm";
import { StepPanel } from "../ui";

/** Step 3: counts of what's been entered, the escrow rules and the agreement. */
export default function Review({ form }: { form: CreateJobForm }) {
  const { loading, setActiveSection } = form;
  const r = form.review;
  const counts = [
    { label: "Accepted assets", value: r.assetCount },
    { label: "Requirements", value: r.requirementCount },
    { label: "Milestones", value: r.milestoneCount },
  ];

  return (
    <StepPanel
      id="review"
      title="Review"
      description="Confirm the job has enough structure before sending the transaction."
      focusLabel="Focus Review section"
      onActivate={() => setActiveSection("review")}
    >
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3" data-testid="review-summary">
        {counts.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-border-subtle bg-surface-field px-4 py-3"
          >
            <dt className="text-text-muted">{label}</dt>
            <dd className="mt-1 font-medium text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>

      {/*
       * "What you're agreeing to" panel (issue #669). A plain-language summary
       * of the escrow rules generated from the form values and the contract's
       * fixed rules. The wording lives in app/lib/escrow_agreement.ts so it
       * can be updated alongside the contract. The required checkbox below
       * gates the Create button.
       */}
      <div
        className="mt-5 rounded-xl border border-border-subtle bg-surface-field p-4"
        data-testid="agreement-panel"
      >
        <h3 className="text-sm font-semibold text-text-primary">What you&rsquo;re agreeing to</h3>
        <ul className="mt-3 space-y-2 text-xs leading-5 text-text-secondary">
          {agreementLines({ autoReleaseDays: r.autoReleaseDays, arbiter: r.arbiter }).map(
            (line) => (
              <li key={line.label} className="flex gap-2">
                <span className="font-semibold text-text-primary shrink-0">{line.label}:</span>
                <span>{line.text}</span>
              </li>
            )
          )}
        </ul>
        <label className="mt-4 flex items-start gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={r.agreed}
            onChange={(e) => r.setAgreed(e.target.checked)}
            disabled={loading}
            aria-required="true"
            data-testid="agreement-checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border-subtle accent-accent"
          />
          <span>I have read and understand the escrow rules above before creating this job.</span>
        </label>
      </div>
    </StepPanel>
  );
}
