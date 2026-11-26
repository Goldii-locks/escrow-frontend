import { z } from "zod";
import { BACKEND_URL } from "@/app/lib/config";
import { ApiShapeError } from "@/app/lib/api_schemas";
import { reportApiResponse } from "@/app/lib/errorReporter";

export { ApiShapeError } from "@/app/lib/api_schemas";

export const DEFAULT_API_TIMEOUT_MS = 15_000;

export type ApiEnvelopeMode = "required" | "optional" | "none";

export interface ApiRequestOptions extends Omit<RequestInit, "body" | "method" | "signal"> {
  signal?: AbortSignal;
  timeoutMs?: number;
  envelope?: ApiEnvelopeMode;
  /** Override the base URL for absolute-path-compatible API endpoints. */
  baseUrl?: string;
  /** Disable reporting for telemetry requests to prevent recursive reporting. */
  report?: boolean;
  /** User-facing fallback when an HTTP error has no message body. */
  fallbackMessage?: string;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly endpoint: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ApiTimeoutError extends ApiRequestError {
  constructor(endpoint: string, timeoutMs: number) {
    super(`API request timed out after ${timeoutMs}ms`, endpoint);
  }
}

export class ApiNetworkError extends ApiRequestError {}

export class ApiContentTypeError extends ApiRequestError {
  constructor(endpoint: string, contentType: string | null) {
    super(
      `Expected a JSON response from ${endpoint}, received ${contentType || "no content type"}`,
      endpoint
    );
  }
}

export class ApiResponseParseError extends ApiRequestError {
  constructor(endpoint: string, options?: ErrorOptions) {
    super(`Invalid JSON response from ${endpoint}`, endpoint, options);
  }
}

export class ApiEnvelopeError extends ApiRequestError {}

export class ApiApplicationError extends ApiRequestError {
  constructor(message: string, endpoint: string, readonly payload: unknown) {
    super(message, endpoint);
  }
}

export class ApiHttpError extends ApiRequestError {
  constructor(
    message: string,
    endpoint: string,
    readonly status: number,
    readonly payload: unknown
  ) {
    super(message, endpoint);
  }
}

export class ApiRateLimitError extends ApiHttpError {
  constructor(message: string, endpoint: string, payload: unknown) {
    super(message, endpoint, 429, payload);
  }
}

export class ApiServerError extends ApiHttpError {
  constructor(message: string, endpoint: string, status: number, payload: unknown) {
    super(message, endpoint, status, payload);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) {
    return /<!doctype|<html[\s>]/i.test(payload) ? fallback : payload.trim();
  }
  if (!isRecord(payload)) return fallback;
  const primary = ["message", "error", "sendError", "detail"]
    .map((key) => payload[key])
    .find((value): value is string => typeof value === "string" && Boolean(value.trim()));
  const details: string[] = [];
  if (Array.isArray(payload.details)) {
    for (const entry of payload.details) {
      const message = isRecord(entry) ? entry.message : entry;
      if (typeof message === "string" && message.trim() && !details.includes(message.trim())) {
        details.push(message.trim());
      }
    }
  }
  if (isRecord(payload.fields)) {
    for (const value of Object.values(payload.fields)) {
      if (typeof value === "string" && value.trim() && !details.includes(value.trim())) {
        details.push(value.trim());
      }
    }
  }
  if (details.length) {
    return [primary?.trim() ?? fallback, ...details].join(": ");
  }
  for (const key of ["error", "message", "detail"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  if (isRecord(payload.error)) {
    const nestedMessage = payload.error.message;
    if (typeof nestedMessage === "string" && nestedMessage.trim()) return nestedMessage.trim();
  }
  return fallback;
}

function resolveUrl(path: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function abortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  return mediaType === "application/json" || mediaType.endsWith("+json");
}

async function readErrorPayload(response: Response): Promise<unknown> {
  try {
    if (isJsonContentType(response.headers.get("content-type"))) return await response.clone().json();
    return await response.clone().text();
  } catch {
    return undefined;
  }
}

function unwrapEnvelope(
  payload: unknown,
  endpoint: string,
  mode: ApiEnvelopeMode
): unknown {
  if (mode === "none") return payload;
  if (!isRecord(payload)) {
    if (mode === "optional") return payload;
    throw new ApiEnvelopeError(`Expected a success/data envelope from ${endpoint}`, endpoint);
  }

  if (payload.success === false) {
    throw new ApiApplicationError(
      getErrorMessage(payload, `API request failed at ${endpoint}`),
      endpoint,
      payload
    );
  }

  if (payload.success === true && "data" in payload) return payload.data;
  if (mode === "optional" && "data" in payload) return payload.data;
  if (mode === "optional") return payload;

  throw new ApiEnvelopeError(`Invalid success/data envelope from ${endpoint}`, endpoint);
}

async function requestJson<T>(
  method: "GET" | "POST",
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  options: ApiRequestOptions = {}
): Promise<T> {
  const endpoint = path;
  const url = resolveUrl(path, options.baseUrl ?? BACKEND_URL);
  const timeoutMs = options.timeoutMs ?? DEFAULT_API_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abortListener: (() => void) | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new ApiTimeoutError(endpoint, timeoutMs));
    }, timeoutMs);
  });

  const signalPromise = new Promise<never>((_, reject) => {
    const signal = options.signal;
    if (!signal) return;
    if (signal.aborted) {
      controller.abort();
      reject(abortError());
      return;
    }
    abortListener = () => {
      controller.abort();
      reject(abortError());
    };
    signal.addEventListener("abort", abortListener, { once: true });
  });

  try {
    const headers = new Headers(options.headers);
    if (method === "POST" && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const init: RequestInit = {
      ...options,
      method,
      headers,
      signal: controller.signal,
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
    };
    delete (init as { timeoutMs?: number }).timeoutMs;
    delete (init as { envelope?: ApiEnvelopeMode }).envelope;
    delete (init as { baseUrl?: string }).baseUrl;
    delete (init as { report?: boolean }).report;
    delete (init as { fallbackMessage?: string }).fallbackMessage;

    const response = await Promise.race([fetch(url, init), timeoutPromise, signalPromise]);
    if (!response.ok) {
      if (options.report !== false) reportApiResponse(response, endpoint);
      const payload = await Promise.race([readErrorPayload(response), timeoutPromise, signalPromise]);
      const fallback = options.fallbackMessage ?? `API request failed with status ${response.status}`;
      const message = getErrorMessage(payload, fallback);
      if (response.status === 429) throw new ApiRateLimitError(message, endpoint, payload);
      if (response.status >= 500) {
        throw new ApiServerError(message, endpoint, response.status, payload);
      }
      throw new ApiHttpError(message, endpoint, response.status, payload);
    }

    if (response.status === 204) {
      const parsed = schema.safeParse(undefined);
      if (!parsed.success) throw new ApiShapeError(endpoint, parsed.error);
      return parsed.data;
    }

    const contentType = response.headers.get("content-type");
    if (!isJsonContentType(contentType)) throw new ApiContentTypeError(endpoint, contentType);

    let responseBody: unknown;
    try {
      responseBody = await Promise.race([response.json(), timeoutPromise, signalPromise]);
    } catch (error) {
      if (error instanceof ApiRequestError) throw error;
      throw new ApiResponseParseError(endpoint, { cause: error });
    }

    const payload = unwrapEnvelope(responseBody, endpoint, options.envelope ?? "required");
    const parsed = schema.safeParse(payload);
    if (!parsed.success) throw new ApiShapeError(endpoint, parsed.error);
    return parsed.data;
  } catch (error) {
    if (timedOut && !(error instanceof ApiTimeoutError)) {
      throw new ApiTimeoutError(endpoint, timeoutMs);
    }
    if (options.signal?.aborted) throw abortError();
    if (error instanceof ApiRequestError || error instanceof ApiShapeError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw error;
    const detail = error instanceof Error && error.message ? `: ${error.message}` : "";
    throw new ApiNetworkError(
      `Network request failed for ${endpoint}${detail}`,
      endpoint,
      { cause: error }
    );
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (abortListener) options.signal?.removeEventListener("abort", abortListener);
  }
}

/** Fetch and validate JSON from a backend endpoint. */
export function apiGet<T>(
  path: string,
  schema: z.ZodType<T>,
  options?: ApiRequestOptions
): Promise<T> {
  return requestJson("GET", path, undefined, schema, options);
}

/** POST JSON to a backend endpoint and validate its response. */
export function apiPost<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
  options?: ApiRequestOptions
): Promise<T> {
  return requestJson("POST", path, body, schema, options);
}
