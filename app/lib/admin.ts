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

// =============================================================================
// Delegated admin roles (#838)
// =============================================================================

/**
 * Roles the contract can delegate to another address with `set_admin_role`,
 * so the stored admin does not have to sign every privileged call. Order is
 * the display order in the header.
 */
export const ADMIN_ROLES = ["Operator", "FeeManager", "Resolver", "Upgrader"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Read-only view returning the holder of one role (`Option<Address>`). */
export const ADMIN_ROLE_QUERY_METHOD = "get_admin_role";

/** What each role is for, shown as the badge tooltip. */
export const ADMIN_ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  Operator: "Can pause and resume the escrow",
  FeeManager: "Can manage the token whitelist and fees",
  Resolver: "Can resolve disputes",
  Upgrader: "Can upgrade the contract",
};

/** A Stellar account (G…) or contract (C…) address. */
const ADDRESS_PATTERN = /^[GC][A-Z2-7]{55}$/;

/**
 * Runs a read-only contract call through `POST /api/jobs/query` and returns
 * `data.result` from the `{ success, data }` envelope.
 *
 * Throws on a network error, a non-2xx status or an unexpected body, so
 * callers can tell "the call failed" apart from a legitimate `null` result
 * (an unset `Option`).
 */
export async function queryContract(
  contractId: string,
  method: string,
  args: { type: string; value: unknown }[] = [],
  options?: { signal?: AbortSignal }
): Promise<unknown> {
  const res = await fetch(`${BACKEND_URL}/api/jobs/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args.length > 0 ? { contractId, method, args } : { contractId, method }),
    signal: options?.signal,
  });
  if (!res.ok) throw new Error(`${method} query failed with status ${res.status}`);

  const body: unknown = await res.json();
  if (
    typeof body !== "object" ||
    body === null ||
    (body as { success?: unknown }).success !== true ||
    typeof (body as { data?: unknown }).data !== "object" ||
    (body as { data?: unknown }).data === null
  ) {
    throw new Error(`${method} query returned an unexpected body`);
  }
  const data = (body as { data: Record<string, unknown> }).data;
  return "result" in data ? data.result : null;
}

/**
 * Holder of `role` on `contractId`, or null when the role is unassigned or
 * the query fails. A role a backend can't read is treated as unassigned, so a
 * failure never grants access.
 */
export async function fetchAdminRoleHolder(
  contractId: string,
  role: AdminRole,
  options?: { signal?: AbortSignal }
): Promise<string | null> {
  try {
    const result = await queryContract(
      contractId,
      ADMIN_ROLE_QUERY_METHOD,
      // Unit enum variant: encoded as a one-symbol vec by build-tx/query.
      [{ type: "enum", value: role }],
      options
    );
    return typeof result === "string" && ADDRESS_PATTERN.test(result) ? result : null;
  } catch (err) {
    if (options?.signal?.aborted) throw err;
    return null;
  }
}

/** The stored admin and every delegated role holder of one contract. */
export interface ContractAccess {
  admin: string | null;
  roles: Record<AdminRole, string | null>;
}

/** Reads the admin and all {@link ADMIN_ROLES} holders in parallel. */
export async function fetchContractAccess(
  contractId: string,
  options?: { signal?: AbortSignal }
): Promise<ContractAccess> {
  const [admin, ...holders] = await Promise.all([
    fetchAdminAddress(contractId, options),
    ...ADMIN_ROLES.map((role) => fetchAdminRoleHolder(contractId, role, options)),
  ]);
  const roles = Object.fromEntries(ADMIN_ROLES.map((role, i) => [role, holders[i]])) as Record<
    AdminRole,
    string | null
  >;
  return { admin, roles };
}

/** Roles `wallet` holds in `access`, in {@link ADMIN_ROLES} order. */
export function walletRoles(access: ContractAccess, wallet: string | null): AdminRole[] {
  if (!wallet) return [];
  return ADMIN_ROLES.filter((role) => access.roles[role] === wallet);
}

/** What the connected wallet may do on one contract. */
export interface AdminPermissions {
  isAdmin: boolean;
  roles: AdminRole[];
  /** `admin_pause_escrow` / `admin_resume_escrow`: Operator or admin. */
  canPause: boolean;
  /** Token whitelist add/remove: FeeManager or admin. */
  canManageWhitelist: boolean;
  /** Dispute resolution overrides: Resolver or admin. */
  canResolve: boolean;
  /** Contract upgrades: Upgrader or admin. */
  canUpgrade: boolean;
  /** Admin or any delegated role, i.e. something on /admin applies. */
  hasAnyAccess: boolean;
}

/**
 * Maps admin status and delegated roles onto the admin page's controls. The
 * stored admin can do everything; each role unlocks only its own section.
 */
export function adminPermissions({
  isAdmin,
  roles = [],
}: {
  isAdmin: boolean;
  roles?: readonly AdminRole[];
}): AdminPermissions {
  const has = (role: AdminRole) => isAdmin || roles.includes(role);
  return {
    isAdmin,
    roles: [...roles],
    canPause: has("Operator"),
    canManageWhitelist: has("FeeManager"),
    canResolve: has("Resolver"),
    canUpgrade: has("Upgrader"),
    hasAnyAccess: isAdmin || roles.length > 0,
  };
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
