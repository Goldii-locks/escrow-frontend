"use client";
import { useState } from "react";
import { useWallet } from "@/app/context/WalletContext";
import Navbar from "@/app/components/Navbar";
import ButtonSpinner from "@/app/components/ButtonSpinner";
import TxStatusBanner from "@/app/components/TxStatusBanner";
import { useRouter } from "next/navigation";
import {
  getPhaseLabel,
  submitContractTransaction,
  TxPhase,
} from "@/app/lib/transactions";
import { formatTxError } from "@/app/lib/errors";

type WizardSection = "details" | "milestones" | "review";

const inputClassName =
  "w-full bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled transition-all duration-200 hover:border-accent-soft hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border-subtle disabled:hover:bg-surface-field";

const buttonClassName =
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100";

function EmptyCollectionState({
  title,
  description,
  actionLabel,
  onAction,
  testId,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  testId: string;
}) {
  return (
    <div
      className="rounded-2xl border border-dashed border-border-subtle bg-surface-card/80 px-4 py-5 shadow-sm"
      data-testid={testId}
    >
      <p className="text-sm font-semibold text-text-secondary">{title}</p>
      <p className="mt-1 text-xs leading-5 text-text-muted">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className={`${buttonClassName} mt-4 text-accent-soft hover:text-accent-soft-hover px-0 py-0 rounded-sm active:scale-95`}
      >
        {actionLabel}
      </button>
    </div>
  );
}

export default function CreateJob() {
  const { address, signTransaction } = useWallet();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<WizardSection>("details");
  const [freelancer, setFreelancer] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [token, setToken] = useState("");
  const [autoReleaseDays, setAutoReleaseDays] = useState("7");
  const [acceptedAssets, setAcceptedAssets] = useState<string[]>([]);
  const [requirements, setRequirements] = useState<string[]>([]);
  const [milestones, setMilestones] = useState([{ amount: "" }]);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const addAcceptedAsset = () => setAcceptedAssets([...acceptedAssets, ""]);
  const removeAcceptedAsset = (index: number) =>
    setAcceptedAssets(acceptedAssets.filter((_, currentIndex) => currentIndex !== index));
  const updateAcceptedAsset = (index: number, value: string) => {
    const updated = [...acceptedAssets];
    updated[index] = value;
    setAcceptedAssets(updated);
  };

  const addRequirement = () => setRequirements([...requirements, ""]);
  const removeRequirement = (index: number) =>
    setRequirements(requirements.filter((_, currentIndex) => currentIndex !== index));
  const updateRequirement = (index: number, value: string) => {
    const updated = [...requirements];
    updated[index] = value;
    setRequirements(updated);
  };

  const addMilestone = () => setMilestones([...milestones, { amount: "" }]);
  const removeMilestone = (i: number) =>
    setMilestones(milestones.filter((_, idx) => idx !== i));
  const updateMilestone = (i: number, val: string) => {
    const updated = [...milestones];
    updated[i].amount = val;
    setMilestones(updated);
  };

  const normalizedMilestones = milestones.filter(
    (m): m is { amount: string } => !!m && typeof m.amount === "string"
  );
  const normalizedAssets = acceptedAssets.filter((asset) => asset.trim().length > 0);
  const normalizedRequirements = requirements.filter(
    (requirement) => requirement.trim().length > 0
  );
  const hasNoMilestones = normalizedMilestones.length === 0;
  const hasPartialMilestones = normalizedMilestones.some(
    (m) => m.amount.trim().length === 0
  );

  const isSubmitDisabled = loading || !address || hasNoMilestones || hasPartialMilestones;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    if (hasNoMilestones) {
      setError("Add at least one milestone amount before creating a job.");
      return;
    }
    if (hasPartialMilestones) {
      setError("Complete each milestone amount before creating a job.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const milestoneAmounts = normalizedMilestones.map((m) => BigInt(m.amount));

      // Convert days to seconds for auto-release
      const autoReleaseSeconds =
        BigInt(autoReleaseDays) * BigInt(24) * BigInt(60) * BigInt(60);

      const buildTxRes = await fetch(`${BACKEND_URL}/api/jobs/build-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: CONTRACT_ID,
          method: "initialize",
          args: [
            { type: "address", value: address },
            { type: "address", value: address },
            { type: "address", value: freelancer },
            { type: "address", value: arbiter },
            { type: "address", value: token },
            { type: "u64", value: autoReleaseSeconds.toString() },
            {
              type: "vec",
              value: milestoneAmounts.map((a) => ({ type: "i128", value: a.toString() })),
            },
          ],
          sourceAddress: address,
        }),
      });

      if (!buildTxRes.ok) throw new Error("Failed to build transaction");
      const { xdr } = await buildTxRes.json();

      const signedXdr = await signTransaction(xdr);

      const submitRes = await fetch(`${BACKEND_URL}/api/jobs/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedXdr }),
    setTxHash(null);
    setPhase("building");

    try {
      const milestoneAmounts = normalizedMilestones.map((m) => BigInt(m.amount));
      const autoReleaseSeconds =
        BigInt(autoReleaseDays) * BigInt(24) * BigInt(60) * BigInt(60);

      const hash = await submitContractTransaction({
        method: "initialize",
        args: [
          { type: "address", value: address },
          { type: "address", value: address },
          { type: "address", value: freelancer },
          { type: "address", value: arbiter },
          { type: "address", value: token },
          { type: "u64", value: autoReleaseSeconds.toString() },
          {
            type: "vec",
            value: milestoneAmounts.map((a) => ({
              type: "i128",
              value: a.toString(),
            })),
          },
        ],
        sourceAddress: address,
        signTransaction,
        onPhase: setPhase,
      });

      setPhase("success");
      setTxHash(hash);
    } catch (err) {
      setPhase("error");
      setError(formatTxError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (txHash) {
    return (
      <div className="min-h-screen bg-surface-page text-text-primary flex flex-col">
        <Navbar />
        <main className="flex-1 overflow-y-auto flex items-center justify-center">
          <div className="text-center px-4 py-12 animate-fade-in">
            <div className="text-success-soft text-5xl mb-4" aria-hidden="true">
              ✓
            </div>
            <h2 className="text-xl font-bold mb-2">Job Created!</h2>
            <p className="text-text-muted text-sm mb-6">
              Your escrow job is live on Stellar testnet.
            </p>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-soft hover:text-accent-soft-hover underline text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page rounded-sm"
            >
              View transaction on Stellar Expert →
            </a>
            <div className="mt-6">
              <button
                onClick={() => router.push("/dashboard")}
                className="bg-accent hover:bg-accent-hover active:scale-95 text-text-primary text-sm font-medium px-6 py-2 rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Create-job form ─────────────────────────────────────────────────────────
  return (
    /*
     * Issue #46 – Mobile viewport: the outer wrapper uses flex-col + overflow
     * so the sticky submit bar always stays visible without needing the user
     * to scroll past the keyboard on small screens.
     */
    <div
      className="min-h-screen bg-surface-page text-text-primary flex flex-col"
      data-testid="create-job-form-page"
    >
      <Navbar />

      {/*
       * flex-1 + overflow-y-auto keeps the form scrollable independently of
       * the sticky footer on mobile (Issue #46).
       */}
      <main className="flex-1 overflow-y-auto flex flex-col" id="main-content">
        <div className="max-w-xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-12 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8 text-text-primary">
            Create New Job
          </h1>

          {/*
           * Issue #40 – aria-live="polite" announces error messages to screen
           * readers without interrupting the current read flow.
           */}
          <div aria-live="polite" aria-atomic="true">
            {error && (
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
          <h1 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Create New Job</h1>
          <p className="mb-6 text-sm leading-6 text-text-muted">
            Configure counterparties, funding structure, and delivery expectations before publishing the escrow job.
          </p>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="wizard-step-list">
            {[
              {
                id: "details" as const,
                label: "1. Details",
                helper: "Participants and funding",
              },
              {
                id: "milestones" as const,
                label: "2. Scope",
                helper: "Assets, requirements, milestones",
              },
              {
                id: "review" as const,
                label: "3. Review",
                helper: "Check before submitting",
              },
            ].map((section) => {
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  aria-pressed={isActive}
                  className={`${buttonClassName} flex-col items-start gap-1 border px-4 py-3 text-left ${
                    isActive
                      ? "border-accent-soft bg-accent/10 text-text-primary shadow-sm"
                      : "border-border-subtle bg-surface-card text-text-secondary hover:border-accent-soft hover:bg-surface-card/90"
                  }`}
                >
                  <span>{section.label}</span>
                  <span className="text-xs font-normal text-text-muted">{section.helper}</span>
                </button>
              );
            })}
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-2">Milestones</label>
            {hasNoMilestones ? (
              <div
                id="form-error"
                className="mb-5 rounded-lg bg-danger/40 border border-danger px-4 py-3 text-sm text-danger-soft animate-shake"
                role="alert"
              >
                {error}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5 sm:space-y-6"
            data-testid="create-job-form"
            aria-label="Create new escrow job"
            aria-describedby={error ? "form-error" : undefined}
            /*
             * Issue #40 – aria-busy tells assistive tech the form is
             * processing during the async submit.
             */
            aria-busy={loading}
            noValidate
          >
            {/* Freelancer Address */}
            <div>
              <label
                htmlFor="freelancer-address"
                className="block text-sm text-text-muted mb-1"
              >
                Freelancer Address
              </label>
              <input
                id="freelancer-address"
                type="text"
                autoComplete="off"
                spellCheck={false}
                /*
                 * Issue #40 – aria-required conveys requirement semantics to
                 * assistive tech independently of HTML5 `required`.
                 */
                aria-required="true"
                /*
                 * Issue #45 – transition-colors gives a subtle color shift on
                 * hover/focus without jarring layout shifts.
                 * Issue #47 – uses design tokens (bg-surface-field,
                 * focus-visible:ring-accent-soft) instead of raw colours.
                 */
                className="w-full bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
                value={freelancer}
                onChange={(e) => setFreelancer(e.target.value)}
                placeholder="G..."
                required
              />
            </div>

            {/* Arbiter Address */}
            <div>
              <label
                htmlFor="arbiter-address"
                className="block text-sm text-text-muted mb-1"
              >
                Arbiter Address
              </label>
              <input
                id="arbiter-address"
                type="text"
                autoComplete="off"
                spellCheck={false}
                aria-required="true"
                className="w-full bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
                value={arbiter}
                onChange={(e) => setArbiter(e.target.value)}
                placeholder="G..."
                required
              />
            </div>

            {/* Token Contract Address */}
            <div>
              <label
                htmlFor="token-address"
                className="block text-sm text-text-muted mb-1"
              >
                Token Contract Address
              </label>
              <input
                id="token-address"
                type="text"
                autoComplete="off"
                spellCheck={false}
                aria-required="true"
                className="w-full bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="C..."
                required
              />
            </div>

            {/* Response Deadline */}
            <div>
              <label
                htmlFor="response-deadline"
                className="block text-sm text-text-muted mb-1"
              >
                Response Deadline (days)
              </label>
              <input
                id="response-deadline"
                type="number"
                min="1"
                aria-required="true"
                aria-describedby="deadline-hint"
                className="w-full bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
                value={autoReleaseDays}
                onChange={(e) => setAutoReleaseDays(e.target.value)}
                required
              />
              {/* Issue #40 – visible hint linked via aria-describedby */}
              <p id="deadline-hint" className="mt-1 text-xs text-text-disabled">
                Funds auto-release after this many days if no dispute is raised.
              </p>
            </div>

            {/* Milestones */}
            <fieldset>
              {/*
               * Issue #40 – <fieldset>/<legend> groups related milestone
               * inputs for screen readers.
               */}
              <legend className="block text-sm text-text-muted mb-2">Milestones</legend>

              {hasNoMilestones ? (
                <div
                  className="rounded-lg border border-border-subtle bg-surface-card px-4 py-4"
                  data-testid="milestone-empty-state"
                >
                  <p className="text-sm text-text-secondary">No milestones available.</p>
                  <p className="mt-1 text-xs text-text-muted">
                    Add your first milestone to define how funds should be released.
                  </p>
                  <button
                    type="button"
                    onClick={addMilestone}
                    /*
                     * Issue #40 – explicit role/description for icon-only
                     * context buttons.
                     */
                    aria-label="Add first milestone"
                    className="mt-3 text-sm text-accent-soft hover:text-accent-soft-hover active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page rounded-sm"
                  >
                    Add first milestone
                  </button>
                </div>
              ) : (
                /*
                 * Issue #45 – role="list" + animate-* classes allow CSS
                 * transitions when milestone rows are added/removed.
                 */
                <ul
                  className="space-y-2"
                  data-testid="milestone-list"
                  role="list"
                  aria-label="Milestone amounts"
                >
                  {normalizedMilestones.map((m, i) => (
                    <li
                      key={i}
                      className="flex gap-2 items-center animate-slide-in"
                    >
                      <input
                        className="flex-1 min-w-0 bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
                        value={m.amount}
                        onChange={(e) => updateMilestone(i, e.target.value)}
                        placeholder={`Milestone ${i + 1} amount (stroops)`}
                        aria-label={`Milestone ${i + 1} amount`}
                        aria-required="true"
                        inputMode="numeric"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => removeMilestone(i)}
                        aria-label={`Remove milestone ${i + 1}`}
                        /*
                         * Issue #45 – active:scale-95 micro-animation on
                         * destructive action button.
                         */
                        className="text-danger-soft hover:text-danger-soft-hover active:scale-95 text-sm px-2 shrink-0 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page rounded-sm"
                      >
                        {/* Issue #40 – screen-reader-only text alongside decorative × */}
                        <span aria-hidden="true">✕</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {hasPartialMilestones && !hasNoMilestones && (
                <p
                  className="mt-2 text-xs text-warning-soft"
                  role="alert"
                  aria-live="assertive"
                >
                  Complete each milestone amount to continue.
                </p>
              )}

              <button
                type="button"
                onClick={addMilestone}
                className="mt-2 text-sm text-accent-soft hover:text-accent-soft-hover active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page rounded-sm"
              >
                + Add Milestone
              </button>
            </fieldset>

            {!address && (
              <p
                className="text-center text-sm text-text-disabled"
                role="status"
              >
                Connect your wallet to create a job
              </p>
            )}

            {/*
             * Issue #46 – On mobile the button uses a sticky wrapper via CSS
             * so it stays pinned to the bottom of the viewport without
             * duplicating DOM nodes (single button = single accessible target).
             *
             * Issue #45 – active:scale-[0.98] tactile press feedback.
             * Issue #47 – bg-accent / bg-accent-hover / text-text-primary
             *             are all semantic design-token classes.
             * Issue #40 – aria-disabled mirrors the disabled state for AT.
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
                disabled={isSubmitDisabled}
                aria-disabled={isSubmitDisabled}
                aria-label={loading ? "Creating job, please wait…" : "Create Job"}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-text-primary font-medium py-3 rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
              >
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <span
                      className="h-4 w-4 rounded-full border-2 border-text-primary border-t-transparent animate-spin"
                      aria-hidden="true"
                    />
                    Creating…
                  </span>
                ) : (
                  "Create Job"
                )}
              </button>
            </div>
          </form>
          <TxStatusBanner
            state={{ phase, error, txHash }}
            successMessage="Job created successfully! Redirecting to dashboard..."
          />

          <button
            type="submit"
            disabled={loading || !address || hasNoMilestones || hasPartialMilestones}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-text-primary font-medium py-3 rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
          >
            {loading && <ButtonSpinner className="h-4 w-4" />}
            {loading ? getPhaseLabel(phase) || "Creating..." : "Create Job"}
          </button>
          {!address && (
            <p className="text-center text-sm text-text-disabled">Connect your wallet to create a job</p>
          )}
        </form>
          {error && (
            <div className="mb-5 rounded-lg bg-danger/40 border border-danger px-4 py-3 text-sm text-danger-soft" role="alert">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6" data-testid="create-job-form">
            <section className="rounded-2xl border border-border-subtle bg-surface-card/70 p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Job details</h2>
                  <p className="text-xs text-text-muted">Specify the counterparties and core escrow timing.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection("details")}
                  className={`${buttonClassName} border border-border-subtle bg-surface-field px-3 py-2 text-text-secondary hover:border-accent-soft hover:text-text-primary`}
                >
                  Focus section
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label htmlFor="freelancer-address" className="block text-sm text-text-muted mb-1">Freelancer Address</label>
                  <input
                    id="freelancer-address"
                    className={inputClassName}
                    value={freelancer}
                    onChange={(e) => setFreelancer(e.target.value)}
                    onFocus={() => setActiveSection("details")}
                    placeholder="G..."
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="arbiter-address" className="block text-sm text-text-muted mb-1">Arbiter Address</label>
                  <input
                    id="arbiter-address"
                    className={inputClassName}
                    value={arbiter}
                    onChange={(e) => setArbiter(e.target.value)}
                    onFocus={() => setActiveSection("details")}
                    placeholder="G..."
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="token-address" className="block text-sm text-text-muted mb-1">Token Contract Address</label>
                  <input
                    id="token-address"
                    className={inputClassName}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    onFocus={() => setActiveSection("details")}
                    placeholder="C..."
                    required
                    disabled={loading}
                  />
                </div>
                <div>
                  <label htmlFor="response-deadline" className="block text-sm text-text-muted mb-1">Response Deadline (days)</label>
                  <input
                    id="response-deadline"
                    type="number"
                    min="1"
                    className={inputClassName}
                    value={autoReleaseDays}
                    onChange={(e) => setAutoReleaseDays(e.target.value)}
                    onFocus={() => setActiveSection("details")}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border-subtle bg-surface-card/70 p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Scope and release plan</h2>
                  <p className="text-xs text-text-muted">Document what will be funded and what completion requires.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection("milestones")}
                  className={`${buttonClassName} border border-border-subtle bg-surface-field px-3 py-2 text-text-secondary hover:border-accent-soft hover:text-text-primary`}
                >
                  Focus section
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm text-text-muted">Accepted assets</label>
                    <button
                      type="button"
                      onClick={addAcceptedAsset}
                      className={`${buttonClassName} text-accent-soft hover:text-accent-soft-hover rounded-sm px-0 py-0 active:scale-95`}
                    >
                      + Add Asset
                    </button>
                  </div>
                  {acceptedAssets.length === 0 ? (
                    <EmptyCollectionState
                      title="No accepted assets selected"
                      description="List the token symbols or contract addresses this job can be funded with so contributors know the expected payment rails."
                      actionLabel="Add accepted asset"
                      onAction={addAcceptedAsset}
                      testId="asset-empty-state"
                    />
                  ) : (
                    <div className="space-y-2" data-testid="asset-list">
                      {acceptedAssets.map((asset, index) => (
                        <div key={`asset-${index}`} className="flex items-center gap-2">
                          <input
                            className={`${inputClassName} flex-1 min-w-0`}
                            value={asset}
                            onChange={(e) => updateAcceptedAsset(index, e.target.value)}
                            onFocus={() => setActiveSection("milestones")}
                            placeholder={`Accepted asset ${index + 1}`}
                            aria-label={`Accepted asset ${index + 1}`}
                            disabled={loading}
                          />
                          <button
                            type="button"
                            onClick={() => removeAcceptedAsset(index)}
                            aria-label={`Remove accepted asset ${index + 1}`}
                            className={`${buttonClassName} text-danger-soft hover:text-danger-soft-hover shrink-0 rounded-sm px-2 py-2 active:scale-95`}
                            disabled={loading}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm text-text-muted">Requirements</label>
                    <button
                      type="button"
                      onClick={addRequirement}
                      className={`${buttonClassName} text-accent-soft hover:text-accent-soft-hover rounded-sm px-0 py-0 active:scale-95`}
                    >
                      + Add Requirement
                    </button>
                  </div>
                  {requirements.length === 0 ? (
                    <EmptyCollectionState
                      title="No delivery requirements added"
                      description="Capture acceptance criteria, references, or handoff notes so the freelancer and approver share the same definition of done."
                      actionLabel="Add first requirement"
                      onAction={addRequirement}
                      testId="requirement-empty-state"
                    />
                  ) : (
                    <div className="space-y-2" data-testid="requirement-list">
                      {requirements.map((requirement, index) => (
                        <div key={`requirement-${index}`} className="flex items-center gap-2">
                          <input
                            className={`${inputClassName} flex-1 min-w-0`}
                            value={requirement}
                            onChange={(e) => updateRequirement(index, e.target.value)}
                            onFocus={() => setActiveSection("milestones")}
                            placeholder={`Requirement ${index + 1}`}
                            aria-label={`Requirement ${index + 1}`}
                            disabled={loading}
                          />
                          <button
                            type="button"
                            onClick={() => removeRequirement(index)}
                            aria-label={`Remove requirement ${index + 1}`}
                            className={`${buttonClassName} text-danger-soft hover:text-danger-soft-hover shrink-0 rounded-sm px-2 py-2 active:scale-95`}
                            disabled={loading}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm text-text-muted">Milestones</label>
                    <button
                      type="button"
                      onClick={addMilestone}
                      className={`${buttonClassName} text-accent-soft hover:text-accent-soft-hover rounded-sm px-0 py-0 active:scale-95`}
                    >
                      + Add Milestone
                    </button>
                  </div>
                  {hasNoMilestones ? (
                    <EmptyCollectionState
                      title="No milestones available."
                      description="Add your first milestone to define how funds should be released across the engagement."
                      actionLabel="Add first milestone"
                      onAction={addMilestone}
                      testId="milestone-empty-state"
                    />
                  ) : (
                    <div className="space-y-2" data-testid="milestone-list">
                      {normalizedMilestones.map((m, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input
                            className={`${inputClassName} flex-1 min-w-0`}
                            value={m.amount}
                            onChange={(e) => updateMilestone(i, e.target.value)}
                            onFocus={() => setActiveSection("milestones")}
                            placeholder={`Milestone ${i + 1} amount (stroops)`}
                            aria-label={`Milestone ${i + 1} amount`}
                            required
                            disabled={loading}
                          />
                          <button
                            type="button"
                            onClick={() => removeMilestone(i)}
                            aria-label={`Remove milestone ${i + 1}`}
                            className={`${buttonClassName} text-danger-soft hover:text-danger-soft-hover shrink-0 rounded-sm px-2 py-2 active:scale-95`}
                            disabled={loading}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {hasPartialMilestones && !hasNoMilestones && (
                    <p className="mt-2 text-xs text-warning-soft">Complete each milestone amount to continue.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border-subtle bg-surface-card/70 p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Review</h2>
                  <p className="text-xs text-text-muted">Confirm the job has enough structure before sending the transaction.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection("review")}
                  className={`${buttonClassName} border border-border-subtle bg-surface-field px-3 py-2 text-text-secondary hover:border-accent-soft hover:text-text-primary`}
                >
                  Focus section
                </button>
              </div>
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3" data-testid="review-summary">
                <div className="rounded-xl border border-border-subtle bg-surface-field px-4 py-3">
                  <dt className="text-text-muted">Accepted assets</dt>
                  <dd className="mt-1 font-medium text-text-primary">{normalizedAssets.length}</dd>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface-field px-4 py-3">
                  <dt className="text-text-muted">Requirements</dt>
                  <dd className="mt-1 font-medium text-text-primary">{normalizedRequirements.length}</dd>
                </div>
                <div className="rounded-xl border border-border-subtle bg-surface-field px-4 py-3">
                  <dt className="text-text-muted">Milestones</dt>
                  <dd className="mt-1 font-medium text-text-primary">{normalizedMilestones.length}</dd>
                </div>
              </dl>
            </section>

            <TxStatusBanner
              state={{ phase, error, txHash }}
              successMessage="Job created successfully! Redirecting to dashboard..."
            />

            <button
              type="submit"
              disabled={loading || !address || hasNoMilestones || hasPartialMilestones}
              className={`${buttonClassName} w-full bg-accent hover:bg-accent-hover active:scale-95 py-3 text-text-primary disabled:bg-accent disabled:hover:bg-accent`}
            >
              {loading && <ButtonSpinner className="h-4 w-4" />}
              {loading ? getPhaseLabel(phase) || "Creating..." : "Create Job"}
            </button>
            {!address && (
              <p className="text-center text-sm text-text-disabled">Connect your wallet to create a job</p>
            )}
          </form>
        </div>

        {/*
         * Issue #46 – Bottom padding spacer so form content is never hidden
         * behind the sticky button bar on mobile.  On sm+ the bar is
         * position:relative so no spacer is needed.
         */}
        <div className="sm:hidden h-20" aria-hidden="true" />
      </main>
    </div>
  );
}
