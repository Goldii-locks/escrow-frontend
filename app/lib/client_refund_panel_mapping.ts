/**
 * client_refund_panel — data mapping bindings (#503).
 *
 * Maps backend refund payloads (loosely typed JSON) to the view model used by
 * the client refund claim panel. Pure and React-free.
 */

export type RefundStatus = "pending" | "approved" | "rejected" | "refunded";

export interface ClientRefundEntry {
  id: string;
  escrowId: string;
  jobTitle: string;
  amount: string;
  token: string;
  status: RefundStatus;
  reason: string;
  clientAddress: string;
  createdAt: string;
}

const STATUSES: readonly RefundStatus[] = [
  "pending",
  "approved",
  "rejected",
  "refunded",
];

export const CLIENT_REFUND_ENDPOINT = "/api/client/refunds";

/** Backend mock dataset used to bind interactive elements in tests/dev. */
export const MOCK_REFUND_PAYLOAD: unknown[] = [
  {
    id: "ref-1",
    escrow_id: "esc-101",
    job_title: "Fullstack web application",
    amount: "750.00",
    token: "USDC",
    status: "pending",
    reason: "Milestone timeline exceeded by 30 days without communication.",
    client_address: "GCLIENT1111111111111111111111111111111111111111111",
    created_at: "2026-09-20T10:00:00Z",
  },
  {
    id: "ref-2",
    escrow_id: "esc-102",
    job_title: "Smart contract audit",
    amount: "1500.00",
    token: "XLM",
    status: "approved",
    reason: "Mutual cancellation agreement between client and freelancer.",
    client_address: "GCLIENT2222222222222222222222222222222222222222222",
    created_at: "2026-09-22T14:30:00Z",
  },
  {
    id: "ref-3",
    escrow_id: "esc-103",
    job_title: "UI Design System",
    amount: "300.00",
    token: "USDC",
    status: "refunded",
    reason: "Freelancer unable to complete deliverables.",
    client_address: "GCLIENT3333333333333333333333333333333333333333333",
    created_at: "2026-09-25T16:00:00Z",
  },
];

function str(v: unknown): string {
  return typeof v === "string"
    ? v.trim()
    : typeof v === "number"
      ? String(v)
      : "";
}

/** Map one raw backend record; returns null when it lacks an id or is not an object. */
export function mapRefundEntry(raw: unknown): ClientRefundEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id);
  if (!id) return null;

  const status = str(r.status).toLowerCase() as RefundStatus;
  const createdAt = str(r.created_at ?? r.createdAt);

  return {
    id,
    escrowId: str(r.escrow_id ?? r.escrowId) || "unknown-escrow",
    jobTitle: str(r.job_title ?? r.jobTitle) || "Untitled Escrow",
    amount: str(r.amount) || "0.00",
    token: str(r.token) || "USDC",
    status: STATUSES.includes(status) ? status : "pending",
    reason: str(r.reason) || "No reason specified",
    clientAddress: str(r.client_address ?? r.clientAddress) || "",
    createdAt: createdAt || new Date().toISOString(),
  };
}

/** Map a backend payload (array or `{ refunds: [...] }` or `{ data: [...] }`) to view entries. */
export function mapRefundPayload(payload: unknown): ClientRefundEntry[] {
  const list = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray((payload as { refunds?: unknown }).refunds)
      ? (payload as { refunds: unknown[] }).refunds
      : payload &&
          typeof payload === "object" &&
          Array.isArray((payload as { data?: unknown }).data)
        ? (payload as { data: unknown[] }).data
        : [];

  return list
    .map(mapRefundEntry)
    .filter((e): e is ClientRefundEntry => e !== null);
}

/** Fetch refund entries from the backend API. Throws on non-ok response. */
export async function fetchRefundEntries(
  url = CLIENT_REFUND_ENDPOINT,
): Promise<ClientRefundEntry[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load refunds (${res.status})`);
  return mapRefundPayload(await res.json());
}
