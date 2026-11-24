"use client";

import Link from "next/link";
import type { CreateJobForm } from "../useCreateJobForm";
import { buttonClassName, inputClassName, StepPanel } from "../ui";
import TokenField from "./TokenField";

const DEADLINE_PRESETS = [3, 7, 14, 30];

/** Step 1: counterparties, token and the auto-release deadline. */
export default function Details({ form }: { form: CreateJobForm }) {
  const { loading, setActiveSection } = form;
  const d = form.details;
  const onFocus = () => setActiveSection("details");

  return (
    <StepPanel
      id="details"
      title="Job details"
      description="Specify the counterparties and core escrow timing."
      focusLabel="Focus Job Details section"
      onActivate={onFocus}
    >
      <div className="space-y-4">
        {/* Freelancer Address */}
        <div>
          <label htmlFor="freelancer-address" className="block text-sm text-text-muted mb-1">
            Freelancer Address
          </label>
          <input
            id="freelancer-address"
            type="text"
            autoComplete="off"
            spellCheck={false}
            aria-required="true"
            className={`${inputClassName} ${d.freelancerError ? "!border-danger" : ""}`}
            value={d.freelancer}
            onChange={(e) => d.changeFreelancer(e.target.value)}
            onBlur={(e) => d.blurFreelancer(e.target.value)}
            onFocus={onFocus}
            placeholder="G..."
            required
            disabled={loading}
          />
          {d.freelancerError && (
            <p className="text-sm text-danger-soft mt-1">{d.freelancerError}</p>
          )}
        </div>

        {/* Arbiter Address */}
        <div>
          {d.defaultArbiter && (
            <fieldset className="mb-3" disabled={loading}>
              <legend className="block text-sm text-text-muted mb-1">Arbiter</legend>
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="radio"
                  name="arbiter-mode"
                  value="default"
                  checked={d.arbiterMode === "default"}
                  onChange={() => d.chooseArbiterMode("default")}
                />
                Milesto arbitration (recommended)
              </label>
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="radio"
                  name="arbiter-mode"
                  value="custom"
                  checked={d.arbiterMode === "custom"}
                  onChange={() => d.chooseArbiterMode("custom")}
                />
                Custom address
              </label>
            </fieldset>
          )}
          <p className="text-xs text-text-muted mb-2">
            The arbiter resolves disputes and can split or refund escrowed funds.{" "}
            <Link href="/#security" className="underline hover:text-text-primary">
              Learn more
            </Link>
          </p>
          {d.arbiterMode === "custom" && (
            <>
              <label htmlFor="arbiter-address" className="block text-sm text-text-muted mb-1">
                Arbiter Address
              </label>
              <input
                id="arbiter-address"
                type="text"
                autoComplete="off"
                spellCheck={false}
                aria-required="true"
                className={`${inputClassName} ${d.arbiterError ? "!border-danger" : ""}`}
                value={d.arbiter}
                onChange={(e) => d.changeArbiter(e.target.value)}
                onBlur={(e) => d.blurArbiter(e.target.value)}
                onFocus={onFocus}
                placeholder="G..."
                required
                disabled={loading}
              />
            </>
          )}
          {d.arbiterError && <p className="text-sm text-danger-soft mt-1">{d.arbiterError}</p>}
        </div>

        <TokenField form={form} />

        {/* Response Deadline */}
        <div>
          <label htmlFor="response-deadline" className="block text-sm text-text-muted mb-1">
            Response Deadline (days)
          </label>
          <div role="group" aria-label="Deadline presets" className="mb-2 flex flex-wrap gap-2">
            {DEADLINE_PRESETS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => d.changeDeadline(String(days))}
                disabled={loading}
                className={`${buttonClassName} border px-3 py-1.5 text-xs ${
                  d.autoReleaseDays === String(days)
                    ? "border-accent-soft bg-accent/10 text-text-primary"
                    : "border-border-subtle bg-surface-card text-text-secondary hover:border-accent-soft"
                }`}
              >
                {days} days
              </button>
            ))}
          </div>
          <input
            id="response-deadline"
            type="number"
            min="1"
            aria-required="true"
            className={`${inputClassName} ${d.deadlineError ? "!border-danger" : ""}`}
            value={d.autoReleaseDays}
            onChange={(e) => d.changeDeadline(e.target.value)}
            onBlur={d.blurDeadline}
            onFocus={onFocus}
            required
            disabled={loading}
            aria-invalid={!!d.deadlineError}
            aria-describedby={d.deadlineError ? "deadline-error" : "deadline-hint"}
          />
          {d.deadlineError ? (
            <p
              id="deadline-error"
              role="alert"
              aria-live="polite"
              className="mt-1 text-xs text-danger-soft"
            >
              {d.deadlineError}
            </p>
          ) : (
            <p id="deadline-hint" className="mt-1 text-xs text-text-disabled">
              Funds auto-release after this many days if no dispute is raised.
            </p>
          )}
          {!d.deadlineError && (
            <p className="mt-1 text-xs text-text-muted">
              Freelancer can claim funds automatically after {d.autoReleaseDays}{" "}
              {d.autoReleaseDays === "1" ? "day" : "days"} if you do not respond.
            </p>
          )}
        </div>
      </div>
    </StepPanel>
  );
}
