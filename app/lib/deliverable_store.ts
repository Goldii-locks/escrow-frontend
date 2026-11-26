/**
 * deliverable_store — Off-chain storage for milestone deliverables (#823).
 *
 * The contract records only a SHA-256 of what was delivered via
 * `mark_delivered_with_hash`; the actual content (link / note / file) is kept
 * off-chain so the client can review it and verify the hash matches.
 *
 * `storeDeliverable` posts the payload to the backend's deliverable endpoint
 * best-effort: a failure must never block the on-chain transaction.
 */

export interface DeliverablePayload {
  /** The SHA-256 hex digest that was (or will be) submitted on-chain. */
  hash: string;
  /** Optional link the freelancer provided. */
  link?: string | null;
  /** Optional note the freelancer provided. */
  note?: string | null;
  /** Base64 of an attached file, when one was supplied. */
  fileBase64?: string | null;
  /** MIME type of the attached file. */
  fileType?: string | null;
  /** Original file name. */
  fileName?: string | null;
}

export interface DeliverableStoreOptions {
  apiUrl?: string;
  /** Signal to abort the off-chain upload without delaying the contract call. */
  signal?: AbortSignal;
}

/** Build the string that gets hashed from the form fields. */
export function buildDeliverableContent(payload: {
  link?: string | null;
  note?: string | null;
  fileName?: string | null;
}): string {
  const parts = [];
  if (payload.link) parts.push(`link:${payload.link}`);
  if (payload.note) parts.push(`note:${payload.note}`);
  if (payload.fileName) parts.push(`file:${payload.fileName}`);
  return parts.join("\n");
}

/** SHA-256 hex digest of the deliverable content. */
export async function hashDeliverableContent(content: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Persist the deliverable off-chain. Returns `false` (silently) when the
 * backend is unreachable so the on-chain submission can proceed regardless.
 */
export async function storeDeliverable(
  contractId: string,
  milestoneIndex: number,
  payload: DeliverablePayload,
  options: DeliverableStoreOptions = {}
): Promise<boolean> {
  const { apiUrl, signal } = options;
  const url = apiUrl || `/api/jobs/${encodeURIComponent(contractId)}/deliverable`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        milestone_index: milestoneIndex,
        ...payload,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
