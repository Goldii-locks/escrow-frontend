/**
 * arbitration_escrow_details — Pure helpers backing the locked dispute details
 * view (`app/components/ArbitrationEscrowDetails.tsx`).
 *
 * Owns the role check that decides which wallets may read a locked escrow
 * record and the fallback warning copy shown to everyone else (Issue #480).
 *
 * Mirrors the conventions established by `app/lib/arbitrator_evidence_list.ts`.
 */

/** Roles that hold a standing interest in a locked escrow record. */
export type EscrowPartyRole = "client" | "freelancer" | "arbiter";

/** Lifecycle of an escrow record once a dispute is locked for arbitration. */
export type ArbitrationEscrowStatus =
  | "locked"
  | "under_review"
  | "resolved";

/** The locked escrow record rendered by the details view. */
export interface ArbitrationEscrowDetailsRecord {
  escrowId: string;
  disputeId: string;
  status: ArbitrationEscrowStatus;
  /** ISO timestamp the escrow was locked for arbitration. */
  lockedAt: string;
  /** Locked amount, already formatted for display. */
  lockedAmount: string;
  token: string;
  clientAddress: string;
  freelancerAddress: string;
  /** Arbiter assigned to the dispute, if one has been assigned yet. */
  arbiterAddress: string | null;
  reason: string;
}

/** Copy shown on the fallback warning screen for unauthorized accounts. */
export const UNAUTHORIZED_ARBITRATION_WARNING =
  "Access Restricted: Only the client, freelancer, and assigned arbiter on this locked escrow can view its dispute details.";

/** Human-readable label for each party role. */
export const ESCROW_ROLE_LABELS: Record<EscrowPartyRole, string> = {
  client: "Client",
  freelancer: "Freelancer",
  arbiter: "Arbiter",
};

/**
 * Normalises a Stellar address for comparison.
 *
 * Addresses arrive from three sources — the connected wallet, the contract
 * query, and user-entered configuration — and they differ only in
 * surrounding whitespace and letter case. Returns `null` for anything that is
 * not a non-empty string, so a missing arbiter never compares equal to a
 * disconnected wallet.
 */
export function normalizeEscrowPartyAddress(
  address: string | null | undefined,
): string | null {
  if (typeof address !== "string") return null;
  const normalized = address.trim().toLowerCase();
  return normalized ? normalized : null;
}

/** The party roles a wallet can hold on an escrow record, in check order. */
const ESCROW_PARTY_ROLES: readonly EscrowPartyRole[] = [
  "client",
  "freelancer",
  "arbiter",
];

/**
 * Resolves which role a wallet holds on a locked escrow record.
 *
 * Returns `null` when the wallet is one of the parties on no account of the
 * record, including when the record has no arbiter assigned yet — an
 * unassigned slot must not be treated as a wildcard that authorizes everyone.
 */
export function resolveEscrowPartyRole(
  viewerAddress: string | null | undefined,
  record: Pick<
    ArbitrationEscrowDetailsRecord,
    "clientAddress" | "freelancerAddress" | "arbiterAddress"
  >,
): EscrowPartyRole | null {
  const viewer = normalizeEscrowPartyAddress(viewerAddress);
  if (!viewer) return null;

  for (const role of ESCROW_PARTY_ROLES) {
    const party = normalizeEscrowPartyAddress(record[`${role}Address`]);
    if (party && party === viewer) return role;
  }

  return null;
}

/**
 * Checks whether a wallet may read a locked escrow record.
 *
 * True only for the client, the freelancer, and the assigned arbiter named on
 * the record. `additionalViewers` extends the allowlist for operational roles
 * that need read access without being a party — an escrow support desk, say —
 * without loosening the default to "any connected wallet".
 */
export function isEscrowDetailsAuthorized(
  viewerAddress: string | null | undefined,
  record: Pick<
    ArbitrationEscrowDetailsRecord,
    "clientAddress" | "freelancerAddress" | "arbiterAddress"
  >,
  options?: { additionalViewers?: string[] },
): boolean {
  if (resolveEscrowPartyRole(viewerAddress, record)) return true;

  const viewer = normalizeEscrowPartyAddress(viewerAddress);
  if (!viewer) return false;

  const additional = options?.additionalViewers;
  if (!Array.isArray(additional) || additional.length === 0) return false;

  return additional.some((entry) => {
    const allowed = normalizeEscrowPartyAddress(entry);
    return allowed !== null && allowed === viewer;
  });
}

/**
 * Describes why a wallet was blocked, for the fallback warning screen.
 *
 * Distinguishes a disconnected wallet from a connected-but-uninvolved one so
 * the warning can tell the reader whether to connect a different wallet or
 * give up on this dispute entirely.
 */
export function getEscrowAccessDenialReason(
  viewerAddress: string | null | undefined,
): "disconnected" | "not-a-party" {
  return normalizeEscrowPartyAddress(viewerAddress) ? "not-a-party" : "disconnected";
}

/** One row in the locked escrow readout grid. */
export interface ArbitrationEscrowReadout {
  label: string;
  value: string;
}

/**
 * Maps a locked escrow record onto the readouts the details view renders.
 *
 * Every value falls back to an em dash rather than an empty string, so a row
 * never collapses and the grid keeps a stable height once populated. Long
 * addresses and reasons are left intact: the view wraps them rather than
 * truncating, so no identifier is lost.
 */
export function getArbitrationEscrowReadouts(
  record: ArbitrationEscrowDetailsRecord,
): ArbitrationEscrowReadout[] {
  const orDash = (value: string | null | undefined): string => {
    if (typeof value !== "string") return "—";
    const trimmed = value.trim();
    return trimmed ? trimmed : "—";
  };

  return [
    { label: "Escrow", value: orDash(record.escrowId) },
    { label: "Dispute", value: orDash(record.disputeId) },
    { label: "Status", value: orDash(record.status) },
    { label: "Locked At", value: orDash(record.lockedAt) },
    { label: "Amount", value: orDash(record.lockedAmount) },
    { label: "Token", value: orDash(record.token) },
    { label: "Client", value: orDash(record.clientAddress) },
    { label: "Freelancer", value: orDash(record.freelancerAddress) },
    { label: "Arbiter", value: orDash(record.arbiterAddress) },
    { label: "Reason", value: orDash(record.reason) },
  ];
}

/**
 * Mock locked escrow record used as the fallback for backend queries.
 */
export const MOCK_ARBITRATION_ESCROW_DETAILS: ArbitrationEscrowDetailsRecord = {
  escrowId: "ESC-000000000000000000000000000000000000000000000042",
  disputeId: "DIS-000000000000000000000000000000000000000000000117",
  status: "under_review",
  lockedAt: "2026-09-23T09:12:00Z",
  lockedAmount: "500.00 USDC",
  token: "USDC",
  clientAddress: "GCLIENT7HQ2WKM4XPL6TFV3ZB9DCNR8YASEK5",
  freelancerAddress: "GFREELANCER3NZ8WQ6LK2VH5CJB0DTXR4MASEK9",
  arbiterAddress: "GARBITER5PD3XCW8QL0NR6ZTKM2VBHJF4SASEK2",
  reason: "Freelancer marked the milestone delivered; client disputes acceptance.",
};

/**
 * Queries the locked escrow record for a dispute.
 *
 * Pulls from the backend when reachable and the payload carries the party
 * addresses the role check needs; otherwise falls back to
 * `MOCK_ARBITRATION_ESCROW_DETAILS`.
 */
export async function fetchArbitrationEscrowDetails(
  disputeId: string,
  options?: { apiUrl?: string; signal?: AbortSignal },
): Promise<ArbitrationEscrowDetailsRecord> {
  const url =
    options?.apiUrl ??
    `/api/disputes/${encodeURIComponent(disputeId)}/escrow`;

  try {
    const res = await fetch(url, { signal: options?.signal });
    if (res.ok) {
      const data: unknown = await res.json();
      const payload =
        typeof data === "object" &&
        data !== null &&
        "success" in data &&
        "data" in data
          ? (data as { data: unknown }).data
          : data;

      if (isArbitrationEscrowDetailsRecord(payload)) {
        return payload;
      }
    }
  } catch {
    // Network or server error - fall through to the mock record.
  }

  return { ...MOCK_ARBITRATION_ESCROW_DETAILS };
}

/**
 * Narrows an unknown value to an `ArbitrationEscrowDetailsRecord`.
 *
 * The role check reads three address fields off the record, so all three are
 * required before a payload is trusted: a record missing `arbiterAddress` is
 * indistinguishable from one where every wallet is unauthorized.
 */
export function isArbitrationEscrowDetailsRecord(
  value: unknown,
): value is ArbitrationEscrowDetailsRecord {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.escrowId === "string" &&
    typeof candidate.disputeId === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.lockedAt === "string" &&
    typeof candidate.lockedAmount === "string" &&
    typeof candidate.token === "string" &&
    typeof candidate.clientAddress === "string" &&
    typeof candidate.freelancerAddress === "string" &&
    "arbiterAddress" in candidate &&
    typeof candidate.reason === "string"
  );
}
