"use client";

import {
  checkWalletAvailability,
  WALLET_INSTALL_URL,
  type WalletAvailabilityState,
} from "@/app/lib/network_sync_checker";

interface Props {
  /** Optional precomputed availability state; when omitted, the banner detects on render. */
  availability?: WalletAvailabilityState | null;
  /** Optional detector override (useful in tests). */
  detector?: () => boolean;
  className?: string;
}

/**
 * Warning banner rendered by network_sync_checker when no supported wallet
 * extension is installed. Displays setup instructions and an install link.
 */
export default function NetworkSyncWalletWarningBanner({
  availability,
  detector,
  className = "",
}: Props) {
  const state = availability ?? checkWalletAvailability(detector);

  if (state.available || !state.setupInstruction) {
    return null;
  }

  return (
    <div
      data-testid="network-sync-wallet-warning-banner"
      role="alert"
      className={`bg-warning/40 border-b border-warning px-6 py-3 text-warning-soft text-sm text-center ${className}`}
    >
      <p data-testid="network-sync-wallet-setup-instruction">
        {state.setupInstruction}
      </p>
      <a
        href={WALLET_INSTALL_URL}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="network-sync-wallet-install-link"
        className="underline font-medium hover:opacity-80"
      >
        Install Freighter
      </a>
    </div>
  );
}
