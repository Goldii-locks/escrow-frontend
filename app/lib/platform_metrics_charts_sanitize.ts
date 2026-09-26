/**
 * platform_metrics_charts — form input sanitization (#512).
 * Input containing code tags or script payloads is ignored outright.
 * Kept free of React so every rule can be asserted directly in tests.
 */

// =============================================================
// Code-tag guard
// =============================================================

/** Matches anything that looks like an HTML/script tag or a script-URL payload. */
const CODE_TAG_PATTERN = /<[^>]*>?|[<>]|javascript:/i;

/** True when the value contains markup that could carry an injected payload. */
export function metricsContainsCodeTags(value: string): boolean {
  return CODE_TAG_PATTERN.test(value);
}

// =============================================================
// Field sanitizers
// =============================================================

/**
 * Sanitize a date-range string (ISO date fragment, digits and hyphens only).
 *
 * Input containing code tags is ignored outright (returns `""`); otherwise
 * every character that is not a digit or hyphen is dropped.
 */
export function sanitizeMetricsDateRange(raw: string): string {
  if (metricsContainsCodeTags(raw)) return "";
  return raw.replace(/[^0-9\-]/g, "");
}

/**
 * Sanitize a metric key/filter string (alphanumerics, hyphens, and underscores).
 *
 * Input containing code tags is ignored outright (returns `""`); otherwise
 * only URL-safe identifier characters are kept.
 */
export function sanitizeMetricsFilter(raw: string): string {
  if (metricsContainsCodeTags(raw)) return "";
  return raw.replace(/[^A-Za-z0-9_\-]/g, "");
}

/**
 * Sanitize a free-form label or annotation string (printable ASCII, no tags).
 *
 * Input containing code tags is ignored outright (returns `""`); otherwise
 * HTML angle brackets and control characters are stripped so the value is
 * safe to render in chart tooltips or axis labels.
 */
export function sanitizeMetricsLabel(raw: string): string {
  if (metricsContainsCodeTags(raw)) return "";
  return raw
    .replace(/<[^>]*>?/g, "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
}

/**
 * Sanitize a numeric threshold string (non-negative integer or decimal).
 *
 * Input containing code tags is ignored outright (returns `""`); otherwise
 * only digits and a single decimal point are kept.
 */
export function sanitizeMetricsThreshold(raw: string): string {
  if (metricsContainsCodeTags(raw)) return "";
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length ? `${whole}.${rest.join("")}` : whole;
}
