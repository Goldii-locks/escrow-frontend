"use client";

import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import CopyButton from "@/app/components/CopyButton";
import { NETWORK_PASSPHRASE } from "@/app/lib/config";
import {
  explorerContractUrl,
  networkProseName,
} from "@/app/lib/network";

/** Shown in place of the form once `create_escrow` has been submitted. */
export default function SuccessScreen({
  txHash,
  escrowAddress,
}: {
  txHash: string;
  escrowAddress?: string;
}) {
  const router = useRouter();
  const network = networkProseName(NETWORK_PASSPHRASE);
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
            Your escrow job is live on Stellar {network}.
          </p>
          {escrowAddress && (
            <>
              <div className="mb-6">
                <p className="text-text-muted text-sm mb-2">Escrow address</p>
                <div className="flex items-center justify-center gap-2 mb-2 max-w-md mx-auto">
                  <span
                    className="font-mono text-xs text-text-primary truncate"
                    title={escrowAddress}
                  >
                    {escrowAddress}
                  </span>
                  <CopyButton value={escrowAddress} label="Escrow address" />
                </div>
                {explorerContractUrl(escrowAddress, NETWORK_PASSPHRASE) && (
                  <a
                    href={explorerContractUrl(escrowAddress, NETWORK_PASSPHRASE)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-soft hover:text-accent-soft-hover underline text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page rounded-sm"
                  >
                    View escrow on Stellar Expert →
                  </a>
                )}
              </div>
              <div className="mb-6 max-w-md mx-auto rounded-xl border border-border-subtle bg-surface-card p-4 text-left">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Next steps</h3>
                <ul className="space-y-2 text-xs text-text-secondary list-disc list-inside">
                  <li>
                    Fund the escrow now so work can begin.
                  </li>
                  <li>
                    Share the escrow link with the freelancer and arbiter so
                    they can accept it.
                  </li>
                  <li>
                    Once accepted and funded, the freelancer can deliver each
                    milestone and you can release funds.
                  </li>
                </ul>
              </div>
            </>
          )}
          <div className="flex items-center justify-center gap-2 mb-4 max-w-md mx-auto">
            <span className="font-mono text-xs text-text-muted truncate" title={txHash}>
              {txHash}
            </span>
            <CopyButton value={txHash} label="Transaction hash" />
          </div>
          {explorerContractUrl(txHash, NETWORK_PASSPHRASE) && (
            <a
              href={explorerContractUrl(txHash, NETWORK_PASSPHRASE)!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-soft hover:text-accent-soft-hover underline text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page rounded-sm"
            >
              View transaction on Stellar Expert →
            </a>
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
