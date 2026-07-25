"use client";

/**
 * network_sync_checker
 *
 * Core utilities for checking whether the connected wallet's network matches
 * the app's configured Stellar network (e.g. Testnet vs Mainnet).
 *
 * This module is intentionally side-effect-free so it can be imported from
 * both React hooks and plain unit tests.
 */

import { Networks } from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE } from "@/app/lib/contract";

/** Human-readable name for a Stellar network passphrase. */
export function getNetworkName(passphrase: string): string {
  switch (passphrase) {
    case Networks.TESTNET:
      return "Testnet";
    case Networks.PUBLIC:
      return "Mainnet";
    case Networks.FUTURENET:
      return "Futurenet";
    case Networks.SANDBOX:
      return "Sandbox";
    case Networks.STANDALONE:
      return "Standalone";
    default:
      return "Unknown Network";
  }
}

/** The network the app is configured to use. */
export const APP_NETWORK_NAME = getNetworkName(NETWORK_PASSPHRASE);

export interface NetworkCheckResult {
  /** Whether the wallet's network matches the app network. */
  mismatch: boolean;
  /** The network passphrase reported by the wallet. */
  walletPassphrase: string | null;
  /** Human-readable label of the wallet's network. */
  walletNetworkName: string | null;
  /** Human-readable label of the app's configured network. */
  appNetworkName: string;
}

/**
 * Performs a raw network check via the provided getter function.
 * Abstracted so tests can inject a stub instead of calling StellarWalletsKit directly.
 */
export async function runNetworkCheck(
  getNetwork: () => Promise<{ networkPassphrase: string }>
): Promise<NetworkCheckResult> {
  const { networkPassphrase } = await getNetwork();
  const mismatch = networkPassphrase !== NETWORK_PASSPHRASE;
  return {
    mismatch,
    walletPassphrase: networkPassphrase,
    walletNetworkName: getNetworkName(networkPassphrase),
    appNetworkName: APP_NETWORK_NAME,
  };
}

/**
 * Builds the warning message shown in the network mismatch banner.
 * Exported so the banner component and tests share the same string logic.
 */
export function buildMismatchMessage(
  walletName: string,
  walletNetworkName: string | null,
  appNetworkName: string
): string {
  const walletNet = walletNetworkName ?? "an unknown network";
  return `⚠️ Network mismatch: Your ${walletName} wallet is on ${walletNet}, but this app requires ${appNetworkName}. Please switch your wallet.`;
}
