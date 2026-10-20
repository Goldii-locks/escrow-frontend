import { NETWORK_PASSPHRASE } from "@/app/lib/contract";
import { explorerTxUrl } from "@/app/lib/network";

export function getStellarExpertTxUrl(txHash: string): string {
  const url = explorerTxUrl(txHash, NETWORK_PASSPHRASE);
  if (!url) {
    throw new Error(`No Stellar Expert explorer URL for tx ${txHash} on current network`);
  }
  return url;
}
