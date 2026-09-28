/**
 * platform_metrics_charts_sanitize — unit tests (#512).
 * Verifies that form inputs containing code tags are ignored and that
 * allowlist-only characters are preserved for each field type.
 */

import { describe, it, expect } from "vitest";
import {
  metricsContainsCodeTags,
  sanitizeMetricsDateRange,
  sanitizeMetricsFilter,
  sanitizeMetricsLabel,
  sanitizeMetricsThreshold,
} from "../platform_metrics_charts_sanitize";

// =============================================================
// metricsContainsCodeTags
// =============================================================

describe("metricsContainsCodeTags", () => {
  it("returns true for a full HTML tag", () => {
    expect(metricsContainsCodeTags("<script>alert(1)</script>")).toBe(true);
  });

  it("returns true for an opening tag alone", () => {
    expect(metricsContainsCodeTags("<img")).toBe(true);
  });

  it("returns true for a closing angle bracket alone", () => {
    expect(metricsContainsCodeTags(">foo")).toBe(true);
  });

  it("returns true for an opening angle bracket alone", () => {
    expect(metricsContainsCodeTags("foo<bar")).toBe(true);
  });

  it("returns true for javascript: URI", () => {
    expect(metricsContainsCodeTags("javascript:alert(1)")).toBe(true);
  });

  it("returns true for JavaScript: with mixed case", () => {
    expect(metricsContainsCodeTags("JavaScript:void(0)")).toBe(true);
  });

  it("returns true for an onerror attribute payload", () => {
    expect(metricsContainsCodeTags('<img onerror="x">')).toBe(true);
  });

  it("returns false for a plain date string", () => {
    expect(metricsContainsCodeTags("2026-01-01")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(metricsContainsCodeTags("")).toBe(false);
  });

  it("returns false for a normal filter key", () => {
    expect(metricsContainsCodeTags("escrow_count")).toBe(false);
  });

  it("returns false for a numeric threshold", () => {
    expect(metricsContainsCodeTags("100.5")).toBe(false);
  });
});

// =============================================================
// sanitizeMetricsDateRange (#512 validation: ignores code tags)
// =============================================================

describe("sanitizeMetricsDateRange", () => {
  it("returns empty string for input containing a script tag", () => {
    expect(sanitizeMetricsDateRange("<script>")).toBe("");
  });

  it("returns empty string for input containing javascript: URI", () => {
    expect(sanitizeMetricsDateRange("javascript:x")).toBe("");
  });

  it("returns empty string for input containing code tags — validation check from #512", () => {
    // Issue #512: assert form ignores input containing code tags
    expect(sanitizeMetricsDateRange("<2026-01-01>")).toBe("");
  });

  it("keeps digits and hyphens for a valid ISO date", () => {
    expect(sanitizeMetricsDateRange("2026-09-26")).toBe("2026-09-26");
  });

  it("strips letters and special chars that are not digits or hyphens", () => {
    expect(sanitizeMetricsDateRange("2026/09/26")).toBe("20260926");
  });

  it("returns empty string for an empty input", () => {
    expect(sanitizeMetricsDateRange("")).toBe("");
  });

  it("strips spaces from the date range", () => {
    expect(sanitizeMetricsDateRange("2026 09 26")).toBe("20260926");
  });
});

// =============================================================
// sanitizeMetricsFilter (#512 validation: ignores code tags)
// =============================================================

describe("sanitizeMetricsFilter", () => {
  it("returns empty string for input containing an HTML tag", () => {
    expect(sanitizeMetricsFilter("<b>escrow</b>")).toBe("");
  });

  it("returns empty string for javascript: payload", () => {
    expect(sanitizeMetricsFilter("javascript:x")).toBe("");
  });

  it("returns empty string for input containing code tags — validation check from #512", () => {
    expect(sanitizeMetricsFilter("<script>")).toBe("");
  });

  it("keeps alphanumerics, hyphens and underscores", () => {
    expect(sanitizeMetricsFilter("escrow_count-v2")).toBe("escrow_count-v2");
  });

  it("strips spaces from a filter key", () => {
    expect(sanitizeMetricsFilter("escrow count")).toBe("escrowcount");
  });

  it("strips dots and slashes", () => {
    expect(sanitizeMetricsFilter("metric/count.total")).toBe("metriccounttotal");
  });

  it("returns empty string for an empty input", () => {
    expect(sanitizeMetricsFilter("")).toBe("");
  });
});

// =============================================================
// sanitizeMetricsLabel (#512 validation: ignores code tags)
// =============================================================

describe("sanitizeMetricsLabel", () => {
  it("returns empty string for a full script tag payload", () => {
    expect(sanitizeMetricsLabel("<script>alert('xss')</script>")).toBe("");
  });

  it("returns empty string for input containing code tags — validation check from #512", () => {
    expect(sanitizeMetricsLabel("<b>label</b>")).toBe("");
  });

  it("returns empty string for javascript: URI", () => {
    expect(sanitizeMetricsLabel("javascript:void(0)")).toBe("");
  });

  it("keeps plain text labels intact", () => {
    expect(sanitizeMetricsLabel("Total Escrows")).toBe("Total Escrows");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeMetricsLabel("  Monthly Stats  ")).toBe("Monthly Stats");
  });

  it("strips lone angle brackets that slipped through", () => {
    // The CODE_TAG_PATTERN would catch these, but sanitizeMetricsLabel also
    // applies the secondary strip for belt-and-braces safety.
    expect(sanitizeMetricsLabel("Revenue > 100")).toBe("");
  });

  it("strips control characters", () => {
    expect(sanitizeMetricsLabel("label\u0000value")).toBe("labelvalue");
  });

  it("returns empty string for an empty input", () => {
    expect(sanitizeMetricsLabel("")).toBe("");
  });
});

// =============================================================
// sanitizeMetricsThreshold (#512 validation: ignores code tags)
// =============================================================

describe("sanitizeMetricsThreshold", () => {
  it("returns empty string for input containing a script tag", () => {
    expect(sanitizeMetricsThreshold("<script>100</script>")).toBe("");
  });

  it("returns empty string for javascript: payload", () => {
    expect(sanitizeMetricsThreshold("javascript:100")).toBe("");
  });

  it("returns empty string for input containing code tags — validation check from #512", () => {
    expect(sanitizeMetricsThreshold("<100>")).toBe("");
  });

  it("keeps a plain integer threshold", () => {
    expect(sanitizeMetricsThreshold("100")).toBe("100");
  });

  it("keeps a decimal threshold with a single decimal point", () => {
    expect(sanitizeMetricsThreshold("100.5")).toBe("100.5");
  });

  it("strips letters and signs from a threshold input", () => {
    expect(sanitizeMetricsThreshold("100abc")).toBe("100");
  });

  it("collapses multiple decimal points to one", () => {
    expect(sanitizeMetricsThreshold("1.2.3")).toBe("1.23");
  });

  it("returns empty string for an empty input", () => {
    expect(sanitizeMetricsThreshold("")).toBe("");
  });

  it("strips currency symbols and spaces", () => {
    expect(sanitizeMetricsThreshold("$1 000")).toBe("1000");
  });
});
