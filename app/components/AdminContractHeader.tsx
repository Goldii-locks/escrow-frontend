"use client";

import { useState } from "react";
import { CONTRACT_ID, NETWORK_PASSPHRASE } from "@/app/lib/config";
import {
  networkKind,
  networkLabel,
  stellarExpertContractUrl,
  truncateContractId,
} from "@/app/lib/network";

export interface AdminContractHeaderProps {
  contractId?: string;
  networkPassphrase?: string;
}

/** Badge colours: mainnet is red so privileged actions there stand out. */
export function networkBadgeClass(passphrase: string): string {
  return networkKind(passphrase) === "public"
    ? "bg-red-900/60 text-red-200 border-red-700"
    : "bg-indigo-900/60 text-indigo-200 border-indigo-700";
}

/**
 * Header strip for /admin showing which network and contract the admin
 * actions target, so the admin can confirm before signing.
 */
export default function AdminContractHeader({
  contractId = CONTRACT_ID,
  networkPassphrase = NETWORK_PASSPHRASE,
}: AdminContractHeaderProps) {
  const [copied, setCopied] = useState(false);
  const explorerUrl = stellarExpertContractUrl(contractId, networkPassphrase);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contractId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      data-testid="admin-contract-header"
      className="flex flex-wrap items-center gap-3 mb-8 rounded-xl border border-gray-800 bg-gray-900 px-4 py-3 text-sm"
    >
      <span
        data-testid="admin-network-badge"
        className={`rounded-full border px-3 py-1 text-xs font-semibold ${networkBadgeClass(networkPassphrase)}`}
      >
        {networkLabel(networkPassphrase)}
      </span>
      <span className="text-gray-400">Contract</span>
      <span
        data-testid="admin-contract-id"
        title={contractId}
        className="font-mono text-gray-200"
      >
        {contractId ? truncateContractId(contractId) : "Not configured"}
      </span>
      {contractId && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy contract ID"
          className="rounded-lg bg-gray-800 hover:bg-gray-700 px-3 py-1 text-xs transition"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      )}
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-400 hover:text-indigo-300 underline"
        >
          View on explorer
        </a>
      )}
    </div>
  );
}
