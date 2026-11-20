"use client";

/**
 * useTokenMetadata — resolves { symbol, decimals } for a job's token address.
 *
 * Issue #880: the backend never returns tokenSymbol / tokenDecimals, so every
 * job was shown with the XLM/7 fallback regardless of the actual token.
 *
 * Design
 * ------
 * • Prefer metadata already on the job object (future backend fields).
 * • For unknown tokens, simulate the SEP-41 `symbol()` / `decimals()` calls
 *   via `validateTokenContract`.
 * • Native XLM jobs short-circuit before any RPC call.
 * • Cache resolved metadata in a module-level Map so the same address is
 *   looked up only once per session.  The in-flight Promise is cached too, so
 *   two jobs with the same token share one lookup instead of racing.
 * • Failed lookups are NOT permanently cached so the caller can retry later.
 *
 * While metadata is unknown (loading or failed) the hook returns
 * `{ loading: true }` or `{ error, truncatedAddress }`.
 * The caller is responsible for showing the truncated address + raw base units
 * in that state — never "XLM" or 7.
 */

import { useEffect, useMemo, useState } from "react";
import { validateTokenContract } from "@/app/lib/token_validation";

// ---------------------------------------------------------------------------
// Native XLM Stellar Asset Contract address
// ---------------------------------------------------------------------------

/**
 * The well-known Stellar Asset Contract address for the native XLM asset.
 *
 * On testnet/mainnet:  CAS3J583BWZBKP2BQFTAMLECFVIMAS4WPXP5TLKZUCZPQTGLG74FPCM
 *
 * Override with NEXT_PUBLIC_NATIVE_XLM_CONTRACT when needed.
 */
export const NATIVE_XLM_CONTRACT =
  process.env.NEXT_PUBLIC_NATIVE_XLM_CONTRACT ??
  "CAS3J583BWZBKP2BQFTAMLECFVIMAS4WPXP5TLKZUCZPQTGLG74FPCM";

export const NATIVE_XLM_SYMBOL = "XLM";
export const NATIVE_XLM_DECIMALS = 7;

/** Returns true when `address` resolves to the native XLM Stellar Asset Contract. */
export function isNativeXlm(address: string): boolean {
  return address === NATIVE_XLM_CONTRACT;
}

// ---------------------------------------------------------------------------
// Session-level cache
// ---------------------------------------------------------------------------

export interface TokenMetadata {
  symbol: string;
  decimals: number;
}

/**
 * Resolved metadata cache.  Keyed by contract address.
 * Only successful results are stored here.
 */
const cache = new Map<string, TokenMetadata>();

/**
 * In-flight promise cache.  Prevents duplicate RPC calls for the same address
 * when multiple jobs use the same token.
 */
const inflight = new Map<string, Promise<TokenMetadata | null>>();

/**
 * Clears both caches.  Exported so tests can reset state between runs.
 */
export function clearTokenMetadataCache(): void {
  cache.clear();
  inflight.delete.bind(inflight);
  inflight.clear();
}

// ---------------------------------------------------------------------------
// Core lookup
// ---------------------------------------------------------------------------

/**
 * Resolves metadata for `address`.  Returns `null` on failure (not cached).
 * Consecutive callers share the same Promise while the first lookup is
 * in flight.
 */
function resolveTokenMetadata(address: string): Promise<TokenMetadata | null> {
  const cached = cache.get(address);
  if (cached) return Promise.resolve(cached);

  const existing = inflight.get(address);
  if (existing) return existing;

  const promise = validateTokenContract(address)
    .then((result) => {
      if (result.valid && result.symbol !== undefined && result.decimals !== undefined) {
        const meta: TokenMetadata = { symbol: result.symbol, decimals: result.decimals };
        cache.set(address, meta);
        inflight.delete(address);
        return meta;
      }
      inflight.delete(address);
      return null;
    })
    .catch(() => {
      inflight.delete(address);
      return null;
    });

  inflight.set(address, promise);
  return promise;
}

// ---------------------------------------------------------------------------
// Hook state type
// ---------------------------------------------------------------------------

export type TokenMetadataState =
  | { status: "loading" }
  | { status: "ready"; symbol: string; decimals: number }
  | { status: "error"; truncatedAddress: string };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Compute the synchronous / cached state for a given set of inputs.
 * Returns `null` when the state requires an async RPC call.
 */
function syncState(
  tokenAddress: string | undefined,
  preloadedSymbol: string | undefined,
  preloadedDecimals: number | undefined
): TokenMetadataState | null {
  // 1. Job already has both fields.
  if (preloadedSymbol !== undefined && preloadedDecimals !== undefined) {
    return { status: "ready", symbol: preloadedSymbol, decimals: preloadedDecimals };
  }
  if (!tokenAddress) return { status: "loading" };
  // 2. Native XLM.
  if (isNativeXlm(tokenAddress)) {
    return { status: "ready", symbol: NATIVE_XLM_SYMBOL, decimals: NATIVE_XLM_DECIMALS };
  }
  // 3. Already in cache.
  const cached = cache.get(tokenAddress);
  if (cached) return { status: "ready", symbol: cached.symbol, decimals: cached.decimals };
  // 4. Need an async lookup.
  return null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Resolves token metadata for a job.
 *
 * Priority:
 *   1. `fromJob.symbol` + `fromJob.decimals` — if the job already carries
 *      metadata (future backend fields), use it immediately with no RPC call.
 *   2. Native XLM address — returns { symbol: "XLM", decimals: 7 } instantly.
 *   3. `validateTokenContract` simulation — cached per address per session.
 *
 * While unknown: `{ status: "loading" }`.
 * On failure: `{ status: "error", truncatedAddress }` — never "XLM"/7.
 *
 * @param tokenAddress  The job's token contract address (may be undefined).
 * @param fromJob       Metadata fields already on the job response (optional).
 */
export function useTokenMetadata(
  tokenAddress: string | undefined,
  fromJob?: { symbol?: string; decimals?: number }
): TokenMetadataState {
  const preloadedSymbol = fromJob?.symbol;
  const preloadedDecimals = fromJob?.decimals;

  // Derive synchronous state so the first render reflects cached / native /
  // preloaded data without a flicker.
  const immediateState = useMemo(
    () => syncState(tokenAddress, preloadedSymbol, preloadedDecimals),
    [tokenAddress, preloadedSymbol, preloadedDecimals]
  );

  // Async state: starts at the synchronous value (or "loading" when async
  // lookup is needed), then transitions to ready/error once the RPC resolves.
  const [asyncState, setAsyncState] = useState<TokenMetadataState>(
    () => immediateState ?? { status: "loading" }
  );

  // Keep asyncState in sync when inputs change without triggering an RPC.
  // The eslint rule prohibits calling setState synchronously in an effect;
  // we therefore compute the new value purely and derive it via a ref update
  // pattern: return early when the synchronous state covers the case, so the
  // effect only runs for the async branch.
  useEffect(() => {
    // When we have a synchronous answer, nothing async is needed.
    if (immediateState !== null) {
      return;
    }

    // Need an async RPC lookup.
    if (!tokenAddress) return;

    let cancelled = false;

    resolveTokenMetadata(tokenAddress).then((meta) => {
      if (cancelled) return;
      if (meta) {
        setAsyncState({ status: "ready", symbol: meta.symbol, decimals: meta.decimals });
      } else {
        setAsyncState({
          status: "error",
          truncatedAddress: `${tokenAddress.slice(0, 4)}…${tokenAddress.slice(-4)}`,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tokenAddress, immediateState]);

  // If immediate state is available, return it directly (no async state needed).
  return immediateState ?? asyncState;
}
