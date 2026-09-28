/**
 * contract_pause_switch - Role-based access restrictions for the emergency
 * freeze toggle (Issue #470). Unauthorized wallets never see the toggle; they
 * get a fallback warning instead.
 */

export type ContractPauseRole = "admin" | "arbiter" | "user" | "none";

/** Roles allowed to operate the freeze switch. */
export const CONTRACT_PAUSE_ALLOWED_ROLES: readonly ContractPauseRole[] = ["admin"];

export type ContractPauseAccess =
  | { allowed: true; reason: null }
  | { allowed: false; reason: "no_wallet" | "unauthorized" };

export const CONTRACT_PAUSE_NO_WALLET_MESSAGE =
  "Connect an admin wallet to access the emergency freeze switch.";
export const CONTRACT_PAUSE_UNAUTHORIZED_MESSAGE =
  "Your wallet is not authorized to pause or resume the contract.";

/** Resolves a wallet's access. Missing wallets or unknown roles are denied. */
export function resolveContractPauseAccess(
  wallet: string | null | undefined,
  role: ContractPauseRole | null | undefined,
): ContractPauseAccess {
  if (!wallet || !wallet.trim()) return { allowed: false, reason: "no_wallet" };
  if (!role || !CONTRACT_PAUSE_ALLOWED_ROLES.includes(role)) {
    return { allowed: false, reason: "unauthorized" };
  }
  return { allowed: true, reason: null };
}

/** Warning copy for the fallback screen, or null when access is allowed. */
export function getContractPauseFallbackMessage(access: ContractPauseAccess): string | null {
  if (access.allowed) return null;
  return access.reason === "no_wallet"
    ? CONTRACT_PAUSE_NO_WALLET_MESSAGE
    : CONTRACT_PAUSE_UNAUTHORIZED_MESSAGE;
}

/** Conditional wrapper: renders the toggle only when authorized. */
export function guardContractPauseSwitch<T>(
  access: ContractPauseAccess,
  renderSwitch: () => T,
  renderFallback: (message: string) => T,
): T {
  const message = getContractPauseFallbackMessage(access);
  return message === null ? renderSwitch() : renderFallback(message);
}
