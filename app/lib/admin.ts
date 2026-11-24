import { BACKEND_URL } from "@/app/lib/transactions";
import { AdminResponseSchema, validateResponse } from "@/app/lib/api_schemas";

/**
 * The contract's read-only view that includes the admin address. The
 * contract has no standalone `get_admin`; `get_escrow_state` bundles the
 * admin with the rest of the escrow state (escrow-contract #719) and the
 * backend's `/api/jobs/query` allowlists it (#599).
 */
export const ADMIN_QUERY_METHOD = "get_escrow_state";

/**
 * Query the contract to get the admin address.
 *
 * Calls the backend's read-only query route with `get_escrow_state` and reads
 * `admin` from the standard `{ success, data }` envelope. Any other shape is
 * rejected by the Zod schema rather than guessed at.
 * Returns the admin address or null if the query fails.
 */
export async function fetchAdminAddress(
  contractId: string,
  options?: { signal?: AbortSignal }
): Promise<string | null> {
  const endpoint = "/api/jobs/query";
  try {
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId, method: ADMIN_QUERY_METHOD }),
      signal: options?.signal,
    });

    if (!res.ok) {
      console.error(`Admin query failed with status ${res.status}`);
      return null;
    }

    const rawData: unknown = await res.json();
    const body = validateResponse(AdminResponseSchema, rawData, endpoint);
    return body.data.result.admin;
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

/**
 * Whether the escrow is funded, read from the backend's job route
 * (`GET /api/jobs/:contractId`, whose `data` is the decoded `get_job` result).
 * Returns null when it can't be determined, so callers can show "unknown"
 * instead of guessing (#659).
 */
export async function fetchEscrowFunded(
  contractId: string,
  options?: { signal?: AbortSignal }
): Promise<boolean | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/jobs/${encodeURIComponent(contractId)}`, {
      signal: options?.signal,
    });
    if (!res.ok) return null;

    const body = await res.json();
    const funded = body?.success ? body.data?.funded : undefined;
    return typeof funded === "boolean" ? funded : null;
  } catch {
    return null;
  }
}
