"use client";

import {
  checkLedgerAvailability,
  LEDGER_SETUP_URL,
  type LedgerAvailabilityState,
} from "@/app/lib/ledger_usb_bridge";

interface Props {
  /** Optional precomputed availability state; when omitted, the banner detects on render. */
  availability?: LedgerAvailabilityState | null;
  /** Optional detector override (useful in tests). */
  detector?: () => { hasWebUsb: boolean; hasWebHid: boolean };
  className?: string;
}

/**
 * Warning banner rendered when the user's browser does not support the
 * WebUSB or WebHID APIs required to communicate with a Ledger hardware
 * wallet. Displays setup instructions and a link to Ledger support docs.
 */
export default function LedgerWalletWarningBanner({
  availability,
  detector,
  className = "",
}: Props) {
  const state = availability ?? checkLedgerAvailability(detector);

  if (state.available || !state.setupInstruction) {
    return null;
  }

  return (
    <div
      data-testid="ledger-wallet-warning-banner"
      role="alert"
      className={`bg-warning/40 border-b border-warning px-6 py-3 text-warning-soft text-sm text-center ${className}`}
    >
      <p data-testid="ledger-wallet-setup-instruction">
        {state.setupInstruction}
      </p>
      <a
        href={LEDGER_SETUP_URL}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="ledger-wallet-setup-link"
        className="underline font-medium hover:opacity-80"
      >
        Ledger connection guide
      </a>
    </div>
  );
}
