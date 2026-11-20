"use client";

/**
 * TestnetOnboardingPanel — a dismissible "Get set up" panel shown on testnet
 * builds only, when the connected account needs funding or a token trustline.
 *
 * Rules:
 * - Only renders when `isTestnet()` returns true (constant per build).
 * - Hidden when no wallet is connected.
 * - Hidden after the user dismisses it (session-scoped).
 * - Polls account status each time the wallet address changes.
 *
 * Actions offered:
 * 1. "Fund with Friendbot" — when the account doesn't exist yet.
 * 2. "Add trustline" — when the account has no trustline for `tokenAddress`.
 * 3. A faucet link — when the token balance is zero (optional, configured via
 *    the NEXT_PUBLIC_TOKEN_FAUCET_URL env var).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useWallet } from "@/app/context/WalletContext";
import { useToast } from "@/app/context/ToastContext";
import {
  isTestnet,
  fetchAccountStatus,
  fundWithFriendbot,
  buildChangeTrustXdr,
  type AccountStatus,
} from "@/app/lib/testnet_onboarding";

interface Props {
  /**
   * Soroban contract address (C...) for the token the user will interact with.
   * When omitted the trustline and faucet checks are skipped.
   */
  tokenAddress?: string;
}

/** Optional faucet URL configured at build time. */
const TOKEN_FAUCET_URL = process.env.NEXT_PUBLIC_TOKEN_FAUCET_URL ?? "";

/**
 * Inner implementation — only mounted when the build is a testnet build.
 * Separating it from the guard keeps hook call order unconditional.
 */
function TestnetOnboardingPanelInner({ tokenAddress }: Props) {
  const { address, signTransaction } = useWallet();
  const { showToast } = useToast();

  const [dismissed, setDismissed] = useState(false);
  // The status is kept with the address it was fetched for, so a stale entry
  // (wallet switched or disconnected) is ignored at render instead of being
  // cleared synchronously inside the effect.
  const [statusEntry, setStatusEntry] = useState<{
    address: string;
    status: AccountStatus;
  } | null>(null);
  const status = address && statusEntry?.address === address ? statusEntry.status : null;
  const [fundingInProgress, setFundingInProgress] = useState(false);
  const [trustlineInProgress, setTrustlineInProgress] = useState(false);

  const statusAbortRef = useRef<AbortController | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!address) return;

    statusAbortRef.current?.abort();
    const controller = new AbortController();
    statusAbortRef.current = controller;

    const result = await fetchAccountStatus(address, tokenAddress ?? "");

    if (controller.signal.aborted) return;
    setStatusEntry({ address, status: result });
  }, [address, tokenAddress]);

  // Load the status whenever the wallet or token changes. The fetch is inline
  // (rather than through refreshStatus) so state is only set from the promise
  // callback, never synchronously in the effect body.
  useEffect(() => {
    if (!address) return;
    statusAbortRef.current?.abort();
    const controller = new AbortController();
    statusAbortRef.current = controller;
    void fetchAccountStatus(address, tokenAddress ?? "").then((result) => {
      if (controller.signal.aborted) return;
      setStatusEntry({ address, status: result });
    });
    return () => {
      controller.abort();
    };
  }, [address, tokenAddress]);

  // ── Determine which actions to show ───────────────────────────────────────
  const needsFunding = status?.notFound === true;
  const needsTrustline =
    !needsFunding && Boolean(tokenAddress) && status?.missingTrustline === true;
  const needsFaucet =
    !needsFunding &&
    !needsTrustline &&
    Boolean(tokenAddress) &&
    Boolean(TOKEN_FAUCET_URL) &&
    status?.zeroBalance === true;

  const hasAnything = needsFunding || needsTrustline || needsFaucet;

  if (!address || !hasAnything || dismissed) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleFund = async () => {
    if (!address) return;
    setFundingInProgress(true);
    try {
      await fundWithFriendbot(address);
      showToast("Account funded! You now have 10 000 XLM on testnet.", "success");
      await refreshStatus();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Friendbot request failed. Please try again.",
        "error"
      );
    } finally {
      setFundingInProgress(false);
    }
  };

  const handleAddTrustline = async () => {
    if (!address || !tokenAddress) return;
    setTrustlineInProgress(true);
    try {
      const xdr = await buildChangeTrustXdr(address, tokenAddress);
      await signTransaction(xdr);
      showToast("Trustline added. You can now receive this token.", "success");
      await refreshStatus();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to add trustline. Please try again.",
        "error"
      );
    } finally {
      setTrustlineInProgress(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      data-testid="testnet-onboarding-panel"
      role="region"
      aria-label="Testnet onboarding"
      className="mx-4 mt-4 rounded-lg border border-info-soft/40 bg-info-soft/10 px-4 py-3 text-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-info-soft">🚀 Get set up on testnet</p>
        <button
          type="button"
          aria-label="Dismiss onboarding panel"
          onClick={() => setDismissed(true)}
          className="text-text-muted hover:text-text-primary transition-colors shrink-0"
        >
          ✕
        </button>
      </div>

      <ul className="mt-2 space-y-2">
        {needsFunding && (
          <li className="flex flex-wrap items-center gap-2">
            <span className="text-text-secondary">
              Your account doesn&rsquo;t exist yet — it needs XLM before any transaction can be
              built.
            </span>
            <button
              type="button"
              data-testid="friendbot-fund-button"
              onClick={() => void handleFund()}
              disabled={fundingInProgress}
              className="rounded-md bg-info-soft/20 px-3 py-1 text-xs font-medium text-info-soft hover:bg-info-soft/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {fundingInProgress ? "Funding…" : "Fund with Friendbot"}
            </button>
          </li>
        )}

        {needsTrustline && (
          <li className="flex flex-wrap items-center gap-2">
            <span className="text-text-secondary">
              No trustline for this token — payments into your account will fail until you add one.
            </span>
            <button
              type="button"
              data-testid="add-trustline-button"
              onClick={() => void handleAddTrustline()}
              disabled={trustlineInProgress}
              className="rounded-md bg-info-soft/20 px-3 py-1 text-xs font-medium text-info-soft hover:bg-info-soft/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {trustlineInProgress ? "Adding…" : "Add trustline"}
            </button>
          </li>
        )}

        {needsFaucet && (
          <li className="flex flex-wrap items-center gap-2">
            <span className="text-text-secondary">
              Your token balance is zero. Get test tokens from the faucet before funding a job.
            </span>
            <a
              href={TOKEN_FAUCET_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="token-faucet-link"
              className="rounded-md bg-info-soft/20 px-3 py-1 text-xs font-medium text-info-soft hover:bg-info-soft/30 transition-colors"
            >
              Get test tokens ↗
            </a>
          </li>
        )}
      </ul>
    </div>
  );
}

/**
 * Public export — renders the inner panel only on testnet builds, rendering
 * nothing at all on mainnet/futurenet.
 */
export default function TestnetOnboardingPanel(props: Props) {
  if (!isTestnet()) return null;
  return <TestnetOnboardingPanelInner {...props} />;
}
