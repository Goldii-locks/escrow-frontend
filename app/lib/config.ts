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

import { Networks } from "@stellar/stellar-sdk";
import type { Server } from "@stellar/stellar-sdk/rpc";

/** Soroban JSON-RPC endpoint used for any *client-side* RPC call. */
export const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";

/** Network passphrase the wallet connections and contract calls are built for. */
export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE || Networks.TESTNET;

/** Deployed escrow contract address. Empty when the build omits the variable. */
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "";

/** Backend origin every `/api/...` request is issued against. */
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

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