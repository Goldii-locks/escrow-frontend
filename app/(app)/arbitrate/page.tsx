"use client";

import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import { useWallet } from "@/app/context/WalletContext";
import { useArbiterQueue } from "@/app/hooks/useArbiterQueue";
import { formatTimeLeft } from "@/app/lib/arbiter_queue";

export default function ArbitratePage() {
  const { address } = useWallet();
  const { items, error } = useArbiterQueue(address);
  const now = Math.floor(Date.now() / 1000);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-4xl p-4 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold mb-4">Arbitration</h1>
        {!address ? (
          <p className="text-text-muted">Connect your wallet to see disputes awaiting you.</p>
        ) : items === null ? (
          <p className="text-text-muted" role="status">
            Loading disputes…
          </p>
        ) : items.length === 0 ? (
          <p className="text-text-muted" role="status">
            {error
              ? "Couldn't load disputes. Try again shortly."
              : "No disputed milestones need your decision."}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={`${item.jobId}:${item.milestoneIndex}`}
                className="bg-surface-field rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-mono text-xs break-all">{item.jobId}</p>
                  <p>
                    Milestone {item.milestoneIndex + 1}: {item.amount} {item.tokenSymbol ?? ""}
                  </p>
                  <p className="text-text-muted text-xs">
                    Raised by {item.raisedBy ?? "unknown"}
                    {item.raisedAt
                      ? ` on ${new Date(item.raisedAt * 1000).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-semibold">
                    {formatTimeLeft(item.escalatesAt, now)}
                  </span>
                  <Link
                    href={`/dashboard?job=${encodeURIComponent(item.jobId)}`}
                    className="text-sm underline"
                  >
                    View dispute
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
