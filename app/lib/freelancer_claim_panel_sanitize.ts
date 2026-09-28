/**
 * freelancer_claim_panel — form input sanitization (#492).
 * Form inputs containing code tags or script injection payloads are ignored outright.
 */

const CODE_TAG_PATTERN = /<[^>]*>?|[<>]|javascript:|data:\s*text\/html/i;

/** Returns true if string contains HTML/code tags or script injection patterns. */
export function freelancerClaimContainsCodeTags(
  value: string | null | undefined,
): boolean {
  if (typeof value !== "string") return false;
  return CODE_TAG_PATTERN.test(value);
}

/**
 * Sanitize payout claim note input.
 * If input contains code tags, ignores/rejects the dangerous input and returns "".
 */
export function sanitizeClaimNote(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "";
  if (freelancerClaimContainsCodeTags(raw)) {
    // Assert form ignores input containing code tags (#492)
    return "";
  }
  return raw.replace(/[\x00-\x1F\x7F]/g, "").trim();
}

/**
 * Sanitize invoice ID or reference number.
 * If input contains code tags, ignores/rejects it and returns "".
 */
export function sanitizeClaimInvoiceId(
  raw: string | null | undefined,
): string {
  if (!raw || typeof raw !== "string") return "";
  if (freelancerClaimContainsCodeTags(raw)) {
    return "";
  }
  return raw.replace(/[^A-Za-z0-9\-_]/g, "").trim();
}

/**
 * Sanitize claim amount input.
 * If input contains code tags, ignores/rejects it and returns "".
 */
export function sanitizeClaimAmount(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "";
  if (freelancerClaimContainsCodeTags(raw)) {
    return "";
  }
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  return parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : parts[0];
}
