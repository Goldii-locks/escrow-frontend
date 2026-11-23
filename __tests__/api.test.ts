import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  apiGet,
  apiPost,
  ApiApplicationError,
  ApiContentTypeError,
  ApiEnvelopeError,
  ApiHttpError,
  ApiNetworkError,
  ApiRateLimitError,
  ApiServerError,
  ApiShapeError,
  ApiTimeoutError,
} from "@/app/lib/api";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("shared API client", () => {
  it("unwraps the standard envelope and validates its data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true, data: "ok" })));

    await expect(apiGet("/api/example", z.string())).resolves.toBe("ok");
  });

  it("POSTs JSON and forwards request options", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { id: 7 } }));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(
      apiPost(
        "/api/example",
        { name: "test" },
        z.object({ id: z.number() }),
        { signal: controller.signal }
      )
    ).resolves.toEqual({ id: 7 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/example");
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({ name: "test" }),
    });
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("aborts an in-flight request when the caller signal is aborted", async () => {
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init.signal?.addEventListener(
            "abort",
            () => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            },
            { once: true }
          );
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const request = apiGet("/api/example", z.unknown(), { signal: controller.signal });

    controller.abort();

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("maps ordinary HTTP errors to ApiHttpError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "bad input" }, 400)));

    await expect(apiGet("/api/example", z.unknown())).rejects.toMatchObject({
      name: ApiHttpError.name,
      status: 400,
      message: "bad input",
    });
  });

  it("maps 429 responses to ApiRateLimitError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "slow down" }, 429)));

    await expect(apiGet("/api/example", z.unknown())).rejects.toBeInstanceOf(ApiRateLimitError);
  });

  it("maps 5xx responses to ApiServerError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ error: "unavailable" }, 503)));

    await expect(apiGet("/api/example", z.unknown())).rejects.toBeInstanceOf(ApiServerError);
  });

  it("rejects unsuccessful application envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: false, error: "not allowed" }))
    );

    await expect(apiGet("/api/example", z.unknown())).rejects.toBeInstanceOf(ApiApplicationError);
  });

  it("rejects invalid envelopes and schema data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "missing envelope" })));
    await expect(apiGet("/api/example", z.unknown())).rejects.toBeInstanceOf(ApiEnvelopeError);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: true, data: 42 }))
    );
    await expect(apiGet("/api/example", z.string())).rejects.toBeInstanceOf(ApiShapeError);
  });

  it("rejects non-JSON success responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<html/>", { headers: { "Content-Type": "text/html" } })
      )
    );

    await expect(apiGet("/api/example", z.unknown())).rejects.toBeInstanceOf(ApiContentTypeError);
  });

  it("maps network failures to ApiNetworkError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("connection refused")));

    await expect(apiGet("/api/example", z.unknown())).rejects.toBeInstanceOf(ApiNetworkError);
  });

  it("enforces the request timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) => {
            init.signal?.addEventListener(
              "abort",
              () => {
                const error = new Error("aborted");
                error.name = "AbortError";
                reject(error);
              },
              { once: true }
            );
          })
      )
    );

    await expect(apiGet("/api/example", z.unknown(), { timeoutMs: 5 })).rejects.toBeInstanceOf(
      ApiTimeoutError
    );
  });
});
