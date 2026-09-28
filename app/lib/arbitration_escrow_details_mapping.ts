/**
 * arbitration_escrow_details — data mapping bindings (#483).
 *
 * Configures data queries and payload mappings to dynamically pull state data
 * from backend APIs. Pure and React-free.
 */

import type {
  ArbitrationEscrowDetailsRecord,
  ArbitrationEscrowStatus,
} from "./arbitration_escrow_details";

export const ARBITRATION_ESCROW_ENDPOINT = "/api/arbitration/escrow-details";

export const MOCK_ARBITRATION_DATASET: unknown[] = [
  {
    escrow_id: "ESC-000000000000000000000000000000000000000000000042",
    dispute_id: "DIS-000000000000000000000000000000000000000000000117",
    status: "under_review",
    locked_at: "2026-09-23T09:12:00Z",
    locked_amount: "500.00 USDC",
    token: "USDC",
    client_address: "GCLIENT7HQ2WKM4XPL6TFV3ZB9DCNR8YASEK5",
    freelancer_address: "GFREELANCER3NZ8WQ6LK2VH5CJB0DTXR4MASEK9",
    arbiter_address: "GARBITER5PD3XCW8QL0NR6ZTKM2VBHJF4SASEK2",
    reason:
      "Freelancer marked the milestone delivered; client disputes acceptance.",
  },
  {
    escrow_id: "ESC-000000000000000000000000000000000000000000000088",
    dispute_id: "DIS-000000000000000000000000000000000000000000000222",
    status: "locked",
    locked_at: "2026-09-24T14:30:00Z",
    locked_amount: "1200.00 XLM",
    token: "XLM",
    client_address: "GCLIENT8888888888888888888888888888888888888888888",
    freelancer_address: "GFREELANCER9999999999999999999999999999999999999",
    arbiter_address: null,
    reason: "Scope specification mismatch on deliverables.",
  },
];

function str(v: unknown): string {
  return typeof v === "string"
    ? v.trim()
    : typeof v === "number"
      ? String(v)
      : "";
}

/** Map a raw backend response record (snake_case or camelCase) to ArbitrationEscrowDetailsRecord */
export function mapArbitrationRecord(
  raw: unknown,
): ArbitrationEscrowDetailsRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const escrowId = str(r.escrow_id ?? r.escrowId);
  const disputeId = str(r.dispute_id ?? r.disputeId);
  if (!escrowId || !disputeId) return null;

  const validStatuses: ArbitrationEscrowStatus[] = [
    "locked",
    "under_review",
    "resolved",
  ];
  const rawStatus = str(r.status)
    .toLowerCase()
    .replace(/[\s-]/g, "_") as ArbitrationEscrowStatus;
  const status: ArbitrationEscrowStatus = validStatuses.includes(rawStatus)
    ? rawStatus
    : "locked";

  const rawArbiter =
    r.arbiter_address !== undefined ? r.arbiter_address : r.arbiterAddress;
  const arbiterAddress =
    typeof rawArbiter === "string" && rawArbiter.trim()
      ? rawArbiter.trim()
      : null;

  return {
    escrowId,
    disputeId,
    status,
    lockedAt: str(r.locked_at ?? r.lockedAt) || new Date().toISOString(),
    lockedAmount: str(r.locked_amount ?? r.lockedAmount) || "0.00",
    token: str(r.token) || "USDC",
    clientAddress: str(r.client_address ?? r.clientAddress),
    freelancerAddress: str(r.freelancer_address ?? r.freelancerAddress),
    arbiterAddress,
    reason: str(r.reason) || "Dispute under arbitration.",
  };
}

/** Map a backend payload (array or wrapped object) to an array of valid records. */
export function mapArbitrationPayload(
  payload: unknown,
): ArbitrationEscrowDetailsRecord[] {
  const list = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : payload &&
          typeof payload === "object" &&
          Array.isArray((payload as { escrows?: unknown }).escrows)
        ? (payload as { escrows: unknown[] }).escrows
        : [];

  return list
    .map(mapArbitrationRecord)
    .filter((e): e is ArbitrationEscrowDetailsRecord => e !== null);
}

/** Fetch arbitration records from backend API. Throws on HTTP error. */
export async function fetchArbitrationDataset(
  url = ARBITRATION_ESCROW_ENDPOINT,
): Promise<ArbitrationEscrowDetailsRecord[]> {
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Failed to load arbitration details (${res.status})`);
  return mapArbitrationPayload(await res.json());
}
