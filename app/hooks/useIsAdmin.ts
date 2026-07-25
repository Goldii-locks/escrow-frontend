"use client";

import { useEffect, useState } from "react";
import { isAdmin } from "@/app/lib/admin";
import { CONTRACT_ID } from "@/app/lib/transactions";

/**
 * Hook to check if the current wallet address is the contract admin.
 * Returns loading state and admin status.
 */
export function useIsAdmin(address: string | null) {
  const [loading, setLoading] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      if (!address) {
        setIsAdminUser(false);
        setLoading(false);
        return;
      }

      setLoading(true);
      const adminStatus = await isAdmin(address, CONTRACT_ID, {
        signal: controller.signal,
      });

      if (!controller.signal.aborted) {
        setIsAdminUser(adminStatus);
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [address]);

  return { loading, isAdminUser };
}
