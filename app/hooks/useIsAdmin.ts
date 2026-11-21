"use client";

import { useEffect, useState } from "react";
import {
  adminPermissions,
  fetchContractAccess,
  walletRoles,
  type AdminPermissions,
  type AdminRole,
} from "@/app/lib/admin";
import { FACTORY_CONTRACT_ID } from "@/app/lib/transactions";

export interface UseIsAdminResult extends AdminPermissions {
  loading: boolean;
  /** The wallet is the contract's stored admin. */
  isAdminUser: boolean;
  /** Delegated roles the wallet holds on the contract. */
  roles: AdminRole[];
}

const NO_ACCESS = adminPermissions({ isAdmin: false });

/**
 * Resolves what `address` may do on `contractId`: whether it is the stored
 * admin, and which delegated roles (`get_admin_role`) it holds (#838).
 *
 * `contractId` defaults to the escrow factory, which is the one contract the
 * deployment is configured with (#836). Pass the selected escrow on /admin to
 * check that escrow's admin and role holders instead (#837). With no address
 * or no contract the result is "no access", never a guess.
 */
export function useIsAdmin(
  address: string | null,
  contractId: string = FACTORY_CONTRACT_ID
): UseIsAdminResult {
  const [state, setState] = useState<{
    key: string;
    loading: boolean;
    permissions: AdminPermissions;
  }>({ key: "", loading: true, permissions: NO_ACCESS });

  const key = address && contractId ? `${contractId}:${address}` : "";

  useEffect(() => {
    if (!key || !address) return;
    const controller = new AbortController();

    (async () => {
      try {
        const access = await fetchContractAccess(contractId, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setState({
          key,
          loading: false,
          permissions: adminPermissions({
            isAdmin: access.admin !== null && access.admin === address,
            roles: walletRoles(access, address),
          }),
        });
      } catch {
        if (!controller.signal.aborted) {
          setState({ key, loading: false, permissions: NO_ACCESS });
        }
      }
    })();

    return () => controller.abort();
  }, [key, address, contractId]);

  // No wallet or no contract: settled "no access". A result for another
  // wallet/contract pair is stale, so it reads as loading until replaced.
  if (!key) return { ...NO_ACCESS, loading: false, isAdminUser: false };
  const current = state.key === key;
  const permissions = current ? state.permissions : NO_ACCESS;
  return {
    ...permissions,
    loading: current ? state.loading : true,
    isAdminUser: permissions.isAdmin,
    roles: permissions.roles,
  };
}
