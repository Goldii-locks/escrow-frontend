import { BACKEND_URL } from "@/app/lib/transactions";

/**
 * Query the contract to get the admin address.
 *
 * Uses the backend's query endpoint to call the `get_admin` contract method.
 * Returns the admin address or null if the query fails.
 */
export async function fetchAdminAddress(
  contractId: string,
  options?: { signal?: AbortSignal }
): Promise<string | null> {
  try {
    const res = await fetch(
      `${BACKEND_URL}/api/jobs/query`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId,
          method: "get_admin",
          args: [],
        }),
        signal: options?.signal,
      }
    );

    if (!res.ok) {
      console.error(`Admin query failed with status ${res.status}`);
      return null;
    }

    const data = await res.json();

    // Backend might return the address directly or wrapped in a success object
    if (typeof data === "string" && data.startsWith("G")) {
      return data;
    }

    if (data.success && typeof data.data === "string" && data.data.startsWith("G")) {
      return data.data;
    }

    // Try result field as well
    if (typeof data.result === "string" && data.result.startsWith("G")) {
      return data.result;
    }

    console.error("Admin address not found in response", data);
    return null;
  } catch (err) {
    console.error("Failed to fetch admin address", err);
    return null;
  }
}

/**
 * Check if the given address is the contract admin.
 */
export async function isAdmin(
  walletAddress: string | null,
  contractId: string,
  options?: { signal?: AbortSignal }
): Promise<boolean> {
  if (!walletAddress) return false;

  const adminAddress = await fetchAdminAddress(contractId, options);
  return adminAddress !== null && adminAddress === walletAddress;
}
