"use client";

import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import CopyButton from "@/app/components/CopyButton";

/** Shown in place of the form once `initialize` has been submitted. */
export default function SuccessScreen({ txHash }: { txHash: string }) {
  const router = useRouter();
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
          <div className="flex items-center justify-center gap-2 mb-4 max-w-md mx-auto">
            <span className="font-mono text-xs text-text-muted truncate" title={txHash}>
              {txHash}
            </span>
            <CopyButton value={txHash} label="Transaction hash" />
          </div>
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
