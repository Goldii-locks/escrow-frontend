/**
 * freelancer_claim_panel - access restriction helpers (#490).
 * Decides whether the freelancer payout claim panel may render for a wallet.
 * Block rendering for unauthorized wallets with a fallback warning screen.
 */

export type FreelancerClaimRole =
  | "freelancer"
  | "client"
  | "arbiter"
  | "admin"
  | "other"
  | "none";

export const FREELANCER_CLAIM_ALLOWED_ROLES: readonly FreelancerClaimRole[] = [
  "freelancer",
];

export type FreelancerClaimAccess =
  | { allowed: true; reason: null }
  | { allowed: false; reason: "no_wallet" | "unauthorized"; warning: string };

export const FREELANCER_CLAIM_NO_WALLET_MESSAGE =
  "Connect a freelancer wallet to access the payout claim panel.";

export const FREELANCER_CLAIM_UNAUTHORIZED_WARNING =
  "Access restricted: Only the designated freelancer can claim payouts on this escrow.";

/** Compare the connected wallet against the freelancer address and role. */
export function resolveFreelancerClaimAccess(
  wallet: string | null | undefined,
  role?: FreelancerClaimRole | string | null,
  freelancerAddress?: string | null,
): FreelancerClaimAccess {
  if (!wallet || !wallet.trim()) {
    return {
      allowed: false,
      reason: "no_wallet",
      warning: FREELANCER_CLAIM_NO_WALLET_MESSAGE,
    };
  }

  const normalizedWallet = wallet.trim().toLowerCase();

  // If a specific freelancer address is configured, check against it
  if (freelancerAddress) {
    const normalizedFreelancer = freelancerAddress.trim().toLowerCase();
    if (normalizedWallet !== normalizedFreelancer) {
      return {
        allowed: false,
        reason: "unauthorized",
        warning: FREELANCER_CLAIM_UNAUTHORIZED_WARNING,
      };
    }
    return { allowed: true, reason: null };
  }

  // If a role is passed, check against allowed roles
  if (role) {
    const normalizedRole = role.trim().toLowerCase() as FreelancerClaimRole;
    if (!FREELANCER_CLAIM_ALLOWED_ROLES.includes(normalizedRole)) {
      return {
        allowed: false,
        reason: "unauthorized",
        warning: FREELANCER_CLAIM_UNAUTHORIZED_WARNING,
      };
    }
    return { allowed: true, reason: null };
  }

  return { allowed: true, reason: null };
}

/** Get fallback message for unauthorized access. */
export function getFreelancerClaimFallbackMessage(
  access: FreelancerClaimAccess,
): string | null {
  return access.allowed ? null : access.warning;
}

/** Conditional wrapper: renders the panel only when authorized, otherwise fallback. */
export function guardFreelancerClaimPanel<T, F>(
  access: FreelancerClaimAccess,
  renderContent: () => T,
  renderFallback: (warning: string) => F,
): T | F {
  return access.allowed ? renderContent() : renderFallback(access.warning);
}
