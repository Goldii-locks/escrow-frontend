"use client";

import { useState } from "react";
import { getStellarExpertTxUrl } from "@/app/lib/stellar";
import { NETWORK_PASSPHRASE } from "@/app/lib/network_config";

interface Props {
  txHash: string;
  /** Network passphrase to derive the explorer URL from. */
  passphrase?: string;
  /** Link text when an explorer URL is available. */
  linkLabel?: string;
  className?: string;
}

/**
 * Shared transaction-hash presentation (#867).
 *
 * Always shows the hash and a copy button. The explorer link is rendered only
 * when the active network actually has one; custom networks get plain text
 * instead of a URL that would 404 or a render-time exception.
 */
export default function TransactionHash({
  txHash,
  passphrase = NETWORK_PASSPHRASE,
  linkLabel = "View on Stellar Expert",
  className = "",
}: Props) {
  const [copied, setCopied] = useState(false);
  const explorerUrl = getStellarExpertTxUrl(txHash, passphrase);

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(txHash);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}
      data-testid="transaction-hash"
    >
      <code className="break-all font-mono text-xs" data-testid="transaction-hash-value">
        {txHash}
      </code>
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
        >
          {linkLabel}
        </a>
      )}
      <button
        type="button"
        onClick={() => void copy()}
        data-testid="copy-transaction-hash"
        aria-label="Copy transaction hash"
        className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
      >
        {copied ? "Copied" : "Copy hash"}
      </button>
    </div>
  );
}
