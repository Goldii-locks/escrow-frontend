/**
 * Display helpers derived from the deploy-time network configuration.
 *
 * Nothing here is hardcoded to testnet. The landing page reads these so the
 * network badge and the explorer link self-correct when NEXT_PUBLIC_SOROBAN_
 * NETWORK_PASSPHRASE and NEXT_PUBLIC_CONTRACT_ID are rebuilt against mainnet.
 */
import { Networks } from "@stellar/stellar-sdk";

export type NetworkKind = "testnet" | "public" | "futurenet" | "unknown";

export function networkKind(passphrase: string): NetworkKind {
  switch (passphrase) {
    case Networks.TESTNET:
      return "testnet";
    case Networks.PUBLIC:
      return "public";
    case Networks.FUTURENET:
      return "futurenet";
    default:
      return "unknown";
  }
}

/** Short uppercase label for the nav badge. */
export function networkLabel(passphrase: string): string {
  switch (networkKind(passphrase)) {
    case "testnet":
      return "TESTNET";
    case "public":
      return "MAINNET";
    case "futurenet":
      return "FUTURENET";
    default:
      return "CUSTOM NET";
  }
}

/** Lowercase name for running prose, as in "Running on Stellar testnet." */
export function networkProseName(passphrase: string): string {
  switch (networkKind(passphrase)) {
    case "testnet":
      return "testnet";
    case "public":
      return "mainnet";
    case "futurenet":
      return "futurenet";
    default:
      return "a custom network";
  }
}

/**
 * Stellar Expert contract URL, or null when there is nothing honest to link to.
 *
 * Mainnet's path segment is "public", not "mainnet". Stellar Expert has no
 * futurenet explorer, so that case returns null rather than a link that 404s.
 */
export function stellarExpertContractUrl(
  contractId: string,
  passphrase: string,
): string | null {
  if (!contractId) return null;
  const kind = networkKind(passphrase);
  if (kind === "public") {
    return `https://stellar.expert/explorer/public/contract/${contractId}`;
  }
  if (kind === "testnet") {
    return `https://stellar.expert/explorer/testnet/contract/${contractId}`;
  }
  return null;
}

/**
 * Truncate a contract ID for display as FIRST6...LAST7, matching the design
 * reference. Short or empty values are passed through untouched.
 */
export function truncateContractId(id: string, head = 6, tail = 7): string {
  if (!id) return "";
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}
