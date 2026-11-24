import { describe, expect, it, vi, afterEach } from "vitest";
import { parseCspReport, POST } from "@/app/api/csp-report/route";

/**
 * Issue #685 — Add a Content-Security-Policy violation report endpoint.
 *
 * The endpoint receives POST /api/csp-report with a `csp-report` JSON body,
 * extracts the violated directive, blocked URI, and page (document-uri),
 * strips query strings from the page, logs the report, and returns 204.
 */

/** Minimal Request-like helper for the POST route handler. */
function makeRequest(body: unknown, contentType = "application/csp-report"): Request {
  return new Request("https://milestonepay.app/api/csp-report", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: JSON.stringify(body),
  });
}

describe("parseCspReport", () => {
  it("extracts violated directive, blocked URI, and page from a valid report", () => {
    const body = {
      "csp-report": {
        "violated-directive": "script-src-elem",
        "blocked-uri": "https://evil.example.com/script.js",
        "document-uri": "https://milestonepay.app/dashboard",
      },
    };

    const result = parseCspReport(body);

    expect(result).toEqual({
      violatedDirective: "script-src-elem",
      blockedUri: "https://evil.example.com/script.js",
      page: "https://milestonepay.app/dashboard",
    });
  });

  it("strips the query string from document-uri", () => {
    const body = {
      "csp-report": {
        "violated-directive": "img-src",
        "blocked-uri": "https://evil.example.com/img.png",
        "document-uri": "https://milestonepay.app/dashboard?token=secret&ref=abc",
      },
    };

    const result = parseCspReport(body);

    expect(result.page).toBe("https://milestonepay.app/dashboard");
  });

  it("returns 'unknown' for missing fields", () => {
    const body = { "csp-report": {} };

    const result = parseCspReport(body);

    expect(result).toEqual({
      violatedDirective: "unknown",
      blockedUri: "unknown",
      page: "unknown",
    });
  });

  it("returns 'unknown' for all fields when the csp-report key is absent", () => {
    const result = parseCspReport({ foo: "bar" });

    expect(result).toEqual({
      violatedDirective: "unknown",
      blockedUri: "unknown",
      page: "unknown",
    });
  });

  it("handles null or undefined input gracefully", () => {
    expect(parseCspReport(null)).toEqual({
      violatedDirective: "unknown",
      blockedUri: "unknown",
      page: "unknown",
    });

    expect(parseCspReport(undefined)).toEqual({
      violatedDirective: "unknown",
      blockedUri: "unknown",
      page: "unknown",
    });
  });
});

describe("POST /api/csp-report (issue #685)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the report and returns 204 for a valid csp-report body", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const body = {
      "csp-report": {
        "violated-directive": "script-src-elem",
        "blocked-uri": "https://evil.example.com/script.js",
        "document-uri": "https://milestonepay.app/dashboard",
      },
    };

    const response = await POST(makeRequest(body) as never);

    expect(response.status).toBe(204);

    // The endpoint should log the violation server-side.
    expect(warnSpy).toHaveBeenCalledWith(
      "[CSP Violation]",
      expect.objectContaining({
        violatedDirective: "script-src-elem",
        blockedUri: "https://evil.example.com/script.js",
        page: "https://milestonepay.app/dashboard",
      })
    );
  });

  it("strips query strings from the page before logging", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const body = {
      "csp-report": {
        "violated-directive": "img-src",
        "blocked-uri": "https://evil.example.com/img.png",
        "document-uri": "https://milestonepay.app/dashboard?token=secret",
      },
    };

    await POST(makeRequest(body) as never);

    expect(warnSpy).toHaveBeenCalledWith(
      "[CSP Violation]",
      expect.objectContaining({
        page: "https://milestonepay.app/dashboard",
      })
    );
  });

  it("accepts application/json content type", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const body = {
      "csp-report": {
        "violated-directive": "style-src",
        "blocked-uri": "https://evil.example.com/style.css",
        "document-uri": "https://milestonepay.app/create",
      },
    };

    const response = await POST(makeRequest(body, "application/json") as never);

    expect(response.status).toBe(204);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it("returns 415 for an unsupported content type", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await POST(makeRequest({}, "text/plain") as never);

    expect(response.status).toBe(415);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const request = new Request("https://milestonepay.app/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/csp-report" },
      body: "not valid json{{{",
    });

    const response = await POST(request as never);

    expect(response.status).toBe(400);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("logs 'unknown' for missing fields rather than failing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const body = { "csp-report": {} };

    const response = await POST(makeRequest(body) as never);

    expect(response.status).toBe(204);
    expect(warnSpy).toHaveBeenCalledWith(
      "[CSP Violation]",
      expect.objectContaining({
        violatedDirective: "unknown",
        blockedUri: "unknown",
        page: "unknown",
      })
    );
  });
});
