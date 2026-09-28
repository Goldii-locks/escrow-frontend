"use client";

import {
  checkFreighterAvailability,
  FREIGHTER_INSTALL_URL,
  type FreighterAvailabilityState,
} from "@/app/lib/freighter_connector";

interface Props {
  /** Optional precomputed availability state; when omitted, the banner detects on render. */
  availability?: FreighterAvailabilityState | null;
  /** Optional detector override (useful in tests). */
  detector?: () => boolean;
  className?: string;
}

/**
 * Warning banner rendered by freighter_connector when the Freighter browser
 * extension is not installed. Displays setup instructions and an install link.
 */
export default function FreighterWalletWarningBanner({
  availability,
  detector,
  className = "",
}: Props) {
  const state = availability ?? checkFreighterAvailability(detector);

  if (state.available || !state.setupInstruction) {
    return null;
  }

  return (
    <div
      data-testid="freighter-wallet-warning-banner"
      role="alert"
      className={`bg-warning/40 border-b border-warning px-6 py-3 text-warning-soft text-sm text-center ${className}`}
    >
      <p data-testid="freighter-wallet-setup-instruction">
        {state.warningMessage ?? state.setupInstruction}
      </p>
      <a
        href={FREIGHTER_INSTALL_URL}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="freighter-wallet-install-link"
        className="underline font-medium hover:opacity-80"
      >
        Install Freighter
      </a>
    </div>
  );
}
