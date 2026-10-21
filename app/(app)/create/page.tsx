"use client";

import Navbar from "@/app/components/Navbar";
import ButtonSpinner from "@/app/components/ButtonSpinner";
import TxStatusBanner from "@/app/components/TxStatusBanner";
import { getPhaseLabel } from "@/app/lib/transactions";
import Details from "./steps/Details";
import Milestones from "./steps/Milestones";
import Review from "./steps/Review";
import SuccessScreen from "./SuccessScreen";
import { buttonClassName } from "./ui";
import { useCreateJobForm } from "./useCreateJobForm";
import WizardTabs from "./WizardTabs";

/**
 * The create-job wizard. State, validation and submission live in
 * useCreateJobForm / validation.ts / submit.ts; this page only composes the
 * steps (#621).
 */
export default function CreateJob() {
  const form = useCreateJobForm();
  const { address, loading, phase, error, txHash } = form;

  if (txHash) return <SuccessScreen txHash={txHash} />;

  return (
    <div
      className="min-h-screen bg-surface-page text-text-primary flex flex-col"
      data-testid="create-job-form-page"
    >
      <Navbar />

      <main className="flex-1 overflow-y-auto flex flex-col" id="main-content">
        <div className="max-w-xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-12 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-text-primary">
            Create New Job
          </h1>
          <p className="mb-6 text-sm leading-6 text-text-muted">
            Configure counterparties, funding structure, and delivery expectations before publishing
            the escrow job.
          </p>

          {form.draftRestored && (
            <div
              className="mb-6 flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-card px-4 py-3 text-sm text-text-secondary"
              role="status"
              data-testid="create-job-draft-banner"
            >
              <span>Restored your draft</span>
              <button
                type="button"
                onClick={form.discardDraft}
                className={`${buttonClassName} text-accent-soft hover:text-accent-soft-hover`}
              >
                Discard
              </button>
            </div>
          )}

          <WizardTabs active={form.activeSection} onSelect={form.setActiveSection} />

          {/*
           * Form-level error alert.
           * role="alert" is sufficient — it implies aria-live="assertive" and
           * aria-atomic="true". The outer wrapper is always rendered so AT
           * registers it before any content is injected, enabling reliable
           * announcement.
           */}
          <div
            id="form-error-region"
            aria-live="assertive"
            aria-atomic="true"
            aria-relevant="additions removals"
          >
            {error && (
              <div
                id="form-error"
                role="alert"
                className="mb-5 rounded-lg bg-danger border border-danger-soft/40 px-4 py-3 text-sm text-danger-soft animate-shake"
                data-testid="form-error-alert"
              >
                {error}
              </div>
            )}
          </div>

          <form
            onSubmit={form.handleSubmit}
            className="space-y-5 sm:space-y-6"
            data-testid="create-job-form"
            aria-label="Create new escrow job"
            aria-describedby={error ? "form-error" : undefined}
            aria-busy={loading}
            noValidate
          >
            <Details form={form} />
            <Milestones form={form} />
            <Review form={form} />

            <TxStatusBanner
              state={{ phase, error, txHash }}
              successMessage="Job created successfully! Redirecting to dashboard..."
            />

            {!address && (
              <p
                className="text-center text-sm text-text-disabled"
                role="status"
                aria-live="polite"
              >
                Connect your wallet to create a job
              </p>
            )}

            {address &&
              !form.review.agreed &&
              !form.scope.hasNoMilestones &&
              !form.scope.hasPartialMilestones &&
              !form.hasValidationErrors && (
                <p className="text-center text-sm text-text-muted" role="status" aria-live="polite">
                  Confirm the agreement in the review step to create a job.
                </p>
              )}

            {/*
             * Sticky footer on mobile so the submit button stays visible
             * without needing to scroll past the keyboard (Issue #46).
             * active:scale-[0.98] for tactile press feedback (Issue #45).
             */}
            <div
              className="
                sm:static sm:bg-transparent sm:border-0 sm:p-0 sm:shadow-none
                fixed bottom-0 left-0 right-0 z-20
                bg-surface-page border-t border-border-strong
                px-4 py-3
                sm:px-0 sm:py-0 sm:relative
              "
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            >
              <button
                type="submit"
                disabled={form.isSubmitDisabled}
                aria-disabled={form.isSubmitDisabled}
                aria-label={loading ? "Creating job, please wait…" : "Create Job"}
                aria-describedby={error ? "form-error" : undefined}
                className={`${buttonClassName} w-full bg-accent hover:bg-accent-hover active:scale-[0.98] py-3 text-text-primary disabled:bg-accent disabled:hover:bg-accent`}
              >
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <ButtonSpinner className="h-4 w-4" />
                    {getPhaseLabel(phase) || "Creating…"}
                  </span>
                ) : (
                  "Create Job"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Bottom padding spacer — keeps form content clear of sticky button bar on mobile */}
        <div className="sm:hidden h-20" aria-hidden="true" />
      </main>
    </div>
  );
}
