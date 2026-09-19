"use client";

/**
 * Landing page navigation.
 *
 * The design reference shows a marketing-only nav (logo, network badge, four
 * links, one CTA). The live site also has a working notification bell, a
 * wallet selector and Connect Wallet wired to Stellar Wallets Kit. This
 * component takes the reference's visual treatment and keeps those controls
 * mounted and functional rather than choosing between the two.
 *
 * The app routes keep using components/Navbar.tsx; this is landing only.
 */

import { useState } from "react";
import Link from "next/link";
import { useWallet, SUPPORTED_WALLETS } from "@/app/context/WalletContext";
import { useIsAdmin } from "@/app/hooks/useIsAdmin";
import NotificationBell from "./NotificationBell";
import WalletBadge, { formatAddress } from "./WalletBadge";
import LandingLogo from "./LandingLogo";
import LandingArrow from "./LandingArrow";
import { NETWORK_PASSPHRASE } from "@/app/lib/contract";
import { networkLabel } from "@/app/lib/network";

const MARKETING_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#product", label: "Product" },
  { href: "#security", label: "Security" },
  { href: "https://github.com/Goldii-locks", label: "GitHub", external: true },
];

export default function LandingNav() {
  const {
    address,
    connect,
    disconnect,
    isConnecting,
    networkMismatchMessage,
    selectedWalletId,
    setSelectedWalletId,
  } = useWallet();
  const { isAdminUser } = useIsAdmin(address);
  const [menuOpen, setMenuOpen] = useState(false);

  const selectedWallet = SUPPORTED_WALLETS.find((w) => w.id === selectedWalletId);

  return (
    <>
      {networkMismatchMessage && (
        <div
          role="alert"
          style={{
            position: "relative",
            zIndex: 9,
            padding: "10px 24px",
            textAlign: "center",
            fontSize: 13,
            color: "#F0B90A",
            background: "rgba(240,185,10,0.1)",
            borderBottom: "1px solid rgba(240,185,10,0.28)",
          }}
        >
          {networkMismatchMessage}
        </div>
      )}

      <nav aria-label="Primary" className="landing-nav">
        <div className="landing-brand">
          <Link
            href="/"
            aria-label="Milestone home"
            style={{ display: "inline-flex", alignItems: "center", gap: 11 }}
          >
            <LandingLogo />
            <span className="landing-brand-name landing-serif">Milestone.</span>
          </Link>
          <span className="landing-badge landing-mono">
            <span className="landing-badge-dot" aria-hidden="true" />
            {networkLabel(NETWORK_PASSPHRASE)}
          </span>
        </div>

        <div
          id="landing-marketing-links"
          className={`landing-navlinks${menuOpen ? " landing-navlinks-open" : ""}`}
        >
          {MARKETING_LINKS.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="landing-navlink"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ) : (
              <a
                key={link.href}
                href={link.href}
                className="landing-navlink"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ),
          )}
          {address && isAdminUser && (
            <Link href="/admin" className="landing-navlink" onClick={() => setMenuOpen(false)}>
              Admin
            </Link>
          )}
        </div>

        <div className="landing-navcontrols">
          <NotificationBell count={0} />

          {address ? (
            <>
              <WalletBadge
                address={address}
                isConnecting={isConnecting}
                providerName={selectedWallet?.label}
                networkMismatch={networkMismatchMessage}
              />
              <span
                role="status"
                aria-label={`Connected wallet ${address}`}
                className="landing-mono"
                style={{
                  fontSize: 12,
                  color: "#A8AFC0",
                  background: "rgba(245,245,240,0.06)",
                  padding: "6px 12px",
                  borderRadius: 999,
                }}
              >
                {formatAddress(address)}
              </span>
              <button
                type="button"
                onClick={disconnect}
                style={{
                  background: "rgba(245,245,240,0.06)",
                  color: "#F5F5F0",
                  border: "1px solid rgba(245,245,240,0.16)",
                  padding: "8px 16px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              <label htmlFor="landing-wallet-provider" className="sr-only">
                Wallet provider
              </label>
              <select
                id="landing-wallet-provider"
                value={selectedWalletId}
                onChange={(event) =>
                  setSelectedWalletId(
                    event.target.value as (typeof SUPPORTED_WALLETS)[number]["id"],
                  )
                }
                aria-label="Wallet provider"
                disabled={isConnecting}
                style={{
                  background: "rgba(245,245,240,0.06)",
                  color: "#F5F5F0",
                  border: "1px solid rgba(245,245,240,0.16)",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontSize: 13,
                }}
              >
                {SUPPORTED_WALLETS.map((wallet) => (
                  <option key={wallet.id} value={wallet.id} style={{ color: "#14110A" }}>
                    {wallet.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={connect}
                disabled={isConnecting}
                style={{
                  background: "rgba(245,245,240,0.06)",
                  color: "#F5F5F0",
                  border: "1px solid rgba(245,245,240,0.16)",
                  padding: "8px 16px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 500,
                  opacity: isConnecting ? 0.5 : 1,
                }}
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            </>
          )}

          <button
            type="button"
            className="landing-menu-button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="landing-marketing-links"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              {menuOpen ? (
                <path
                  d="M3 3 L13 13 M13 3 L3 13"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M2 4 H14 M2 8 H14 M2 12 H14"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>

        <Link href="/dashboard" className="landing-cta">
          Launch App
          <span className="landing-cta-dot" aria-hidden="true">
            <LandingArrow size={10} />
          </span>
        </Link>
      </nav>
    </>
  );
}
