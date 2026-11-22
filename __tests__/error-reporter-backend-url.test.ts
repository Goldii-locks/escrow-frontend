// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("client error reporting backend URL (issue #843)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_CLIENT_ERROR_REPORTING", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function loadModules() {
    const [reporter, transactions, config] = await Promise.all([
      import("@/app/lib/errorReporter"),
      import("@/app/lib/transactions"),
      import("@/app/lib/config"),
    ]);
    return { reporter, transactions, backendUrl: config.BACKEND_URL };
  }

  it("uses same-origin /api when the backend URL is empty in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "backend down" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { reporter, transactions, backendUrl } = await loadModules();
    expect(backendUrl).toBe("");

    reporter.reportClientError({ source: "api", message: "boom" });
    await transactions
      .submitContractTransaction({
        method: "fund",
        args: [],
        sourceAddress: "GTEST",
        signTransaction: async () => "",
      })
      .catch(() => {});

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual(["/api/client-errors", "/api/jobs/build-tx"]);
  });

  it("uses the same configured base as submitContractTransaction", async () => {
    vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "https://api.milestonepay.app");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "backend down" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { reporter, transactions, backendUrl } = await loadModules();
    expect(backendUrl).toBe("https://api.milestonepay.app");

    reporter.reportClientError({ source: "api", message: "boom" });
    await transactions
      .submitContractTransaction({
        method: "fund",
        args: [],
        sourceAddress: "GTEST",
        signTransaction: async () => "",
      })
      .catch(() => {});

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls[0]).toBe(`${backendUrl}/api/client-errors`);
    expect(urls[1]).toBe(`${backendUrl}/api/jobs/build-tx`);
  });
});
