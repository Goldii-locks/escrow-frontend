/**
 * arbitration_escrow_details — form input sanitization (#482).
 * Form inputs containing code tags or script injection payloads are ignored outright.
 */

const CODE_TAG_PATTERN = /<[^>]*>?|[<>]|javascript:|data:\s*text\/html/i;

/** Returns true if string contains HTML/code tags or script injection patterns. */
export function arbitrationContainsCodeTags(
  value: string | null | undefined,
): boolean {
  if (typeof value !== "string") return false;
  return CODE_TAG_PATTERN.test(value);
}

/**
 * Sanitize arbitration reason/comment input.
 * If input contains code tags, ignores/rejects the dangerous input and returns "".
 * Otherwise strips control characters and trims.
 */
export function sanitizeArbitrationReason(
  raw: string | null | undefined,
): string {
  if (!raw || typeof raw !== "string") return "";
  if (arbitrationContainsCodeTags(raw)) {
    // Assert form ignores input containing code tags (#482)
    return "";
  }
  return raw.replace(/[\x00-\x1F\x7F]/g, "").trim();
}

/**
 * Sanitize arbitration notes/evidence comments.
 * If input contains code tags, ignores/rejects it and returns "".
 */
export function sanitizeArbitrationComment(
  raw: string | null | undefined,
): string {
  if (!raw || typeof raw !== "string") return "";
  if (arbitrationContainsCodeTags(raw)) {
    return "";
  }
  return raw.replace(/[\x00-\x1F\x7F]/g, "").trim();
}

/**
 * Sanitize arbitration monetary amount input.
 * If input contains code tags, ignores/rejects it and returns "".
 */
export function sanitizeArbitrationAmount(
  raw: string | null | undefined,
): string {
  if (!raw || typeof raw !== "string") return "";
  if (arbitrationContainsCodeTags(raw)) {
    return "";
  }
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  return parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : parts[0];
}
