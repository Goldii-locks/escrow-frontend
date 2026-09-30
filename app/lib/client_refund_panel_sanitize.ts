/**
 * client_refund_panel — form input sanitization (#502).
 * Form inputs containing code tags or script injection payloads are neutralized and ignored.
 */

const CODE_TAG_PATTERN = /<[^>]*>?|[<>]|javascript:|data:\s*text\/html/i;

/** Returns true if string contains HTML/code tags or script injection patterns. */
export function refundContainsCodeTags(
  value: string | null | undefined,
): boolean {
  if (typeof value !== "string") return false;
  return CODE_TAG_PATTERN.test(value);
}

/**
 * Sanitize refund reason input.
 * If input contains code tags, ignores/rejects the dangerous input and returns "".
 * Strips control characters and harmful characters.
 */
export function sanitizeRefundReason(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "";
  if (refundContainsCodeTags(raw)) {
    // Assert form ignores input containing code tags (#502)
    return "";
  }
  // Trim and remove any non-printable control characters
  return raw.replace(/[\x00-\x1F\x7F]/g, "").trim();
}

/**
 * Sanitize refund amount input.
 * If input contains code tags, ignores/rejects it and returns "".
 * Otherwise returns cleaned numeric string with at most one decimal point.
 */
export function sanitizeRefundAmount(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "";
  if (refundContainsCodeTags(raw)) {
    return "";
  }
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  return parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : parts[0];
}

/** Sanitize an address field. */
export function sanitizeClientAddress(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "";
  if (refundContainsCodeTags(raw)) {
    return "";
  }
  return raw.replace(/[^A-Za-z0-9]/g, "").trim();
}
