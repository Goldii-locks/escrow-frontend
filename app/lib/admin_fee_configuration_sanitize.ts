/**
 * admin_fee_configuration — form input sanitization (#462).
 * Input containing code tags is ignored outright.
 */

const CODE_TAG_PATTERN = /<[^>]*>?|[<>]|javascript:/i;

export function feeConfigContainsCodeTags(value: string): boolean {
  return CODE_TAG_PATTERN.test(value);
}

/** Sanitize a fee rate (numeric string, optional single decimal point). */
export function sanitizeFeeRate(raw: string): string {
  if (feeConfigContainsCodeTags(raw)) return "";
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length ? `${whole}.${rest.join("")}` : whole;
}

/** Sanitize a fee recipient address (base32 alphanumerics only). */
export function sanitizeFeeRecipient(raw: string): string {
  if (feeConfigContainsCodeTags(raw)) return "";
  return raw.replace(/[^A-Za-z0-9]/g, "");
}
