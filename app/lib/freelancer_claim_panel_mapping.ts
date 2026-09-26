/**
 * freelancer_claim_panel — data mapping bindings (#493).
 *
 * Maps backend claim payloads (loosely typed JSON) to the view model used by
 * the freelancer payout trigger view. Pure and React-free.
 */

export type ClaimStatus = "pending" | "claimable" | "claimed" | "failed";

export interface ClaimEntry {
  id: string;
  jobTitle: string;
  amount: string;
  token: string;
  status: ClaimStatus;
  claimedAt: string | null;
}

const STATUSES: readonly ClaimStatus[] = ["pending", "claimable", "claimed", "failed"];

/** Backend mock dataset used to bind interactive elements in tests/dev. */
export const MOCK_CLAIM_PAYLOAD: unknown[] = [
  { id: "c-1", job_title: "Logo design", amount: "150.00", token: "USDC", status: "claimable" },
  { id: "c-2", job_title: "API integration", amount: "900", token: "XLM", status: "claimed", claimed_at: "2026-01-05T10:00:00Z" },
  { id: "c-3", job_title: "Audit", amount: "40.5", token: "USDC", status: "pending" },
];

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

/** Map one raw backend record; returns null when it lacks an id or is not an object. */
export function mapClaimEntry(raw: unknown): ClaimEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  if (!id) return null;
  const status = str(r.status).toLowerCase() as ClaimStatus;
  const claimedAt = str(r.claimed_at ?? r.claimedAt);
  return {
    id,
    jobTitle: str(r.job_title ?? r.jobTitle) || "Untitled job",
    amount: str(r.amount) || "0",
    token: str(r.token) || "XLM",
    status: STATUSES.includes(status) ? status : "pending",
    claimedAt: claimedAt || null,
  };
}

/** Map a backend payload (array or `{ claims: [...] }`) to view entries, skipping invalid rows. */
export function mapClaimPayload(payload: unknown): ClaimEntry[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { claims?: unknown }).claims)
      ? (payload as { claims: unknown[] }).claims
      : [];
  return list.map(mapClaimEntry).filter((e): e is ClaimEntry => e !== null);
}

/** Fetch claims from the backend and map them; throws on a non-OK response. */
export async function fetchClaimEntries(url = "/api/claims"): Promise<ClaimEntry[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load claims (${res.status})`);
  return mapClaimPayload(await res.json());
}
