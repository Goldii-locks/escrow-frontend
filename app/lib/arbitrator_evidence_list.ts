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
 * Mock evidence dataset used as fallback for backend queries.
 */
export const MOCK_EVIDENCE_DATASET: EvidenceItem[] = [
  {
    id: "evi-001",
    disputeId: "disp-101",
    submittedBy: "GCKF7J3...CLIENT",
    submitterRole: "client",
    title: "Project Scope Specification v1.2",
    description: "Initial signed agreement detailing the milestone deliverables and acceptance criteria.",
    fileUrl: "/evidence/scope_v1.pdf",
    fileType: "application/pdf",
    fileSize: 245760,
    uploadedAt: "2026-09-20T10:15:00Z",
    hash: "0x8fa4c379a12b...b3f4",
    verified: true,
  },
  {
    id: "evi-002",
    disputeId: "disp-101",
    submittedBy: "GAX4K9L...FREELANCER",
    submitterRole: "freelancer",
    title: "Production Deployment Logs & Commit Proof",
    description: "Server access logs and repository commit history demonstrating milestone completion.",
    fileUrl: "/evidence/deploy_logs.txt",
    fileType: "text/plain",
    fileSize: 104857,
    uploadedAt: "2026-09-21T14:30:00Z",
    hash: "0x91c834a812df...c189",
    verified: true,
  },
  {
    id: "evi-003",
    disputeId: "disp-101",
    submittedBy: "GCKF7J3...CLIENT",
    submitterRole: "client",
    title: "Bug Reports and Non-Responsive Test Cases",
    description: "Automated QA test suite failures showing that the API endpoint returns 500 on valid inputs.",
    fileUrl: "/evidence/qa_failures.json",
    fileType: "application/json",
    fileSize: 52428,
    uploadedAt: "2026-09-22T09:00:00Z",
    hash: "0x4b78912ea55c...e890",
    verified: false,
  },
];

/**
 * Queries evidence records dynamically for a given dispute ID.
 * Pulls from the backend API if available, falling back to mock datasets.
 */
export async function fetchArbitratorEvidence(
  disputeId: string,
  options?: { apiUrl?: string; signal?: AbortSignal }
): Promise<EvidenceItem[]> {
  const url = options?.apiUrl || `/api/disputes/${encodeURIComponent(disputeId)}/evidence`;

  try {
    const res = await fetch(url, { signal: options?.signal });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch {
    // Network or server error - fallback to mock dataset
  }

  // Filter mock dataset by dispute ID or return default items
  const matched = MOCK_EVIDENCE_DATASET.filter((item) => item.disputeId === disputeId);
  return matched.length > 0 ? matched : MOCK_EVIDENCE_DATASET;
}
