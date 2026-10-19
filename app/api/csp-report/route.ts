/**
 * CSP violation report endpoint (issue #685).
 *
 * Receives `POST /api/csp-report` with a `application/csp-report` JSON body
 * per the CSP reporting spec:
 *
 *   {
 *     "csp-report": {
 *       "violated-directive": "script-src-elem",
 *       "blocked-uri": "https://evil.example.com/script.js",
 *       "document-uri": "https://milestonepay.app/dashboard",
 *       "line-number": 12,
 *       "column-number": 4,
 *       "source-file": "https://milestonepay.app/dashboard",
 *       ...
 *     }
 *   }
 *
 * The endpoint:
 *  - Validates the `Content-Type` header.
 *  - Extracts the violated directive, blocked URI, and page (document-uri).
 *  - Logs the report server-side (visible in server logs / nginx access logs).
 *  - Strips query strings from the document-uri before logging so PII
 *    is not accidentally captured.
 *  - Is rate-limited by the nginx `limit_req` directive (see nginx.conf).
 *  - Returns 204 No Content so browsers don't expect a body.
 *
 * NOTE: With `output: 'export'`, this route handler is only active during
 * `next dev`. In production, nginx proxies `/api/csp-report` to the Express
 * backend, which implements the same contract. The route handler here
 * documents the endpoint shape and supports local development.
 */

import { NextRequest } from "next/server";

interface CspReportBody {
  "csp-report"?: {
    "violated-directive"?: string;
    "blocked-uri"?: string;
    "document-uri"?: string;
    "line-number"?: number;
    "column-number"?: number;
    "source-file"?: string;
    [key: string]: unknown;
  };
}

/** Strip the query string from a URL for safe logging. */
function stripQueryString(uri: string): string {
  const qIndex = uri.indexOf("?");
  return qIndex === -1 ? uri : uri.slice(0, qIndex);
}

/** Extract and normalise a CSP report for logging. */
export function parseCspReport(body: unknown): {
  violatedDirective: string;
  blockedUri: string;
  page: string;
} {
  const report = (body as CspReportBody)?.["csp-report"] ?? {};
  return {
    violatedDirective: typeof report["violated-directive"] === "string"
      ? report["violated-directive"]
      : "unknown",
    blockedUri: typeof report["blocked-uri"] === "string"
      ? report["blocked-uri"]
      : "unknown",
    page: typeof report["document-uri"] === "string"
      ? stripQueryString(report["document-uri"])
      : "unknown",
  };
}

export async function POST(request: NextRequest): Promise<Response> {
  // Validate Content-Type — the CSP spec sends application/csp-report.
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/csp-report") && !contentType.includes("application/json")) {
    return new Response("Unsupported Media Type", { status: 415 });
  }

  try {
    const body: unknown = await request.json();
    const { violatedDirective, blockedUri, page } = parseCspReport(body);

    // Log server-side so operators can review violations during the
    // report-only rollout period before enforcing CSP.
    console.warn("[CSP Violation]", {
      violatedDirective,
      blockedUri,
      page,
      timestamp: new Date().toISOString(),
    });

    return new Response(null, { status: 204 });
  } catch {
    // Malformed JSON body — return 400 so the browser retries valid reports.
    return new Response("Bad Request", { status: 400 });
  }
}
