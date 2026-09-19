"use client";

import Link from "next/link";
import "./landing.css";
import LandingNav from "@/app/components/LandingNav";
import LandingLogo from "@/app/components/LandingLogo";
import LandingArrow from "@/app/components/LandingArrow";
import { CONTRACT_ID, NETWORK_PASSPHRASE } from "@/app/lib/contract";
import {
  networkProseName,
  stellarExpertContractUrl,
  truncateContractId,
} from "@/app/lib/network";

const CONTRACT_REPO = "https://github.com/Goldii-locks/escrow-contract";

/**
 * One orbiting chip.
 *
 * The nesting here is load bearing and is ported verbatim from
 * design/landing-reference.html. See the ORBIT block in landing.css for why
 * these layers cannot be collapsed into fewer elements.
 */
function OrbitChip({
  angle,
  num,
  label,
  variant,
}: {
  angle: number;
  num: string;
  label: string;
  variant: 1 | 2 | 3;
}) {
  return (
    <div
      className="landing-orbit-anchor"
      style={{ transform: `rotate(${angle}deg) translateX(330px)` }}
    >
      <div style={{ transform: `rotate(${-angle}deg)` }}>
        <div className="landing-orbit-counter">
          <div className="landing-orbit-unsquash">
            <div className={`landing-orbit-chip landing-orbit-chip-${variant}`}>
              <span className="landing-orbit-chip-dot" aria-hidden="true" />
              <span className="landing-orbit-chip-num">{num}</span>
              <span className="landing-orbit-chip-label">{label}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const explorerUrl = stellarExpertContractUrl(CONTRACT_ID, NETWORK_PASSPHRASE);
  const shortContract = truncateContractId(CONTRACT_ID);

  return (
    <div className="landing">
      <div className="landing-mesh" aria-hidden="true" />

      <LandingNav />

      {/* ----------------------------------------------------------- HERO */}
      <section className="landing-hero">
        <div className="landing-ghost landing-serif" aria-hidden="true">
          Milestone
        </div>

        {/*
          Decorative illustration. Every word inside it is repeated in the
          "How it works" section below, so it is hidden from assistive tech
          rather than read out as three rotating fragments.
        */}
        <div className="landing-scene" aria-hidden="true">
          <div className="landing-scene-inner">
            <div className="landing-bloom-a" />
            <div className="landing-bloom-b" />

            <div className="landing-ring landing-ring-1" />
            <div className="landing-ring landing-ring-2" />
            <div className="landing-ring landing-ring-3" />
            <div className="landing-ring landing-ring-4" />
            <div className="landing-ring landing-ring-5" />

            <div className="landing-core" />

            <div className="landing-bokeh landing-bokeh-1" />
            <div className="landing-bokeh landing-bokeh-2" />
            <div className="landing-bokeh landing-bokeh-3" />
            <div className="landing-bokeh landing-bokeh-4" />
            <div className="landing-bokeh landing-bokeh-5" />

            <div className="landing-orbit-plane">
              <div className="landing-orbit-ring">
                <OrbitChip angle={0} num="01" label="Create milestone" variant={1} />
                <OrbitChip angle={120} num="02" label="Deliver work" variant={2} />
                <OrbitChip angle={240} num="03" label="Approve &amp; release" variant={3} />
              </div>
            </div>
          </div>
        </div>

        <div className="landing-hero-scrim" aria-hidden="true" />

        <div className="landing-hero-copy">
          <div className="landing-eyebrow">ESCROW, SETTLED ON-CHAIN</div>
          <h1 className="landing-h1 landing-serif">
            Escrow that <em>finishes</em>
            <br />
            what it starts.
          </h1>
          <p className="landing-lede">
            Funds lock into a Stellar smart contract the moment work begins, and release
            the moment it&apos;s approved. No wire transfers, no chasing invoices, no
            intermediary holding your money.
          </p>
          <div className="landing-hero-actions">
            <Link href="/dashboard" className="landing-cta landing-cta-gold landing-cta-lg">
              Launch App
              <span className="landing-cta-dot" aria-hidden="true">
                <LandingArrow />
              </span>
            </Link>
            <a href="#security" className="landing-cta landing-cta-ghost landing-cta-lg">
              Read the contract
              <span className="landing-cta-dot" aria-hidden="true">
                <LandingArrow color="#F5F5F0" />
              </span>
            </a>
          </div>
          <div className="landing-hero-foot">
            <LandingLogo size={14} color="#8A92A6" full={false} />
            Built on the Stellar network
          </div>
        </div>

        <div className="landing-hero-fade" aria-hidden="true" />
      </section>

      {/* ---------------------------------------------------- PROOF STRIP */}
      <section className="landing-proof" aria-label="Project facts">
        <div className="landing-proof-cell">
          <div className="landing-proof-label">LIVE CONTRACT</div>
          {explorerUrl ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="landing-proof-mono landing-mono"
            >
              {shortContract}
              <LandingArrow />
            </a>
          ) : (
            <div className="landing-proof-mono landing-mono">
              {shortContract || "Not configured"}
            </div>
          )}
        </div>

        <div className="landing-proof-cell">
          <div className="landing-proof-label">TEST SUITE</div>
          <div className="landing-proof-value">708 / 708 passing</div>
        </div>

        <div className="landing-proof-cell">
          <div className="landing-proof-label">SOURCE</div>
          <a
            href={CONTRACT_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="landing-proof-link"
          >
            Open source on GitHub
            <LandingArrow />
          </a>
        </div>

        <div className="landing-proof-cell">
          <div className="landing-proof-label">CUSTODY</div>
          <div className="landing-proof-value">Non-custodial</div>
        </div>
      </section>

      {/* -------------------------------------------------------- PRODUCT */}
      <section id="product" className="landing-section">
        <div className="landing-product-head">
          <div className="landing-kicker">THE PRODUCT</div>
          <h2 className="landing-h2 landing-serif">
            Every milestone, <em>one screen.</em>
          </h2>
        </div>

        <div className="landing-product-glow" aria-hidden="true" />

        <div className="landing-panel">
          <div className="landing-panel-head">
            <div className="landing-panel-ident">
              <div className="landing-panel-avatar" aria-hidden="true">
                BI
              </div>
              <div>
                <div className="landing-panel-title">Brand identity system</div>
                <div className="landing-panel-sub">
                  Escrow #14 &middot; counterparty GBQ4&hellip;7YHK
                </div>
              </div>
            </div>
            <div className="landing-panel-status landing-mono">
              <span className="landing-badge-dot" aria-hidden="true" />
              ACTIVE ON LEDGER
            </div>
          </div>

          <div className="landing-panel-body">
            <div className="landing-rows">
              <div className="landing-row">
                <span
                  className="landing-row-dot"
                  style={{ background: "#B9A7E6" }}
                  aria-hidden="true"
                />
                <div className="landing-row-main">
                  <div className="landing-row-title">Discovery &amp; research</div>
                  <div className="landing-row-meta">Released 12 Aug</div>
                </div>
                <div className="landing-row-amount landing-mono">400 USDC</div>
                <div className="landing-row-end">
                  <span className="landing-pill landing-pill-approved">APPROVED</span>
                </div>
              </div>

              <div className="landing-row">
                <span
                  className="landing-row-dot"
                  style={{ background: "#B9A7E6" }}
                  aria-hidden="true"
                />
                <div className="landing-row-main">
                  <div className="landing-row-title">Concept directions</div>
                  <div className="landing-row-meta">Released 29 Aug</div>
                </div>
                <div className="landing-row-amount landing-mono">600 USDC</div>
                <div className="landing-row-end">
                  <span className="landing-pill landing-pill-approved">APPROVED</span>
                </div>
              </div>

              <div className="landing-row landing-row-active">
                <span
                  className="landing-row-dot"
                  style={{ background: "#1FBAA6", boxShadow: "0 0 10px #1FBAA6" }}
                  aria-hidden="true"
                />
                <div className="landing-row-main">
                  <div className="landing-row-title" style={{ fontWeight: 600 }}>
                    Final identity system
                  </div>
                  <div className="landing-row-meta">
                    Delivered 17 Sep &middot; review closes in 4 days
                  </div>
                </div>
                <div className="landing-row-amount landing-mono" style={{ color: "#F5F5F0" }}>
                  800 USDC
                </div>
                <div className="landing-row-end">
                  {/*
                    Illustration only. This panel is a picture of the product,
                    not a live view, so the control is inert and marked as such
                    instead of being wired to a contract call.
                  */}
                  <button type="button" className="landing-row-button" disabled>
                    Approve &amp; release
                  </button>
                </div>
              </div>

              <div className="landing-row">
                <span
                  className="landing-row-dot"
                  style={{ background: "#F0B90A" }}
                  aria-hidden="true"
                />
                <div className="landing-row-main">
                  <div className="landing-row-title">Brand guidelines</div>
                  <div className="landing-row-meta">Funded &middot; due 12 Oct</div>
                </div>
                <div className="landing-row-amount landing-mono">400 USDC</div>
                <div className="landing-row-end">
                  <span className="landing-pill landing-pill-progress">IN PROGRESS</span>
                </div>
              </div>
            </div>

            <div className="landing-rail">
              <div className="landing-rail-card">
                <div className="landing-rail-label">HELD IN ESCROW</div>
                <div className="landing-rail-figure landing-rail-figure-gold landing-mono">
                  1,200
                </div>
                <div className="landing-rail-note">USDC &middot; locked in contract</div>
              </div>
              <div className="landing-rail-card">
                <div className="landing-rail-label">RELEASED TO DATE</div>
                <div className="landing-rail-figure landing-mono">1,000</div>
                <div className="landing-rail-note">USDC &middot; 2 of 4 milestones</div>
              </div>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="landing-rail-link"
                >
                  View on Stellar Expert
                  <LandingArrow />
                </a>
              )}
            </div>
          </div>
        </div>

        <p className="landing-disclaimer">
          Illustrative escrow. The figures shown are an example, not live ledger data.
        </p>
      </section>

      {/* --------------------------------------------------- HOW IT WORKS */}
      <section id="how-it-works" className="landing-section">
        <div className="landing-section-head">
          <div>
            <div className="landing-kicker">HOW IT WORKS</div>
            <h2 className="landing-h2 landing-serif">
              Three steps, <em>one contract.</em>
            </h2>
          </div>
          <p className="landing-section-aside">
            Each step emits an event to the Stellar ledger. Both sides read the same
            record, and so can anyone auditing.
          </p>
        </div>

        <div className="landing-steps">
          <div className="landing-step landing-step-1">
            <div className="landing-step-head">
              <span
                className="landing-step-dot"
                style={{ background: "#F0B90A", boxShadow: "0 0 14px #F0B90A" }}
                aria-hidden="true"
              />
              <span className="landing-step-num">01</span>
            </div>
            <h3 className="landing-step-title landing-serif">Create &amp; fund</h3>
            <p className="landing-step-body">
              The contract records each milestone&apos;s amount and deadline, then takes
              custody of the funds. They leave the client&apos;s wallet but never reach
              the provider&apos;s. They sit in the contract.
            </p>
            <div className="landing-step-emits landing-mono" style={{ color: "#F0B90A" }}>
              emits init &middot; fund
            </div>
          </div>

          <div className="landing-step landing-step-2">
            <div className="landing-step-head">
              <span
                className="landing-step-dot"
                style={{ background: "#1FBAA6", boxShadow: "0 0 14px #1FBAA6" }}
                aria-hidden="true"
              />
              <span className="landing-step-num">02</span>
            </div>
            <h3 className="landing-step-title landing-serif">Deliver work</h3>
            <p className="landing-step-body">
              The provider marks the milestone delivered. The ledger timestamps it and the
              review window opens, a clock neither side can quietly reset.
            </p>
            <div className="landing-step-emits landing-mono" style={{ color: "#1FBAA6" }}>
              emits deliver
            </div>
          </div>

          <div className="landing-step landing-step-3">
            <div className="landing-step-head">
              <span
                className="landing-step-dot"
                style={{ background: "#B9A7E6", boxShadow: "0 0 14px #B9A7E6" }}
                aria-hidden="true"
              />
              <span className="landing-step-num">03</span>
            </div>
            <h3 className="landing-step-title landing-serif">Approve &amp; release</h3>
            <p className="landing-step-body">
              Approval moves the funds in the same transaction. Partial approval is
              supported, so a milestone can settle proportionally instead of
              all-or-nothing.
            </p>
            <div className="landing-step-emits landing-mono" style={{ color: "#B9A7E6" }}>
              emits approve
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- SECURITY */}
      <section id="security" className="landing-section">
        <div className="landing-section-head">
          <div>
            <div className="landing-kicker">SECURITY</div>
            <h2 className="landing-h2 landing-serif">
              When things <em>go wrong.</em>
            </h2>
          </div>
          <p className="landing-section-aside">
            Escrow only matters when a deal sours. Here is exactly what the contract does
            then, including the parts that require trusting us.
          </p>
        </div>

        <div className="landing-cards">
          <div className="landing-card">
            <h3>The client never approves.</h3>
            <p>
              Every milestone carries a deadline. Once the review window closes, the
              provider claims auto-release directly from the contract. No counter-signature
              needed.
            </p>
          </div>

          <div className="landing-card">
            <h3>You genuinely disagree.</h3>
            <p>
              Either side can raise a dispute. Resolution can split a milestone between
              both parties, so a half-finished job doesn&apos;t have to end in a total loss
              for someone.
            </p>
          </div>

          <div className="landing-card">
            <h3>The work needs more time.</h3>
            <p>
              Deadlines can be extended, but consent from both sides is recorded on-chain
              first. Neither party can move the finish line alone.
            </p>
          </div>

          <div className="landing-card landing-card-flag">
            <h3>Who can touch the funds.</h3>
            <p>
              Milestone never custodies your money. The contract does. But an admin key
              exists and can pause the contract or force a release or refund. We&apos;d
              rather say so plainly than let you find it in the source.
            </p>
          </div>

          <div className="landing-card">
            <h3>Why that key is bounded.</h3>
            <p>
              The most sensitive overrides are multisig-gated, admin transfers are proposed
              and executed in separate steps, and every action emits an event you can audit
              on the ledger.
            </p>
          </div>

          <div className="landing-card">
            <h3>What it costs.</h3>
            <p>
              A platform fee allocation is set in the contract and can be locked so it
              cannot change mid-project. Free while we&apos;re on testnet, then{" "}
              <span className="landing-fee-placeholder">[SET YOUR FEE]</span>.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ CTA */}
      <section className="landing-cta-band">
        <div className="landing-cta-bloom" aria-hidden="true" />
        <div className="landing-cta-ring landing-cta-ring-1" aria-hidden="true" />
        <div className="landing-cta-ring landing-cta-ring-2" aria-hidden="true" />
        <div className="landing-cta-ring landing-cta-ring-3" aria-hidden="true" />

        <div className="landing-cta-inner">
          <h2 className="landing-cta-h2 landing-serif">
            Ready to release your
            <br />
            first <em>milestone</em>?
          </h2>
          <p className="landing-cta-lede">
            Set up an escrow in minutes. Funded, timestamped and enforced by the contract,
            not a promise.
          </p>
          <Link href="/dashboard" className="landing-cta landing-cta-xl">
            Launch App
            <span className="landing-cta-dot" aria-hidden="true">
              <LandingArrow size={12} />
            </span>
          </Link>
        </div>
      </section>

      {/* --------------------------------------------------------- FOOTER */}
      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <LandingLogo size={17} color="#8A92A6" full={false} />
          <span>
            &copy; 2026 Milestone. Running on Stellar{" "}
            {networkProseName(NETWORK_PASSPHRASE)}.
          </span>
        </div>
        <div className="landing-footer-links">
          <a href="#security">Security</a>
          <a href="https://github.com/Goldii-locks" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a
            href="https://github.com/Goldii-locks/escrow-frontend/issues"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact
          </a>
        </div>
      </footer>
    </div>
  );
}
