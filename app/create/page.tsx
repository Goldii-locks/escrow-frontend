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
  const hasNoMilestones = normalizedMilestones.length === 0;
  const hasPartialMilestones = normalizedMilestones.some(
    m => m.amount.trim().length === 0
  );

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

  return (
    <div className="min-h-screen bg-surface-page text-text-primary flex flex-col" data-testid="create-job-form-page">
      <Navbar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
        <h1 className="text-xl sm:text-2xl font-bold mb-6 sm:mb-8">Create New Job</h1>
        {error && (
          <div className="mb-5 rounded-lg bg-danger/40 border border-danger px-4 py-3 text-sm text-danger-soft" role="alert">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6" data-testid="create-job-form">
          <div>
            <label htmlFor="freelancer-address" className="block text-sm text-text-muted mb-1">Freelancer Address</label>
            <input
              id="freelancer-address"
              className="w-full bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
              value={freelancer}
              onChange={(e) => setFreelancer(e.target.value)}
              placeholder="G..."
              required
            />
          </div>
          <div>
            <label htmlFor="arbiter-address" className="block text-sm text-text-muted mb-1">Arbiter Address</label>
            <input
              id="arbiter-address"
              className="w-full bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
              value={arbiter}
              onChange={(e) => setArbiter(e.target.value)}
              placeholder="G..."
              required
            />
          </div>
          <div>
            <label htmlFor="token-address" className="block text-sm text-text-muted mb-1">Token Contract Address</label>
            <input
              id="token-address"
              className="w-full bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="C..."
              required
            />
          </div>
          <div>
            <label htmlFor="response-deadline" className="block text-sm text-text-muted mb-1">Response Deadline (days)</label>
            <input
              id="response-deadline"
              type="number"
              min="1"
              className="w-full bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
              value={autoReleaseDays}
              onChange={(e) => setAutoReleaseDays(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-text-muted mb-2">Milestones</label>
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
                  className="mt-3 text-sm text-accent-soft hover:text-accent-soft-hover active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page rounded-sm"
                >
                  Add first milestone
                </button>
              </div>
            ) : (
              <div className="space-y-2" data-testid="milestone-list">
                {normalizedMilestones.map((m, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      className="flex-1 min-w-0 bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-200 hover:border-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
                      value={m.amount}
                      onChange={(e) => updateMilestone(i, e.target.value)}
                      placeholder={`Milestone ${i + 1} amount (stroops)`}
                      aria-label={`Milestone ${i + 1} amount`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => removeMilestone(i)}
                      aria-label={`Remove milestone ${i + 1}`}
                      className="text-danger-soft hover:text-danger-soft-hover active:scale-95 text-sm px-2 shrink-0 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page rounded-sm"
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
            <button
              type="button"
              onClick={addMilestone}
              className="mt-2 text-sm text-accent-soft hover:text-accent-soft-hover active:scale-95 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page rounded-sm"
            >
              + Add Milestone
            </button>
          </div>
          <button
            type="submit"
            disabled={loading || !address || hasNoMilestones || hasPartialMilestones}
            className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-text-primary font-medium py-3 rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
          >
            {loading ? "Creating..." : "Create Job"}
          </button>
          {!address && (
            <p className="text-center text-sm text-text-disabled">Connect your wallet to create a job</p>
          )}
        </form>
        </div>
      </main>
    </div>
  );
}
