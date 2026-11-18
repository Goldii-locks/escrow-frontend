"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import CopyButton from "@/app/components/CopyButton";
import { NETWORK_PASSPHRASE } from "@/app/lib/config";
import { explorerTxUrl } from "@/app/lib/network";

const NOTIFICATION_PROMPT_KEY = "escrow:notification-prompt-shown";

/** Shown in place of the form once `initialize` has been submitted. */
export default function SuccessScreen({ txHash }: { txHash: string }) {
  const router = useRouter();
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(NOTIFICATION_PROMPT_KEY) !== "true") {
        window.localStorage.setItem(NOTIFICATION_PROMPT_KEY, "true");
        setShowNotificationPrompt(true);
      }
    } catch {
      // localStorage unavailable (e.g. privacy mode) — skip the prompt.
    }
  }, []);

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
            href={explorerTxUrl(txHash, NETWORK_PASSPHRASE) || ""}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-soft hover:text-accent-soft-hover underline text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-surface-page rounded-sm"
          >
            View transaction on Stellar Expert →
          </a>
          {showNotificationPrompt && (
            <div className="mt-6 max-w-md mx-auto rounded-lg border border-border-subtle bg-surface-raised p-4 text-left">
              <p className="text-sm font-medium mb-1">Never miss a deadline</p>
              <p className="text-xs text-text-muted mb-3">
                Get opt-in email alerts for deliveries, approvals, disputes and
                approaching deadlines.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push("/notifications")}
                  className="bg-accent hover:bg-accent-hover active:scale-95 text-text-primary text-sm font-medium px-4 py-2 rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
                >
                  Set up notifications
                </button>
                <button
                  onClick={() => setShowNotificationPrompt(false)}
                  className="text-text-muted hover:text-text-primary text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-surface-page rounded-sm"
                >
                  Not now
                </button>
              </div>
            </div>
          )}
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
