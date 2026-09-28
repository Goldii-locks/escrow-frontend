"use client";

/**
 * Landing page navigation.
 *
 * Marketing chrome only: logo, network badge, the four reference links and the
 * Launch App pill, exactly as design/landing-reference.html shows it.
 *
 * The notification bell, wallet selector and Connect Wallet button deliberately
 * do NOT live here. They belong to the signed-in app experience and are mounted
 * by components/Navbar.tsx, which every route behind "Launch App" renders
 * (/dashboard, /create, /admin). Adding them back here would put wallet
 * controls on a public marketing page.
 */

import { useState } from "react";
import Link from "next/link";
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
  const [menuOpen, setMenuOpen] = useState(false);

  return (
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
      </div>

      <div className="landing-navcontrols">
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

        <Link href="/dashboard" className="landing-cta">
          Launch App
          <span className="landing-cta-dot" aria-hidden="true">
            <LandingArrow size={10} />
          </span>
        </Link>
      </div>
    </nav>
  );
}
