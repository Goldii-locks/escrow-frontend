"use client";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "@/app/context/WalletContext";
import Navbar from "@/app/components/Navbar";
import ButtonSpinner from "@/app/components/ButtonSpinner";
import TxStatusBanner from "@/app/components/TxStatusBanner";
import { useRouter } from "next/navigation";
import {
  CONTRACT_ID,
  getPhaseLabel,
  submitContractTransaction,
  TxPhase,
} from "@/app/lib/transactions";
import { fetchWhitelistedTokens, tokenLabel, WhitelistToken } from "@/app/lib/whitelist";
import { formatTxError } from "@/app/lib/errors";

type WizardSection = "details" | "milestones" | "review";

const inputClassName =
  "w-full bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-200 hover:border-accent-soft hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border-subtle disabled:hover:bg-surface-field";

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
  const [freelancerError, setFreelancerError] = useState("");
  const [arbiterError, setArbiterError] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [autoReleaseDays, setAutoReleaseDays] = useState("7");
  const [acceptedAssets, setAcceptedAssets] = useState<string[]>([]);
  const [requirements, setRequirements] = useState<string[]>([]);
  const [milestones, setMilestones] = useState([{ amount: "" }]);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [whitelist, setWhitelist] = useState<WhitelistToken[]>([]);
  const [whitelistLoading, setWhitelistLoading] = useState(true);
  const [whitelistError, setWhitelistError] = useState<string | null>(null);

  // Refs for tab-panel sections — used for programmatic focus on tab activation
  const detailsPanelRef = useRef<HTMLDivElement>(null);
  const milestonesPanelRef = useRef<HTMLDivElement>(null);
  const reviewPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const tokens = await fetchWhitelistedTokens(CONTRACT_ID, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setWhitelist(tokens);
        setWhitelistError(null);
      } catch {
        if (controller.signal.aborted) return;
        setWhitelistError("Could not load the accepted-token whitelist.");
      } finally {
        if (!controller.signal.aborted) setWhitelistLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

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
  const hasInvalidMilestones = normalizedMilestones.some(m => {
    const trimmed = m.amount.trim();
    if (trimmed.length === 0) return false;
    return !/^[0-9]+$/.test(trimmed);
  });

  const hasValidationErrors = !!freelancerError || !!arbiterError || !!tokenError;
  const isSubmitDisabled = loading || !address || hasNoMilestones || hasPartialMilestones || hasValidationErrors;

  const validateFreelancer = (val: string) => {
    if (val && !/^G[A-Z2-7]{55}$/.test(val)) {
      setFreelancerError("Invalid Stellar public key format");
    } else {
      setFreelancerError("");
    }
  };

  const validateArbiter = (val: string) => {
    if (val && !/^G[A-Z2-7]{55}$/.test(val)) {
      setArbiterError("Invalid Stellar public key format");
    } else {
      setArbiterError("");
    }
  };

  const validateToken = (val: string) => {
    if (val && !/^C[A-Z2-7]{55}$/.test(val)) {
      setTokenError("Invalid Soroban contract ID format");
    } else {
      setTokenError("");
    }
  };

  // Wizard tab sections config
  const wizardSections: { id: WizardSection; label: string; helper: string; panelId: string; tabId: string }[] = [
    {
      id: "details",
      label: "1. Details",
      helper: "Participants and funding",
      panelId: "panel-details",
      tabId: "tab-details",
    },
    {
      id: "milestones",
      label: "2. Scope",
      helper: "Assets, requirements, milestones",
      panelId: "panel-milestones",
      tabId: "tab-milestones",
    },
    {
      id: "review",
      label: "3. Review",
      helper: "Check before submitting",
      panelId: "panel-review",
      tabId: "tab-review",
    },
  ];

  /**
   * Keyboard handler for the tablist — implements ARIA tab pattern:
   * ArrowLeft/ArrowRight cycle through tabs and move focus.
   */
  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    const count = wizardSections.length;
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % count;
    if (e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + count) % count;
    if (e.key === "Home") nextIndex = 0;
    if (e.key === "End") nextIndex = count - 1;
    if (nextIndex !== null) {
      e.preventDefault();
      const nextSection = wizardSections[nextIndex];
      setActiveSection(nextSection.id);
      // Move DOM focus to the newly activated tab
      document.getElementById(nextSection.tabId)?.focus();
    }
  };

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
    if (hasInvalidMilestones) {
      setError("Milestone amounts must contain only numeric characters.");
      return;
    }
    if (!token || !whitelist.some((option) => option.address === token)) {
      setError("Select an accepted token before creating a job.");
      return;
    }
    setLoading(true);
    setError(null);
    setTxHash(null);
    setPhase("building");

    try {
      const milestoneAmounts = normalizedMilestones.map((m) => {
        const trimmed = m.amount.trim();
        if (!/^[0-9]+$/.test(trimmed)) {
          throw new Error("Invalid milestone amount");
        }
        return BigInt(trimmed);
      });
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

      if (!submitRes.ok) throw new Error("Failed to submit transaction");

      alert("Job created successfully!");
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      } else {
        alert("An unknown error occurred");
      }
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
            Configure counterparties, funding structure, and delivery expectations before publishing the escrow job.
          </p>

          {/*
           * Wizard navigation implemented as a proper ARIA tablist.
           * - role="tablist" on the container
           * - role="tab" + aria-selected + aria-controls on each button
           * - Arrow-key navigation via handleTabKeyDown
           * - Each corresponding section carries role="tabpanel" + aria-labelledby
           */}
          <div
            role="tablist"
            aria-label="Form sections"
            className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
            data-testid="wizard-step-list"
          >
            {wizardSections.map((section, index) => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  id={section.tabId}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={section.panelId}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveSection(section.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, index)}
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
            onSubmit={handleSubmit}
            className="space-y-5 sm:space-y-6"
            data-testid="create-job-form"
            aria-label="Create new escrow job"
            aria-describedby={error ? "form-error" : undefined}
            aria-busy={loading}
            noValidate
          >
            {/* ── Section 1: Job Details ──────────────────────────────────── */}
            <section
              id="panel-details"
              role="tabpanel"
              aria-labelledby="tab-details"
              ref={detailsPanelRef}
              tabIndex={-1}
              className="rounded-2xl border border-border-subtle bg-surface-card/70 p-5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Job details</h2>
                  <p className="text-xs text-text-muted">Specify the counterparties and core escrow timing.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection("details");
                    detailsPanelRef.current?.focus();
                  }}
                  aria-label="Focus Job Details section"
                  className={`${buttonClassName} border border-border-subtle bg-surface-field px-3 py-2 text-text-secondary hover:border-accent-soft hover:text-text-primary`}
                >
                  Focus section
                </button>
              </div>
              <div className="space-y-4">
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
                    aria-required="true"
                    className={`${inputClassName} ${freelancerError ? '!border-danger' : ''}`}
                    value={freelancer}
                    onChange={(e) => {
                      setFreelancer(e.target.value);
                      validateFreelancer(e.target.value);
                    }}
                    onBlur={(e) => validateFreelancer(e.target.value)}
                    onFocus={() => setActiveSection("details")}
                    placeholder="G..."
                    required
                    disabled={loading}
                  />
                  {freelancerError && <p className="text-sm text-danger-soft mt-1">{freelancerError}</p>}
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
                    className={`${inputClassName} ${arbiterError ? '!border-danger' : ''}`}
                    value={arbiter}
                    onChange={(e) => {
                      setArbiter(e.target.value);
                      validateArbiter(e.target.value);
                    }}
                    onBlur={(e) => validateArbiter(e.target.value)}
                    onFocus={() => setActiveSection("details")}
                    placeholder="G..."
                    required
                    disabled={loading}
                  />
                  {arbiterError && <p className="text-sm text-danger-soft mt-1">{arbiterError}</p>}
                </div>

                {/*
                 * Token selector — the text input and whitelist select share
                 * the same state (token) but must have distinct IDs to avoid
                 * duplicate-id violations and broken label associations.
                 *
                 * - input#token-manual: always visible, allows direct paste
                 * - select#token-select: shown once the whitelist is loaded
                 * - The label targets token-manual (primary control); the select
                 *   is linked via aria-labelledby pointing at the shared label.
                 * - Whitelist errors are associated to both controls via
                 *   aria-describedby="token-whitelist-error".
                 */}
                <div>
                  <label
                    id="token-label"
                    htmlFor="token-manual"
                    className="block text-sm text-text-muted mb-1"
                  >
                    Token Contract Address
                  </label>
                  <input
                    id="token-manual"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    aria-required="true"
                    aria-describedby={whitelistError ? "token-whitelist-error" : undefined}
                    className={inputClassName}
                    value={token}
                    onChange={(e) => {
                      setToken(e.target.value);
                      validateToken(e.target.value);
                    }}
                    onBlur={(e) => validateToken(e.target.value)}
                    onFocus={() => setActiveSection("details")}
                    placeholder="C..."
                    required
                    disabled={loading}
                  />
                  {whitelistLoading ? (
                    <select
                      id="token-select"
                      aria-labelledby="token-label"
                      aria-busy="true"
                      className={`mt-2 ${inputClassName}`}
                      disabled
                    >
                      <option>Loading accepted tokens…</option>
                    </select>
                  ) : whitelistError ? (
                    <p
                      id="token-whitelist-error"
                      role="alert"
                      data-testid="token-whitelist-error"
                      className="mt-1 text-sm text-danger-soft"
                    >
                      {whitelistError}
                    </p>
                  ) : whitelist.length === 0 ? (
                    <p
                      id="token-whitelist-empty"
                      data-testid="token-whitelist-empty"
                      className="mt-1 text-sm text-text-muted"
                      aria-live="polite"
                    >
                      No accepted tokens are configured for this contract yet. Ask an admin
                      to whitelist a token before creating a job.
                    </p>
                  ) : (
                    <select
                      id="token-select"
                      aria-labelledby="token-label"
                      className={`mt-2 ${inputClassName}`}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      onFocus={() => setActiveSection("details")}
                      required
                      disabled={loading}
                    >
                      <option value="">Select a token</option>
                      {whitelist.map((option) => (
                        <option key={option.address} value={option.address}>
                          {tokenLabel(option)}
                        </option>
                      ))}
                    </select>
                  )}
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
                    className={inputClassName}
                    value={autoReleaseDays}
                    onChange={(e) => setAutoReleaseDays(e.target.value)}
                    onFocus={() => setActiveSection("details")}
                    required
                    disabled={loading}
                  />
                  <p id="deadline-hint" className="mt-1 text-xs text-text-disabled">
                    Funds auto-release after this many days if no dispute is raised.
                  </p>
                </div>
              </div>
            </section>

            {/* ── Section 2: Scope & Release Plan ────────────────────────── */}
            <section
              id="panel-milestones"
              role="tabpanel"
              aria-labelledby="tab-milestones"
              ref={milestonesPanelRef}
              tabIndex={-1}
              className="rounded-2xl border border-border-subtle bg-surface-card/70 p-5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Scope and release plan</h2>
                  <p className="text-xs text-text-muted">Document what will be funded and what completion requires.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection("milestones");
                    milestonesPanelRef.current?.focus();
                  }}
                  aria-label="Focus Scope and Release Plan section"
                  className={`${buttonClassName} border border-border-subtle bg-surface-field px-3 py-2 text-text-secondary hover:border-accent-soft hover:text-text-primary`}
                >
                  Focus section
                </button>
              </div>

              <div className="space-y-5">
                {/* Accepted Assets */}
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    {/*
                     * This <span> labels the group visually; the list inputs
                     * each carry their own aria-label so no htmlFor is needed.
                     */}
                    <span
                      id="accepted-assets-label"
                      className="block text-sm text-text-muted"
                    >
                      Accepted assets
                    </span>
                    <button
                      type="button"
                      onClick={addAcceptedAsset}
                      aria-label="Add accepted asset"
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
                    <div
                      className="space-y-2"
                      data-testid="asset-list"
                      role="group"
                      aria-labelledby="accepted-assets-label"
                    >
                      {acceptedAssets.map((asset, index) => (
                        <div key={`asset-${index}`} className="flex items-center gap-2">
                          <input
                            id={`asset-input-${index}`}
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
                            className={`${buttonClassName} text-danger-soft hover:text-danger-soft-hover shrink-0 rounded-sm min-h-[44px] min-w-[44px] px-2 py-2 active:scale-95`}
                            disabled={loading}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Requirements */}
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span
                      id="requirements-label"
                      className="block text-sm text-text-muted"
                    >
                      Requirements
                    </span>
                    <button
                      type="button"
                      onClick={addRequirement}
                      aria-label="Add requirement"
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
                    <div
                      className="space-y-2"
                      data-testid="requirement-list"
                      role="group"
                      aria-labelledby="requirements-label"
                    >
                      {requirements.map((requirement, index) => (
                        <div key={`requirement-${index}`} className="flex items-center gap-2">
                          <input
                            id={`requirement-input-${index}`}
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
                            className={`${buttonClassName} text-danger-soft hover:text-danger-soft-hover shrink-0 rounded-sm min-h-[44px] min-w-[44px] px-2 py-2 active:scale-95`}
                            disabled={loading}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Milestones */}
                <fieldset aria-describedby={hasPartialMilestones && !hasNoMilestones ? "milestone-warning" : undefined}>
                  <legend className="block text-sm text-text-muted mb-2">Milestones</legend>
                  <div className="mb-2 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={addMilestone}
                      aria-label="Add milestone"
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
                    <ul
                      className="space-y-2"
                      data-testid="milestone-list"
                      role="list"
                      aria-label="Milestone amounts"
                    >
                      {normalizedMilestones.map((m, i) => (
                        <li key={i} className="flex gap-2 items-center animate-slide-in">
                          <input
                            id={`milestone-input-${i}`}
                            className={`${inputClassName} flex-1 min-w-0`}
                            value={m.amount}
                            onChange={(e) => updateMilestone(i, e.target.value)}
                            onFocus={() => setActiveSection("milestones")}
                            placeholder={`Milestone ${i + 1} amount (stroops)`}
                            aria-label={`Milestone ${i + 1} amount in stroops`}
                            aria-required="true"
                            inputMode="numeric"
                            required
                            pattern="^[0-9]+$"
                            disabled={loading}
                          />
                          <button
                            type="button"
                            onClick={() => removeMilestone(i)}
                            aria-label={`Remove milestone ${i + 1}`}
                            className={`${buttonClassName} text-danger-soft hover:text-danger-soft-hover shrink-0 rounded-sm min-h-[44px] min-w-[44px] px-2 py-2 active:scale-95`}
                            disabled={loading}
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/*
                   * The warning paragraph is always rendered (empty when no
                   * error) so AT registers the live region before content is
                   * injected, ensuring reliable announcement.
                   */}
                  <p
                    id="milestone-warning"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    className={`mt-2 text-xs text-warning-soft transition-opacity duration-150 ${
                      hasPartialMilestones && !hasNoMilestones ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                  >
                    {hasPartialMilestones && !hasNoMilestones
                      ? "Complete each milestone amount to continue."
                      : ""}
                  </p>
                </fieldset>
              </div>
            </section>

            {/* ── Section 3: Review ───────────────────────────────────────── */}
            <section
              id="panel-review"
              role="tabpanel"
              aria-labelledby="tab-review"
              ref={reviewPanelRef}
              tabIndex={-1}
              className="rounded-2xl border border-border-subtle bg-surface-card/70 p-5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Review</h2>
                  <p className="text-xs text-text-muted">Confirm the job has enough structure before sending the transaction.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection("review");
                    reviewPanelRef.current?.focus();
                  }}
                  aria-label="Focus Review section"
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

            {!address && (
              <p
                className="text-center text-sm text-text-disabled"
                role="status"
                aria-live="polite"
              >
                Connect your wallet to create a job
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
                disabled={isSubmitDisabled}
                aria-disabled={isSubmitDisabled}
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
