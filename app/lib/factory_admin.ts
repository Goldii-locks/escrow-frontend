/**
 * factory_admin — read and write helpers for the escrow factory section of
 * /admin (#837).
 *
 * Token acceptance is a factory setting: `create_escrow` only accepts tokens
 * on the factory's allow list, and every escrow it creates is its own
 * contract. This replaces the per-escrow whitelist as the platform-wide token
 * control (#572).
 *
 * Every read goes through the backend's read-only `POST /api/jobs/query`
 * (see `queryContract`), and every write through `submitContractTransaction`
 * with the factory as `contractId`.
 */
import { queryContract } from "@/app/lib/admin";
import type { ContractArg } from "@/app/lib/transactions";

/** Factory contract methods the admin page uses, in one place. */
export const FACTORY_METHODS = {
  /** `get_admin() -> Address` */
  admin: "get_admin",
  /** `get_allowed_tokens() -> Vec<Address>` */
  allowedTokens: "get_allowed_tokens",
  /** `allow_token(admin, token)` */
  allowToken: "allow_token",
  /** `disallow_token(admin, token)`: removal, where the factory supports it. */
  disallowToken: "disallow_token",
  /** `get_escrow_wasm_hash() -> BytesN<32>`: the WASM new escrows are deployed from. */
  wasmHash: "get_escrow_wasm_hash",
} as const;

const CONTRACT_PATTERN = /^C[A-Z2-7]{55}$/;
const ACCOUNT_OR_CONTRACT_PATTERN = /^[GC][A-Z2-7]{55}$/;

/** The factory's stored admin, or null when it can't be read. */
export async function fetchFactoryAdmin(
  factoryId: string,
  options?: { signal?: AbortSignal }
): Promise<string | null> {
  try {
    const result = await queryContract(factoryId, FACTORY_METHODS.admin, [], options);
    return typeof result === "string" && ACCOUNT_OR_CONTRACT_PATTERN.test(result) ? result : null;
  } catch (err) {
    if (options?.signal?.aborted) throw err;
    return null;
  }
}

/**
 * The factory's allowed tokens. Accepts a bare address list or a list of
 * `{ address }` objects; anything that is not a contract address is dropped.
 * Throws when the query fails so the panel can show "couldn't load" rather
 * than an empty list.
 */
export async function fetchFactoryAllowedTokens(
  factoryId: string,
  options?: { signal?: AbortSignal }
): Promise<string[]> {
  const result = await queryContract(factoryId, FACTORY_METHODS.allowedTokens, [], options);
  return parseAllowedTokens(result);
}

export function parseAllowedTokens(result: unknown): string[] {
  const list = Array.isArray(result)
    ? result
    : result && typeof result === "object" && Array.isArray((result as { tokens?: unknown }).tokens)
      ? (result as { tokens: unknown[] }).tokens
      : null;
  if (list === null) throw new Error("get_allowed_tokens returned an unexpected result");

  const seen = new Set<string>();
  for (const item of list) {
    const objectAddress =
      item && typeof item === "object" ? (item as { address?: unknown }).address : undefined;
    const raw =
      typeof item === "string" ? item : typeof objectAddress === "string" ? objectAddress : "";
    const address = raw.trim();
    if (CONTRACT_PATTERN.test(address)) seen.add(address);
  }
  return [...seen];
}

/**
 * Normalises a `BytesN<32>` result to lowercase hex. The backend may return
 * hex, base64, or a byte array; null when it is none of those or not 32 bytes.
 */
export function normalizeWasmHash(result: unknown): string | null {
  if (typeof result === "string") {
    const hex = result.trim().replace(/^0x/i, "").toLowerCase();
    if (/^[0-9a-f]{64}$/.test(hex)) return hex;
    try {
      const bytes = Uint8Array.from(atob(result.trim()), (c) => c.charCodeAt(0));
      return bytes.length === 32 ? toHex(bytes) : null;
    } catch {
      return null;
    }
  }
  if (Array.isArray(result) && result.length === 32 && result.every(isByte)) {
    return toHex(Uint8Array.from(result as number[]));
  }
  if (result && typeof result === "object" && "data" in result) {
    return normalizeWasmHash((result as { data: unknown }).data);
  }
  return null;
}

function isByte(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 255;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The escrow WASM hash new escrows are deployed from, or null if unreadable. */
export async function fetchFactoryWasmHash(
  factoryId: string,
  options?: { signal?: AbortSignal }
): Promise<string | null> {
  try {
    return normalizeWasmHash(await queryContract(factoryId, FACTORY_METHODS.wasmHash, [], options));
  } catch (err) {
    if (options?.signal?.aborted) throw err;
    return null;
  }
}

/** Arguments for `allow_token` / `disallow_token`: the signing admin, then the token. */
export function factoryTokenArgs(admin: string, token: string): ContractArg[] {
  return [
    { type: "address", value: admin },
    { type: "address", value: token },
  ];
}

/** Whether `value` looks like a Soroban contract address (C + 55 base-32 chars). */
export function isContractAddress(value: string): boolean {
  return CONTRACT_PATTERN.test(value.trim());
}
