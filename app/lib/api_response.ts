export const SERVICE_UNAVAILABLE_MESSAGE = "The service is temporarily unavailable. Retrying...";

const DEFAULT_FALLBACK_MESSAGE = "Unexpected response from server";

export class ApiResponseError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiResponseError";
    this.status = status;
  }
}

function responseStatus(res: Response): number {
  return typeof res.status === "number" ? res.status : 200;
}

function isJsonContentType(res: Response): boolean {
  const contentType = res.headers?.get?.("content-type");
  if (!contentType) return true;
  return /(?:^|\/|\+)json\b/i.test(contentType);
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (typeof body === "string" && body) return body.slice(0, 200);
    if (typeof body === "object" && body !== null) {
      const candidate = body as { error?: unknown; message?: unknown };
      if (typeof candidate.error === "string" && candidate.error) return candidate.error;
      if (typeof candidate.message === "string" && candidate.message) return candidate.message;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export async function readJsonApiResponse<T = unknown>(
  res: Response,
  options?: { fallbackMessage?: string }
): Promise<T> {
  const fallback = options?.fallbackMessage ?? DEFAULT_FALLBACK_MESSAGE;
  const status = responseStatus(res);

  if (res.ok === false) {
    if (status >= 500) {
      throw new ApiResponseError(status, SERVICE_UNAVAILABLE_MESSAGE);
    }
    throw new ApiResponseError(status, await readErrorMessage(res, fallback));
  }

  if (!isJsonContentType(res)) {
    throw new ApiResponseError(status, status >= 500 ? SERVICE_UNAVAILABLE_MESSAGE : fallback);
  }

  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiResponseError(status, status >= 500 ? SERVICE_UNAVAILABLE_MESSAGE : fallback);
  }
}
