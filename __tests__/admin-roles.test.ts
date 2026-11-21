/**
 * Delegated admin roles (#838): `get_admin_role` reads and the permission
 * mapping that gates the /admin sections.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_ROLE_QUERY_METHOD,
  ADMIN_ROLES,
  adminPermissions,
  fetchAdminRoleHolder,
  fetchContractAccess,
  walletRoles,
} from "@/app/lib/admin";

const CONTRACT = "C" + "E".repeat(55);
const ADMIN = "G" + "A".repeat(55);
const OPERATOR = "G" + "O".repeat(55);
const FEE_MANAGER = "G" + "F".repeat(55);

type Holders = Partial<Record<(typeof ADMIN_ROLES)[number], string | null>>;

/** A backend answering get_escrow_state with ADMIN and get_admin_role from `holders`. */
function stubBackend(holders: Holders, { failRoles = false } = {}) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (body.method === "get_escrow_state") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { result: { admin: ADMIN } } }),
      };
    }
    if (body.method === ADMIN_ROLE_QUERY_METHOD) {
      if (failRoles) return { ok: false, status: 500, json: async () => ({ success: false }) };
      const role = body.args?.[0]?.value as keyof Holders;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { result: holders[role] ?? null } }),
      };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchAdminRoleHolder", () => {
  it("queries get_admin_role with the role as a unit enum variant", async () => {
    const fetchMock = stubBackend({ Operator: OPERATOR });

    expect(await fetchAdminRoleHolder(CONTRACT, "Operator")).toBe(OPERATOR);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/jobs\/query$/);
    expect(JSON.parse(String(init?.body))).toEqual({
      contractId: CONTRACT,
      method: "get_admin_role",
      args: [{ type: "enum", value: "Operator" }],
    });
  });

  it("returns null for an unassigned role, a failed query, or a non-address", async () => {
    stubBackend({ Operator: null });
    expect(await fetchAdminRoleHolder(CONTRACT, "Operator")).toBeNull();

    stubBackend({}, { failRoles: true });
    expect(await fetchAdminRoleHolder(CONTRACT, "Operator")).toBeNull();

    stubBackend({ Operator: "not-an-address" });
    expect(await fetchAdminRoleHolder(CONTRACT, "Operator")).toBeNull();
  });
});

describe("fetchContractAccess / walletRoles", () => {
  it("reads the admin and every delegated role holder", async () => {
    stubBackend({ Operator: OPERATOR, FeeManager: FEE_MANAGER });

    const access = await fetchContractAccess(CONTRACT);

    expect(access).toEqual({
      admin: ADMIN,
      roles: { Operator: OPERATOR, FeeManager: FEE_MANAGER, Resolver: null, Upgrader: null },
    });
    expect(walletRoles(access, OPERATOR)).toEqual(["Operator"]);
    expect(walletRoles(access, FEE_MANAGER)).toEqual(["FeeManager"]);
    expect(walletRoles(access, ADMIN)).toEqual([]);
    expect(walletRoles(access, null)).toEqual([]);
  });

  it("lists every role a wallet holds, in display order", async () => {
    stubBackend({ Upgrader: OPERATOR, Operator: OPERATOR });
    expect(walletRoles(await fetchContractAccess(CONTRACT), OPERATOR)).toEqual([
      "Operator",
      "Upgrader",
    ]);
  });
});

describe("adminPermissions", () => {
  it("lets an Operator pause but not manage the whitelist", () => {
    const p = adminPermissions({ isAdmin: false, roles: ["Operator"] });
    expect(p.canPause).toBe(true);
    expect(p.canManageWhitelist).toBe(false);
    expect(p.hasAnyAccess).toBe(true);
  });

  it("lets a FeeManager manage the whitelist but not pause", () => {
    const p = adminPermissions({ isAdmin: false, roles: ["FeeManager"] });
    expect(p.canManageWhitelist).toBe(true);
    expect(p.canPause).toBe(false);
  });

  it("maps Resolver and Upgrader to their own sections only", () => {
    expect(adminPermissions({ isAdmin: false, roles: ["Resolver"] })).toMatchObject({
      canResolve: true,
      canUpgrade: false,
      canPause: false,
      canManageWhitelist: false,
    });
    expect(adminPermissions({ isAdmin: false, roles: ["Upgrader"] })).toMatchObject({
      canUpgrade: true,
      canResolve: false,
    });
  });

  it("gives the stored admin everything and a stranger nothing", () => {
    expect(adminPermissions({ isAdmin: true })).toMatchObject({
      canPause: true,
      canManageWhitelist: true,
      canResolve: true,
      canUpgrade: true,
      hasAnyAccess: true,
    });
    expect(adminPermissions({ isAdmin: false })).toMatchObject({
      canPause: false,
      canManageWhitelist: false,
      hasAnyAccess: false,
    });
  });
});
