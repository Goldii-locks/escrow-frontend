"use client";
import { useState } from "react";
import { useWallet } from "@/app/context/WalletContext";
import Navbar from "@/app/components/Navbar";
import { useRouter } from "next/navigation";

const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "";
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function CreateJob() {
  const { address, signTransaction } = useWallet();
  const router = useRouter();
  const [freelancer, setFreelancer] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [token, setToken] = useState("");
  const [autoReleaseDays, setAutoReleaseDays] = useState("7");
  const [milestones, setMilestones] = useState([{ amount: "" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const addMilestone = () => setMilestones([...milestones, { amount: "" }]);
  const removeMilestone = (i: number) => {
    setMilestones(milestones.filter((_, idx) => idx !== i));
    setTouched(prev => {
      const newTouched = { ...prev };
      delete newTouched[`milestone-${i}`];
      return newTouched;
    });
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`milestone-${i}`];
      return newErrors;
    });
  };
  const updateMilestone = (i: number, val: string) => {
    const updated = [...milestones];
    updated[i].amount = val;
    setMilestones(updated);
    // Clear error when user types
    if (fieldErrors[`milestone-${i}`]) {
      setFieldErrors(prev => ({ ...prev, [`milestone-${i}`]: "" }));
    }
  };

  const normalizedMilestones = milestones.filter(
    (m): m is { amount: string } => !!m && typeof m.amount === "string"
  );
  const hasNoMilestones = normalizedMilestones.length === 0;
  const hasPartialMilestones = normalizedMilestones.some(
    m => m.amount.trim().length === 0
  );

  const validateField = (name: string, value: string) => {
    let err = "";
    if (!value.trim()) {
      err = "This field is required";
    } else if (name === "autoReleaseDays") {
      const num = Number(value);
      if (!Number.isInteger(num) || num < 1) {
        err = "Please enter a positive integer";
      }
    } else if (name.startsWith("milestone")) {
      const num = Number(value);
      if (num <= 0) {
        err = "Please enter a positive number";
      }
    }
    return err;
  };

  const handleBlur = (name: string, value: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    setFieldErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    
    // Validate all fields
    const errors: Record<string, string> = {};
    errors.freelancer = validateField("freelancer", freelancer);
    errors.arbiter = validateField("arbiter", arbiter);
    errors.token = validateField("token", token);
    errors.autoReleaseDays = validateField("autoReleaseDays", autoReleaseDays);
    normalizedMilestones.forEach((m, i) => {
      errors[`milestone-${i}`] = validateField(`milestone-${i}`, m.amount);
    });

    // Mark all fields as touched
    const allTouched: Record<string, boolean> = {};
    allTouched.freelancer = true;
    allTouched.arbiter = true;
    allTouched.token = true;
    allTouched.autoReleaseDays = true;
    normalizedMilestones.forEach((_, i) => {
      allTouched[`milestone-${i}`] = true;
    });
    setTouched(allTouched);
    setFieldErrors(errors);

    const hasErrors = Object.values(errors).some(err => err);
    if (hasErrors) {
      return;
    }
    
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
      const milestoneAmounts = normalizedMilestones.map(m => BigInt(m.amount));

      // Build transaction
      const autoReleaseSeconds = BigInt(autoReleaseDays) * BigInt(24) * BigInt(60) * BigInt(60); // Convert days to seconds
      const buildTxRes = await fetch(`${BACKEND_URL}/api/jobs/build-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: CONTRACT_ID,
          method: "initialize",
          args: [
            { type: "address", value: address }, // Admin (same as client for now)
            { type: "address", value: address }, // Client
            { type: "address", value: freelancer }, // Freelancer
            { type: "address", value: arbiter }, // Arbiter
            { type: "address", value: token }, // Token
            { type: "u64", value: autoReleaseSeconds.toString() }, // Auto-release seconds
            { type: "vec", value: milestoneAmounts.map(a => ({ type: "i128", value: a.toString() })) } // Milestone amounts
          ],
          sourceAddress: address
        })
      });

      if (!buildTxRes.ok) throw new Error("Failed to build transaction");
      const { xdr } = await buildTxRes.json();

      // Sign with Freighter
      const signedXdr = await signTransaction(xdr);

      // Submit to backend
      const submitRes = await fetch(`${BACKEND_URL}/api/jobs/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedXdr })
      });

      if (!submitRes.ok) throw new Error("Failed to submit transaction");
      const { hash } = await submitRes.json();
      setTxHash(hash);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (txHash) {
    return (
      <div className="min-h-screen bg-surface-page text-text-primary flex flex-col">
        <Navbar />
        <main className="flex-1 overflow-y-auto flex items-center justify-center">
          <div className="text-center px-4 py-12">
            <div className="text-success-soft text-5xl mb-4">✓</div>
            <h2 className="text-xl font-bold mb-2">Job Created!</h2>
            <p className="text-text-muted text-sm mb-6">Your escrow job is live on Stellar testnet.</p>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-soft hover:text-accent-soft-hover underline text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-surface-page rounded-sm"
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

  return (
    <div className="min-h-screen bg-surface-page text-text-primary flex flex-col" data-testid="create-job-form-page">
      <Navbar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-12 lg:py-16">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-6 sm:mb-8 lg:mb-10">Create New Job</h1>
        {error && (
          <div className="mb-5 sm:mb-6 rounded-lg bg-danger/40 border border-danger px-4 py-3 text-sm text-danger-soft" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6 lg:space-y-7" data-testid="create-job-form">
          <div>
            <label htmlFor="freelancer-address" className="block text-sm sm:text-base text-text-muted mb-1 sm:mb-2">Freelancer Address</label>
            <input
              id="freelancer-address"
              className={`w-full bg-surface-field border rounded-lg px-4 py-2 sm:py-3 text-sm sm:text-base text-text-primary placeholder:text-text-disabled transition-all duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:bg-surface-field/50 disabled:border-border-subtle/50 disabled:cursor-not-allowed disabled:text-text-disabled ${
                touched.freelancer && fieldErrors.freelancer ? "border-danger-soft focus-visible:ring-danger-soft" : "border-border-subtle focus-visible:ring-accent-soft"
              }`}
              value={freelancer}
              onChange={(e) => {
                setFreelancer(e.target.value);
                if (touched.freelancer) {
                  setFieldErrors(prev => ({ ...prev, freelancer: validateField("freelancer", e.target.value) }));
                }
              }}
              onBlur={() => handleBlur("freelancer", freelancer)}
              placeholder="G..."
              disabled={loading}
              required
            />
            {touched.freelancer && fieldErrors.freelancer && (
              <p className="mt-1 text-xs sm:text-sm text-danger-soft">{fieldErrors.freelancer}</p>
            )}
          </div>
          <div>
            <label htmlFor="arbiter-address" className="block text-sm sm:text-base text-text-muted mb-1 sm:mb-2">Arbiter Address</label>
            <input
              id="arbiter-address"
              className={`w-full bg-surface-field border rounded-lg px-4 py-2 sm:py-3 text-sm sm:text-base text-text-primary placeholder:text-text-disabled transition-all duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:bg-surface-field/50 disabled:border-border-subtle/50 disabled:cursor-not-allowed disabled:text-text-disabled ${
                touched.arbiter && fieldErrors.arbiter ? "border-danger-soft focus-visible:ring-danger-soft" : "border-border-subtle focus-visible:ring-accent-soft"
              }`}
              value={arbiter}
              onChange={(e) => {
                setArbiter(e.target.value);
                if (touched.arbiter) {
                  setFieldErrors(prev => ({ ...prev, arbiter: validateField("arbiter", e.target.value) }));
                }
              }}
              onBlur={() => handleBlur("arbiter", arbiter)}
              placeholder="G..."
              disabled={loading}
              required
            />
            {touched.arbiter && fieldErrors.arbiter && (
              <p className="mt-1 text-xs sm:text-sm text-danger-soft">{fieldErrors.arbiter}</p>
            )}
          </div>
          <div>
            <label htmlFor="token-address" className="block text-sm sm:text-base text-text-muted mb-1 sm:mb-2">Token Contract Address</label>
            <input
              id="token-address"
              className={`w-full bg-surface-field border rounded-lg px-4 py-2 sm:py-3 text-sm sm:text-base text-text-primary placeholder:text-text-disabled transition-all duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:bg-surface-field/50 disabled:border-border-subtle/50 disabled:cursor-not-allowed disabled:text-text-disabled ${
                touched.token && fieldErrors.token ? "border-danger-soft focus-visible:ring-danger-soft" : "border-border-subtle focus-visible:ring-accent-soft"
              }`}
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                if (touched.token) {
                  setFieldErrors(prev => ({ ...prev, token: validateField("token", e.target.value) }));
                }
              }}
              onBlur={() => handleBlur("token", token)}
              placeholder="C..."
              disabled={loading}
              required
            />
            {touched.token && fieldErrors.token && (
              <p className="mt-1 text-xs sm:text-sm text-danger-soft">{fieldErrors.token}</p>
            )}
          </div>
          <div>
            <label htmlFor="response-deadline" className="block text-sm sm:text-base text-text-muted mb-1 sm:mb-2">Response Deadline (days)</label>
            <input
              id="response-deadline"
              type="number"
              min="1"
              className={`w-full bg-surface-field border rounded-lg px-4 py-2 sm:py-3 text-sm sm:text-base text-text-primary placeholder:text-text-disabled transition-all duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:bg-surface-field/50 disabled:border-border-subtle/50 disabled:cursor-not-allowed disabled:text-text-disabled ${
                touched.autoReleaseDays && fieldErrors.autoReleaseDays ? "border-danger-soft focus-visible:ring-danger-soft" : "border-border-subtle focus-visible:ring-accent-soft"
              }`}
              value={autoReleaseDays}
              onChange={(e) => {
                setAutoReleaseDays(e.target.value);
                if (touched.autoReleaseDays) {
                  setFieldErrors(prev => ({ ...prev, autoReleaseDays: validateField("autoReleaseDays", e.target.value) }));
                }
              }}
              onBlur={() => handleBlur("autoReleaseDays", autoReleaseDays)}
              disabled={loading}
              required
            />
            {touched.autoReleaseDays && fieldErrors.autoReleaseDays && (
              <p className="mt-1 text-xs sm:text-sm text-danger-soft">{fieldErrors.autoReleaseDays}</p>
            )}
          </div>
          <div>
            <label className="block text-sm sm:text-base text-text-muted mb-2 sm:mb-3">Milestones</label>
            {hasNoMilestones ? (
              <div
                className="rounded-lg border border-border-subtle bg-surface-card px-4 py-4 sm:px-6 sm:py-6"
                data-testid="milestone-empty-state"
              >
                <p className="text-sm sm:text-base text-text-secondary">No milestones available.</p>
                <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-text-muted">
                  Add your first milestone to define how funds will be released to the freelancer as work is completed.
                </p>
                <button
                  type="button"
                  onClick={addMilestone}
                  disabled={loading}
                  className="mt-3 sm:mt-4 text-sm sm:text-base text-accent-soft hover:text-accent-soft-hover active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add first milestone
                </button>
              </div>
            ) : (
              <div className="space-y-2 sm:space-y-3" data-testid="milestone-list">
                {normalizedMilestones.map((m, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    <input
                      className={`flex-1 min-w-0 bg-surface-field border rounded-lg px-4 py-2 sm:py-3 text-sm sm:text-base text-text-primary placeholder:text-text-disabled transition-all duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:bg-surface-field/50 disabled:border-border-subtle/50 disabled:cursor-not-allowed disabled:text-text-disabled ${
                        touched[`milestone-${i}`] && fieldErrors[`milestone-${i}`] ? "border-danger-soft focus-visible:ring-danger-soft" : "border-border-subtle focus-visible:ring-accent-soft"
                      }`}
                      value={m.amount}
                      onChange={(e) => updateMilestone(i, e.target.value)}
                      onBlur={() => handleBlur(`milestone-${i}`, m.amount)}
                      placeholder={`Milestone ${i + 1} amount (stroops)`}
                      aria-label={`Milestone ${i + 1} amount`}
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => removeMilestone(i)}
                      aria-label={`Remove milestone ${i + 1}`}
                      disabled={loading}
                      className="text-danger-soft hover:text-danger-soft-hover active:scale-95 text-sm sm:text-base px-2 py-2 sm:py-3 shrink-0 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ✕
                    </button>
                  </div>
                  {touched[`milestone-${i}`] && fieldErrors[`milestone-${i}`] && (
                    <p className="text-xs sm:text-sm text-danger-soft">{fieldErrors[`milestone-${i}`]}</p>
                  )}
                </div>
                ))}
              </div>
            )}
            {hasPartialMilestones && !hasNoMilestones && (
              <p className="mt-2 text-xs sm:text-sm text-warning-soft">Complete each milestone amount to continue.</p>
            )}
            <button
              type="button"
              onClick={addMilestone}
              disabled={loading}
              className="mt-2 sm:mt-3 text-sm sm:text-base text-accent-soft hover:text-accent-soft-hover active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Add Milestone
            </button>
          </div>
          <button
            type="submit"
            disabled={loading || !address || hasNoMilestones || hasPartialMilestones}
            className="w-full bg-accent hover:bg-accent-hover active:scale-95 text-text-primary font-medium py-3 sm:py-4 rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-accent"
          >
            {loading ? "Creating..." : "Create Job"}
          </button>
          {!address && (
            <p className="text-center text-sm sm:text-base text-text-disabled">Connect your wallet to create a job</p>
          )}
        </form>
        </div>
      </main>
    </div>
  );
}
