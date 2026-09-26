/**
 * admin_fee_configuration — access restriction helpers (#460).
 * Decides whether the fee configuration form may render for a wallet.
 */

export type FeeConfigAccess =
  | { allowed: true }
  | { allowed: false; reason: "no_wallet" | "not_admin"; warning: string };

export const FEE_CONFIG_UNAUTHORIZED_WARNING =
  "Access restricted: only the contract admin can update system transaction fees.";

/** Compare the connected wallet against the admin address. */
export function getFeeConfigAccess(
  wallet: string | null | undefined,
  adminAddress: string | null | undefined,
): FeeConfigAccess {
  if (!wallet) {
    return { allowed: false, reason: "no_wallet", warning: "Connect a wallet to continue." };
  }
  if (!adminAddress || wallet.trim() !== adminAddress.trim()) {
    return { allowed: false, reason: "not_admin", warning: FEE_CONFIG_UNAUTHORIZED_WARNING };
  }
  return { allowed: true };
}

/** Role-check wrapper: returns the content when allowed, otherwise the fallback warning. */
export function guardFeeConfig<T, F>(
  access: FeeConfigAccess,
  content: () => T,
  fallback: (warning: string) => F,
): T | F {
  return access.allowed ? content() : fallback(access.warning);
}
