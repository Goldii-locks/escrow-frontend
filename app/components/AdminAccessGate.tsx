import type { ReactNode } from "react";
import AdminWhitelistSkeleton from "./AdminWhitelistSkeleton";

export interface AdminAccessGateProps {
  /** Connected wallet address, if any. */
  address: string | null | undefined;
  /** True while the admin check is still running. */
  loading: boolean;
  /** Whether the connected wallet is the contract admin. */
  isAdmin: boolean;
  /** Protected content; never rendered for unauthorized wallets. */
  children: ReactNode;
}

/**
 * Role-check wrapper for the admin whitelist panel. Children render only for
 * a connected admin wallet; every other state shows a prompt, skeleton or
 * the "Access Denied" fallback warning instead.
 */
export default function AdminAccessGate({
  address,
  loading,
  isAdmin,
  children,
}: AdminAccessGateProps) {
  if (!address) {
    return (
      <p className="text-center text-gray-500">
        Connect your wallet to manage the whitelist.
      </p>
    );
  }

  if (loading) {
    return (
      <AdminWhitelistSkeleton label="Verifying admin access" rows={2} />
    );
  }

  if (!isAdmin) {
    return (
      <div
        role="alert"
        data-testid="admin-access-denied"
        className="border border-red-800 bg-red-950/30 rounded-xl p-8 text-center space-y-3"
      >
        <div className="text-4xl" aria-hidden="true">
          🔒
        </div>
        <h2 className="text-lg font-semibold text-red-400">Access Denied</h2>
        <p className="text-sm text-gray-400">
          This page is restricted to the contract admin. Your wallet address
          does not have admin privileges.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
