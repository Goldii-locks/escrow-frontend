// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportApiResponse, scrubErrorText } from "@/app/lib/errorReporter";

const ADDRESS = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

describe("errorReporter", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CLIENT_ERROR_REPORTING", "true");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("truncates addresses and redacts XDRs", () => {
    const xdr = "AAAA".repeat(30);
    const scrubbed = scrubErrorText(`failed for ${ADDRESS} with ${xdr}`);
    expect(scrubbed).toBe("failed for GBRP…OX2H with [redacted-xdr]");
  });

  it("reports non-OK responses with route, status and request ID", () => {
    const res = {
      ok: false,
      status: 500,
      headers: new Headers({ "X-Request-Id": "req-123" }),
    } as Response;

    reportApiResponse(res, `/api/jobs/by-wallet/${ADDRESS}?page=1`);

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(init!.body as string);
    expect(body).toMatchObject({
      source: "api",
      route: "/api/jobs/by-wallet/GBRP…OX2H",
      status: 500,
      requestId: "req-123",
    });
    expect(init!.body).not.toContain(ADDRESS);
  });

  it("does nothing for OK responses or when disabled", () => {
    reportApiResponse({ ok: true, status: 200 } as Response, "/api/x");
    vi.stubEnv("NEXT_PUBLIC_CLIENT_ERROR_REPORTING", "");
    reportApiResponse({ ok: false, status: 500 } as Response, "/api/x");
    expect(fetch).not.toHaveBeenCalled();
  });
});
