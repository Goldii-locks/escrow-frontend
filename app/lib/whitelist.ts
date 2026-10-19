import { BACKEND_URL, getWhitelist } from "@/app/lib/api";

/** A token accepted by the escrow contract's whitelist. */
export interface WhitelistToken {
  address: string;
  symbol?: string;
  name?: string;
  decimals?: number;
}

/** Exact body of `GET /api/jobs/:contractId/whitelist` (backend `sendSuccess`). */
interface WhitelistResponse {
  success: true;
  data: { tokens: unknown[] };
}

/** Normalize a raw whitelist item (string address or object) into a WhitelistToken. */
function normalizeToken(item: unknown): WhitelistToken | null {
  if (typeof item === "string") {
    const address = item.trim();
    return address ? { address } : null;
  }
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    const rawAddress =
      typeof o.address === "string"
        ? o.address
        : typeof o.token === "string"
          ? o.token
          : typeof o.id === "string"
            ? o.id
            : null;
    const address = rawAddress?.trim();
    if (!address) return null;
    return {
      address,
      symbol: typeof o.symbol === "string" ? o.symbol : undefined,
      name: typeof o.name === "string" ? o.name : undefined,
      decimals:
        typeof o.decimals === "number" && Number.isFinite(o.decimals)
          ? Math.floor(o.decimals)
          : undefined,
    };
  }
  return null;
}

/**
 * Fetch the contract's accepted-token whitelist from the backend.
 *
 * Endpoint: GET `${BACKEND_URL}/api/jobs/:contractId/whitelist`
 *
 * Reads `{ success: true, data: { tokens: [...] } }`, whose items are either
 * address strings or `{ address|token|id, symbol?, name? }` objects, and
 * normalizes them to `WhitelistToken[]`. Throws on network/HTTP failure so the
 * caller can distinguish "failed to load" from "empty whitelist".
 */
export async function fetchWhitelistedTokens(
  contractId: string,
  options?: { signal?: AbortSignal },
): Promise<WhitelistToken[]> {

    `${BACKEND_URL}/api/jobs/${encodeURIComponent(contractId)}/whitelist`,
    { signal: options?.signal },
  );
  if (!res.ok) {
    throw new Error(`Whitelist request failed with status ${res.status}`);
  }

  const body = (await res.json()) as Partial<WhitelistResponse>;
  const list = Array.isArray(body?.data?.tokens) ? body.data.tokens : [];

  return list
    .map(normalizeToken)
    .filter((token): token is WhitelistToken => token !== null);
}

/** Human-readable label: symbol, else name, else a truncated address. */
export function tokenLabel(token: WhitelistToken): string {
  if (token.symbol) return token.symbol;
  if (token.name) return token.name;
  return token.address.length > 12
    ? `${token.address.slice(0, 4)}â€¦${token.address.slice(-4)}`
    : token.address;
}



