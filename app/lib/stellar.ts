import { NETWORK_PASSPHRASE } from "@/app/lib/config";
import { explorerTxUrl } from "@/app/lib/network";

/**
 * Stellar Expert transaction URL for the configured (or supplied) network.
 *
 * Returns `null` on futurenet and any custom network Stellar Expert has no
 * explorer for, so callers can render nothing instead of throwing during
 * render (#867). Delegates to {@link explorerTxUrl}, which already encodes
 * the "no honest link" cases as `null`.
 */
export function getStellarExpertTxUrl(
  txHash: string,
  passphrase: string = NETWORK_PASSPHRASE
): string | null {
  return explorerTxUrl(txHash, passphrase);
}
