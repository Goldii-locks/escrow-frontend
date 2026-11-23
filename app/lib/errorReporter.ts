/**
 * Lightweight client error reporter.
 *
 * Posts scrubbed error reports to the backend's `POST /api/client-errors`
 * endpoint. Reporting is opt-in via `NEXT_PUBLIC_CLIENT_ERROR_REPORTING=true`
 * and never sends wallet XDRs or full Stellar addresses. See
 * `docs/client-error-reporting.md` for what is and isn't collected.
 */

export type ClientErrorSource = "api" | "tx" | "render" | "unhandled";

export interface ClientErrorReport {
  source: ClientErrorSource;
  message: string;
  /** API route (for `api` reports) — query strings are dropped. */
  route?: string;
  status?: number;
  requestId?: string | null;
}

const MAX_MESSAGE_LENGTH = 500;
const MAX_REPORTS_PER_MINUTE = 10;

// Stellar account (G…) and contract (C…) addresses are 56 base32 chars.
const ADDRESS_PATTERN = /\b([GC][A-Z2-7]{3})[A-Z2-7]{48}([A-Z2-7]{4})\b/g;
// Long base64 runs are almost always transaction/envelope XDRs.
const XDR_PATTERN = /[A-Za-z0-9+/]{60,}={0,2}/g;

let windowStart = 0;
let sentInWindow = 0;

function isEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CLIENT_ERROR_REPORTING === "true";
}

function endpoint(): string {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";
  return `${base}/api/client-errors`;
}

/** Truncate addresses, redact XDR blobs and cap the length. */
export function scrubErrorText(text: string): string {
  return text
    .replace(ADDRESS_PATTERN, "$1…$2")
    .replace(XDR_PATTERN, "[redacted-xdr]")
    .slice(0, MAX_MESSAGE_LENGTH);
}

function withinRateLimit(now: number): boolean {
  if (now - windowStart > 60_000) {
    windowStart = now;
    sentInWindow = 0;
  }
  if (sentInWindow >= MAX_REPORTS_PER_MINUTE) return false;
  sentInWindow += 1;
  return true;
}

/** Fire-and-forget; reporting failures are swallowed. */
export function reportClientError(report: ClientErrorReport): void {
  if (!isEnabled() || typeof window === "undefined") return;
  if (!withinRateLimit(Date.now())) return;

  const body = {
    source: report.source,
    message: scrubErrorText(report.message),
    route: report.route ? scrubErrorText(report.route.split("?")[0]) : undefined,
    status: report.status,
    requestId: report.requestId ?? undefined,
    page: scrubErrorText(window.location.pathname),
    timestamp: new Date().toISOString(),
  };

  try {
    void fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never let reporting break the app.
  }
}

/** Report a non-OK API response with its route, status and request ID. */
export function reportApiResponse(res: Response, route: string): void {
  if (!res || res.ok !== false) return;
  reportClientError({
    source: "api",
    message: `API request failed with status ${res.status}`,
    route,
    status: res.status,
    requestId: res.headers?.get?.("X-Request-Id") ?? null,
  });
}
