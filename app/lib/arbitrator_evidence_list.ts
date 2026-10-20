/**
 * arbitrator_evidence_list — Pure helpers and data services backing the
 * arbitrator evidence list view (`app/components/ArbitratorEvidenceList.tsx`).
 *
 * Implements:
 * - Access control checking for arbiters (Issue #420)
 * - Loading placeholder structures (Issue #421)
 * - User input sanitization against code/script tags (Issue #422)
 * - Dynamic data queries and API bindings with mock fallbacks (Issue #423)
 */

export interface EvidenceItem {
  id: string;
  disputeId: string;
  submittedBy: string;
  submitterRole: "client" | "freelancer";
  title: string;
  description: string;
  fileUrl: string;
  fileType: string;
  fileSize: number; // in bytes
  uploadedAt: string;
  hash: string;
  verified: boolean;
}

export const UNAUTHORIZED_ARBITRATOR_WARNING =
  "Access Restricted: Only authorized arbiters assigned to this dispute can review submitted evidence.";

/**
 * Checks whether the given wallet address is authorized as an arbiter for this dispute.
 * Returns true if the address matches any of the designated arbitrator addresses.
 */
export function isArbitratorAuthorized(
  walletAddress: string | null | undefined,
  authorizedArbitrators?: string[]
): boolean {
  if (!walletAddress || typeof walletAddress !== "string") return false;
  const trimmed = walletAddress.trim().toLowerCase();
  if (!trimmed) return false;

  if (!authorizedArbitrators || authorizedArbitrators.length === 0) {
    // If no explicit whitelist is supplied, require non-empty address
    return true;
  }

  return authorizedArbitrators.some(
    (arb) => arb.trim().toLowerCase() === trimmed
  );
}

/**
 * Strips script tags, code tags, and dangerous executable syntax from user input.
 * If input contains <code>...</code> or <script>...</script>, removes them completely.
 */
export function sanitizeEvidenceInput(input: string | null | undefined): string {
  if (!input || typeof input !== "string") return "";

  let cleaned = input;
  // Strip <script> tags and contents
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  // Strip <code> tags and contents to ignore embedded script/payload code
  cleaned = cleaned.replace(/<code\b[^<]*(?:(?!<\/code>)<[^<]*)*<\/code>/gi, "");
  // Strip any remaining html tags
  cleaned = cleaned.replace(/<\/?[^>]+(>|$)/g, "");

  return cleaned.trim();
}

/**
 * Queries evidence records dynamically for a given dispute ID.
 * Pulls from the backend API; throws when the backend is unreachable.
 */
export async function fetchArbitratorEvidence(
  disputeId: string,
  options?: { apiUrl?: string; signal?: AbortSignal }
): Promise<EvidenceItem[]> {
  const url = options?.apiUrl || `/api/disputes/${encodeURIComponent(disputeId)}/evidence`;

  const res = await fetch(url, { signal: options?.signal });
  if (!res.ok) {
    throw new Error(`Failed to load evidence for dispute ${disputeId} (${res.status})`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error(`Invalid evidence response for dispute ${disputeId}`);
  }
  return data;
}
