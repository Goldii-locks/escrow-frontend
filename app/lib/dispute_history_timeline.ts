/**
 * dispute_history_timeline — Pure helpers and data services backing the
 * dispute history timeline (`app/components/DisputeHistoryTimeline.tsx`).
 *
 * Implements:
 * - Role-based access control for viewing dispute history (Issue #440)
 * - Loading placeholder structure (Issue #441)
 * - User input sanitization against code/script tags (Issue #442)
 * - Backend data queries with mock dataset fallback (Issue #443)
 *
 * Mirrors the conventions established by `app/lib/arbitrator_evidence_list.ts`.
 */

export type DisputeHistoryEventType =
  | "raised"
  | "evidence_submitted"
  | "response"
  | "arbiter_assigned"
  | "note"
  | "resolved";

export interface DisputeHistoryEvent {
  id: string;
  disputeId: string;
  type: DisputeHistoryEventType;
  actor: string;
  actorRole: "client" | "freelancer" | "arbiter";
  title: string;
  description: string;
  timestamp: string;
}

export const UNAUTHORIZED_TIMELINE_WARNING =
  "Access Restricted: Only wallets that are party to this dispute can view its history.";

/** Number of placeholder rows rendered while the history loads. */
export const TIMELINE_SKELETON_ROWS = 3;

/**
 * Checks whether the wallet may view the dispute history.
 *
 * A missing or blank wallet is always rejected. When a whitelist of dispute
 * participants is supplied the wallet must appear in it (case-insensitive);
 * without a whitelist any connected wallet is accepted.
 */
export function isTimelineViewerAuthorized(
  walletAddress: string | null | undefined,
  authorizedWallets?: string[],
): boolean {
  if (!walletAddress || typeof walletAddress !== "string") return false;
  const trimmed = walletAddress.trim().toLowerCase();
  if (!trimmed) return false;

  if (!authorizedWallets || authorizedWallets.length === 0) return true;

  return authorizedWallets.some((w) => w.trim().toLowerCase() === trimmed);
}

/**
 * Strips script tags, code tags (with contents) and any remaining HTML from
 * user input passed to the timeline forms.
 */
export function sanitizeTimelineInput(input: string | null | undefined): string {
  if (!input || typeof input !== "string") return "";

  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<code\b[^<]*(?:(?!<\/code>)<[^<]*)*<\/code>/gi, "")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .trim();
}

/** Mock dataset used as a fallback when the backend query fails. */
export const MOCK_DISPUTE_HISTORY: DisputeHistoryEvent[] = [
  {
    id: "evt-001",
    disputeId: "disp-101",
    type: "raised",
    actor: "GCKF7J3...CLIENT",
    actorRole: "client",
    title: "Dispute raised",
    description: "Client disputed milestone 2 deliverables.",
    timestamp: "2026-09-20T10:15:00Z",
  },
  {
    id: "evt-002",
    disputeId: "disp-101",
    type: "response",
    actor: "GAX4K9L...FREELANCER",
    actorRole: "freelancer",
    title: "Freelancer responded",
    description: "Freelancer submitted deployment proof for the milestone.",
    timestamp: "2026-09-21T14:30:00Z",
  },
  {
    id: "evt-003",
    disputeId: "disp-101",
    type: "arbiter_assigned",
    actor: "GARB2M8...ARBITER",
    actorRole: "arbiter",
    title: "Arbiter assigned",
    description: "An arbiter accepted the dispute for review.",
    timestamp: "2026-09-22T09:00:00Z",
  },
];

/**
 * Queries history events for a dispute. Pulls from the backend API and falls
 * back to the mock dataset on a network or server error.
 */
export async function fetchDisputeHistory(
  disputeId: string,
  options?: { apiUrl?: string; signal?: AbortSignal },
): Promise<DisputeHistoryEvent[]> {
  const url =
    options?.apiUrl ||
    `/api/disputes/${encodeURIComponent(disputeId)}/history`;

  try {
    const res = await fetch(url, { signal: options?.signal });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch {
    // Network or server error - fall back to the mock dataset
  }

  const matched = MOCK_DISPUTE_HISTORY.filter((e) => e.disputeId === disputeId);
  return matched.length > 0 ? matched : MOCK_DISPUTE_HISTORY;
}
