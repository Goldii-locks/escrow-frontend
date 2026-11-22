import { BACKEND_URL } from "@/app/lib/config";

export interface TokenBalanceQueryOptions {
  signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseTokenBalance(raw: unknown): string | null {
  if (!isRecord(raw)) return null;

  const data = isRecord(raw.data) ? raw.data : raw;
  let result: unknown = data.result ?? data.balance ?? data.amount;

  for (let depth = 0; depth < 2 && isRecord(result); depth += 1) {
    result = result.balance ?? result.amount ?? result.result;
  }

  if (typeof result === "string" && /^\d+$/.test(result.trim())) {
    return result.trim();
  }
  if (typeof result === "number" && Number.isSafeInteger(result) && result >= 0) {
    return String(result);
  }
  return null;
}

export async function fetchTokenBalance(
  token: string | null | undefined,
  holder: string | null | undefined,
  options?: TokenBalanceQueryOptions
): Promise<string | null> {
  if (!token || !holder) return null;

  try {
    const res = await fetch(`${BACKEND_URL}/api/jobs/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractId: token,
        method: "balance",
        args: [{ type: "address", value: holder }],
      }),
      signal: options?.signal,
    });
    if (!res.ok) return null;
    return parseTokenBalance(await res.json());
  } catch {
    return null;
  }
}
