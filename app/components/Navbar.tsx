"use client";
import { useWallet } from "@/app/context/WalletContext";
import { useIsAdmin } from "@/app/hooks/useIsAdmin";
import { SUPPORTED_WALLETS } from "@/app/context/WalletContext";
import Link from "next/link";
import NotificationBell from "./NotificationBell";
import WalletConnectButton from "./WalletConnectButton";
import LandingLogo from "./LandingLogo";

import WalletBadge, { formatAddress } from "@/app/components/WalletBadge";

export default function Navbar() {
  const { address, disconnect, isConnecting, networkMismatchMessage, selectedWalletId } =
    useWallet();
  const { isAdminUser } = useIsAdmin(address);

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 rounded";

  const selectedWallet = SUPPORTED_WALLETS.find((w) => w.id === selectedWalletId);

  return (
    <>
      {networkMismatchMessage && (
        <div
          className="bg-warning/40 border-b border-warning px-6 py-3 text-warning-soft text-sm text-center"
          role="alert"
        >
          ⚠️ {networkMismatchMessage}
        </div>
      )}
      {/*
       * `relative z-10` establishes a stacking context so the nav sits above
       * non-overlay page content on mobile. The full-screen WalletLoaderOverlay
       * intentionally uses z-50 and will still cover the nav
       * correctly during wallet operations.
       */}
      <nav
        aria-label="Primary"
        className="relative z-10 border-b border-border-subtle bg-surface-page px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 flex-wrap"
      >
        <Link
          href="/"
          aria-label="Milestone home"
          className={`text-xl font-bold text-text-primary tracking-tight shrink-0 inline-flex items-center gap-2 ${focusRing}`}
        >
          <LandingLogo size={24} />
          <span>Milestone</span>
        </Link>
        {/*
         * `flex-wrap` allows nav items to wrap to a second line on narrow
         * viewports (e.g. iPhone SE 375px wide) instead of overflowing
         * horizontally and pushing the wallet badge out of the clickable area.
         * `min-w-0` prevents flex children from refusing to shrink.
         */}
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap min-w-0">
          <NotificationBell count={0} />
          {address ? (
            <>
              <Link
                href="/dashboard"
                className={`text-sm text-text-secondary hover:text-text-primary transition ${focusRing}`}
              >
                Dashboard
              </Link>
              <Link
                href="/create"
                className={`text-sm text-text-secondary hover:text-text-primary transition ${focusRing}`}
              >
                + New Job
              </Link>
              {isAdminUser && (
                <Link
                  href="/admin"
                  className={`text-sm text-text-secondary hover:text-text-primary transition ${focusRing}`}
                >
                  Admin
                </Link>
              )}
              <WalletBadge
                address={address}
                isConnecting={isConnecting}
                providerName={selectedWallet?.label}
                networkMismatch={networkMismatchMessage}
                className="shrink-0"
              />
              <span
                role="status"
                className="text-xs sm:text-sm text-text-secondary font-mono bg-surface-field px-2 py-0.5 sm:px-3 sm:py-1 rounded-full transition-colors duration-200"
                aria-label={`Connected wallet ${address}`}
              >
                {formatAddress(address)}
              </span>
              <button
                onClick={disconnect}
                className={`bg-surface-card hover:bg-surface-field text-text-primary text-sm font-medium px-4 py-2 rounded-lg transition ${focusRing}`}
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              <WalletConnectButton />
            </>
          )}
        </div>
      </nav>
    </>
  );
}
