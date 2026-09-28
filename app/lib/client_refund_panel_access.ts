/**
 * client_refund_panel — access restriction helpers (#500).
 *
 * Adds role check conditional wrappers to client_refund_panel that block rendering
 * for unauthorized wallets and display a fallback warning screen.
 */

export type ClientRefundRole =
  | "client"
  | "freelancer"
  | "arbiter"
  | "admin"
  | "other"
  | "none";

export const CLIENT_REFUND_ALLOWED_ROLES: readonly ClientRefundRole[] = [
  "client",
];

export type ClientRefundAccess =
  | { allowed: true; reason: null }
  | { allowed: false; reason: "no_wallet" | "unauthorized"; warning: string };

export const CLIENT_REFUND_NO_WALLET_MESSAGE =
  "Connect a client wallet to access the refund request panel.";

export const CLIENT_REFUND_UNAUTHORIZED_WARNING =
  "Access restricted: Only the designated client on this escrow can request or view refunds.";

/** Compare the connected wallet against the client address and role. */
export function resolveClientRefundAccess(
  wallet: string | null | undefined,
  role?: ClientRefundRole | string | null,
  clientAddress?: string | null,
): ClientRefundAccess {
  if (!wallet || !wallet.trim()) {
    return {
      allowed: false,
      reason: "no_wallet",
      warning: CLIENT_REFUND_NO_WALLET_MESSAGE,
    };
  }

  const normalizedWallet = wallet.trim().toLowerCase();

  // If a specific client address is configured on the escrow, check against it
  if (clientAddress) {
    const normalizedClient = clientAddress.trim().toLowerCase();
    if (normalizedWallet !== normalizedClient) {
      return {
        allowed: false,
        reason: "unauthorized",
        warning: CLIENT_REFUND_UNAUTHORIZED_WARNING,
      };
    }
    return { allowed: true, reason: null };
  }

  // If a role is passed, check against allowed roles
  if (role) {
    const normalizedRole = role.trim().toLowerCase() as ClientRefundRole;
    if (!CLIENT_REFUND_ALLOWED_ROLES.includes(normalizedRole)) {
      return {
        allowed: false,
        reason: "unauthorized",
        warning: CLIENT_REFUND_UNAUTHORIZED_WARNING,
      };
    }
    return { allowed: true, reason: null };
  }

  return { allowed: true, reason: null };
}

/** Get fallback message for unauthorized access. */
export function getClientRefundFallbackMessage(
  access: ClientRefundAccess,
): string | null {
  return access.allowed ? null : access.warning;
}

/** Conditional wrapper: renders the panel only when authorized, otherwise fallback. */
export function guardClientRefundPanel<T, F>(
  access: ClientRefundAccess,
  renderContent: () => T,
  renderFallback: (warning: string) => F,
): T | F {
  return access.allowed ? renderContent() : renderFallback(access.warning);
}
