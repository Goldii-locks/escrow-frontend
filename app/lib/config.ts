/**
 * config — Deployment configuration read from `NEXT_PUBLIC_*` environment
 * variables.
 *
 * This module is the single source of truth for the runtime endpoints and
 * identifiers the app is built against. It intentionally contains *only*
 * constants: importing it must never construct an RPC client, read the
 * filesystem, or otherwise do work at module scope, so it stays safe to pull
 * into any component (including ones that render on every page).
 *
 * The former `app/lib/contract.ts` also exported client-side transaction
 * builders (`buildTx`, `addressToScVal`, `i128ToScVal`, `getContract`) and a
 * module-level `new Server(RPC_URL)`. Nothing imported those, and every
 * transaction is built by the backend's `/api/jobs/build-tx`
 * (`app/lib/transactions.ts`), so the builders and the eagerly-created RPC
 * client were a second, divergent signing path plus a pointless bundle cost.
 * If a client-side RPC client is ever needed again (e.g. confirmation
 * polling), create it lazily inside the function that uses it — see
 * `createRpcServer` below.
 */

import type { Server } from "@stellar/stellar-sdk/rpc";
import { CONTRACT_ID, NETWORK_PASSPHRASE } from "./network_config";

/** Soroban JSON-RPC endpoint used for any *client-side* RPC call. */
export const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";

/**
 * Network passphrase and contract ID come from `network_config`, which has no
 * SDK dependency so the landing page can read them cheaply (#645).
 */
export { CONTRACT_ID, NETWORK_PASSPHRASE };

/** Default per-request timeout applied by the shared fetch helpers. */
export const API_REQUEST_TIMEOUT_MS = 15_000;

/**
 * Creates a Soroban RPC client on demand.
 *
 * Deliberately a function rather than a module-level `const`: constructing a
 * `Server` at import time pulls `@stellar/stellar-sdk/rpc` into the bundle and
 * opens a client on every page load even when nothing ever calls the RPC.
 * The SDK is imported dynamically so a caller that never touches the RPC
 * never downloads it.
 */
export async function createRpcServer(): Promise<Server> {
  const { Server } = await import("@stellar/stellar-sdk/rpc");
  return new Server(RPC_URL);
}

// =============================================================================
// Backend URL validation (#692) — fail the build when a non-HTTPS, non-local
// URL is supplied so insecure configs are caught at deploy time.
// =============================================================================

/**
 * Returns `{ ok: true }` for values that are safe to use as
 * `NEXT_PUBLIC_BACKEND_URL`, i.e.:
 *  - empty / undefined  → same-origin `/api` routing
 *  - `https://…`        → any TLS origin
 *  - `http://localhost…`, `http://127.0.0.1…`, `http://[::1]…` → local dev
 */
export function validateBackendUrl(url?: string): { ok: boolean; reason?: string } {
  if (url === undefined || url === "") {
    return { ok: true };
  }

  if (url.startsWith("https://")) {
    return { ok: true };
  }

  const isLoopback =
    /^http:\/\/localhost(?::\d+)?(?:\/.*)?$/.test(url) ||
    /^http:\/\/127\.0\.0\.1(?::\d+)?(?:\/.*)?$/.test(url) ||
    /^http:\/\/\[::1\](?::\d+)?(?:\/.*)?$/.test(url);

  if (isLoopback) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: `NEXT_PUBLIC_BACKEND_URL must start with https:// (got "${url}"). Use https://, a localhost URL for local dev, or leave it empty to use same-origin /api.`,
  };
}

function resolveBackendUrl(url: string | undefined): string {
  if (url !== undefined && url !== "") {
    return url;
  }
  return process.env.NODE_ENV === "production" ? "" : "http://localhost:3001";
}

const rawBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
const backendUrlCheck = validateBackendUrl(rawBackendUrl);

if (!backendUrlCheck.ok) {
  const message =
    backendUrlCheck.reason ??
    "NEXT_PUBLIC_BACKEND_URL must start with https://, a localhost URL, or be empty.";
  if (process.env.NODE_ENV === "production") {
    throw new Error(message);
  }
  console.warn(message);
}

/** Backend origin every `/api/...` request is issued against. */
export const BACKEND_URL = resolveBackendUrl(rawBackendUrl);
