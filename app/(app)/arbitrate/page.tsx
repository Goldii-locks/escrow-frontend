"use client";

import Navbar from "@/app/components/Navbar";
import ArbiterDisputeQueue from "@/app/components/ArbiterDisputeQueue";
import EmptyStateCard from "@/app/components/EmptyStateCard";
import { useWallet } from "@/app/context/WalletContext";
import { useArbiterDisputes } from "@/app/hooks/useArbiterDisputes";

/**
 * Arbiter-centred arbitration view (Issue #881): every disputed milestone
 * awaiting the connected wallet's decision, across all jobs, sorted by
 * escalation deadline. Static route so it works with `output: "export"`.
 */
export default function ArbitratePage() {
  const { address } = useWallet();
  const { entries, loading, error, refresh } = useArbiterDisputes(address);

  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Arbitration queue</h1>
          <p className="text-sm text-text-secondary">
            Disputed milestones on jobs you arbitrate, sorted by how soon
            either party can escalate.
          </p>
        </header>

        {address ? (
          <ArbiterDisputeQueue
            entries={entries}
            loading={loading}
            error={error}
            onRefresh={refresh}
          />
        ) : (
          <EmptyStateCard
            testId="arbiter-queue-connect"
            ariaLabel="Connect wallet to view arbitration queue"
            title="Connect your wallet"
            description="Connect the wallet you arbitrate with to see the disputes awaiting your decision."
          />
        )}
      </main>
    </div>
  );
}