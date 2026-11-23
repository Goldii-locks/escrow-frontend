import { networkKind } from "@/app/lib/network";
import { NETWORK_PASSPHRASE } from "@/app/lib/network_config";

const STELLAR_EXPERT = "https://stellar.expert/explorer";

/**
 * Stellar Expert transaction URL for the configured (or supplied) network.
 *
 * Returns `null` on futurenet, standalone, quickstart and any custom
 * passphrase: Stellar Expert has no explorer for those networks, so linking to
 * testnet would be misleading and used to throw during render (#867).
 */
export function getStellarExpertTxUrl(
  txHash: string,
  passphrase: string = NETWORK_PASSPHRASE,
): string | null {
  if (!txHash) return null;

  const network = networkKind(passphrase);
  if (network === "public") {
    return `${STELLAR_EXPERT}/public/tx/${txHash}`;
  }
  if (network === "testnet") {
    return `${STELLAR_EXPERT}/testnet/tx/${txHash}`;
  }
  return null;
}
