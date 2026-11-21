"use client";

import { useState } from "react";
import { NETWORK_PASSPHRASE } from "@/app/lib/config";
import { ADMIN_ROLE_DESCRIPTIONS, type AdminRole } from "@/app/lib/admin";
import {
  networkKind,
  networkLabel,
  stellarExpertContractUrl,
  truncateContractId,
} from "@/app/lib/network";

export interface AdminContractHeaderProps {
  /** Contract the admin actions target: the selected escrow or the factory. */
  contractId?: string;
  /** What `contractId` is, e.g. "Escrow" or "Factory". */
  contractLabel?: string;
  networkPassphrase?: string;
  /**
   * The connected wallet's access on `contractId` (#838). Omit both to hide
   * the roles row (e.g. before a wallet is connected).
   */
  isAdmin?: boolean;
  roles?: readonly AdminRole[];
}

/** Badge colours: mainnet is red so privileged actions there stand out. */
export function networkBadgeClass(passphrase: string): string {
  return networkKind(passphrase) === "public"
    ? "bg-red-900/60 text-red-200 border-red-700"
    : "bg-indigo-900/60 text-indigo-200 border-indigo-700";
}

/**
 * Header strip for /admin showing which network and contract the admin
 * actions target, so the admin can confirm before signing, and which roles
 * the connected wallet holds there.
 */
export default function AdminContractHeader({
  contractId = "",
  contractLabel = "Contract",
  networkPassphrase = NETWORK_PASSPHRASE,
  isAdmin,
  roles,
}: AdminContractHeaderProps) {
  const [copied, setCopied] = useState(false);
  const explorerUrl = stellarExpertContractUrl(contractId, networkPassphrase);
  const showAccess = isAdmin !== undefined || roles !== undefined;
  const badges = [...(isAdmin ? ["Admin"] : []), ...(roles ?? [])];

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
      <span className="text-gray-400">{contractLabel}</span>
      <span data-testid="admin-contract-id" title={contractId} className="font-mono text-gray-200">
        {contractId ? truncateContractId(contractId) : "Not selected"}
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
      {showAccess && (
        <span data-testid="admin-wallet-roles" className="flex flex-wrap items-center gap-2 w-full">
          <span className="text-gray-400">Your roles</span>
          {badges.length === 0 ? (
            <span className="text-xs text-gray-500">None</span>
          ) : (
            badges.map((role) => (
              <span
                key={role}
                data-testid={`admin-role-badge-${role}`}
                title={
                  role === "Admin"
                    ? "Stored contract admin: every admin action"
                    : ADMIN_ROLE_DESCRIPTIONS[role as AdminRole]
                }
                className="rounded-full border border-emerald-700 bg-emerald-950/60 px-2.5 py-0.5 text-xs font-medium text-emerald-200"
              >
                {role}
              </span>
            ))
          )}
        </span>
      )}
    </div>
  );
}
