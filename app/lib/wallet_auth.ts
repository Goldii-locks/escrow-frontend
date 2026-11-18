// app/lib/wallet_auth.ts
//
// SEP-10-style wallet authentication for per-user backend features (#905).
//
// Flow:
//   1. Request a challenge from `${API_BASE}/auth/challenge`.
//   2. Have the connected wallet sign it (`signMessage` or `signAuthEntry`,
//      depending on the scheme advertised by the challenge).
//   3. Exchange the signed challenge for a short-lived session token.
//
// The token is kept in memory only (never `localStorage`), cleared on
// disconnect / account switch / network switch, and silently refreshed when it
// expires. It is only ever attached to requests whose URL starts with the
// backend origin.

import { API_BASE } from "./api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WalletAuthScheme = "signMessage" | "signAuthEntry";

export interface WalletAuthChallenge {
  /** Opaque challenge identifier returned by the backend. */
  id: string;
  /** Human-readable challenge / message the wallet must sign. */
  challenge: string;
  /** Which signing method the wallet should use. */
  scheme: WalletAuthScheme;
  /** Optional network passphrase the challenge is bound to. */
  networkPassphrase?: string;
  /** Optional expiry (ISO string or epoch ms) for the challenge itself. */
  expiresAt?: string | number;
}

export interface WalletAuthSession {
  token: string;
  /** Epoch milliseconds at which the token expires. */
  expiresAt: number;
}

/**
 * Minimal shape of the wallet kit we depend on. Kept structural so the module
 * does not need a hard import of the wallet kit and is easy to test.
 */
export interface WalletSigner {
  /** Public key of the currently connected account. */
  publicKey: string;
  /** Network the wallet is currently on (e.g. "PUBLIC" | "TESTNET"). */
  network?: string;
  signMessage?: (message: string, opts?: { address?: string }) => Promise<unknown>;
  signAuthEntry?: (entry: string, opts?: { address?: string }) => Promise<unknown>;
}

export interface WalletAuthOptions {
  /** Base URL of the backend. Defaults to `API_BASE`. */
  apiBase?: string;
  /** Override `fetch` (useful for tests). */
  fetchImpl?: typeof fetch;
  /** Clock override (useful for tests). Defaults to `Date.now`. */
  now?: () => number;
  /** How long before expiry to proactively refresh, in ms. Default 30s. */
  refreshSkewMs?: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class WalletAuthError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "WalletAuthError";
  }
}

// ---------------------------------------------------------------------------
// Module state (in memory only)
// ---------------------------------------------------------------------------

interface AuthState {
  session: WalletAuthSession | null;
  /** Identity the current session belongs to. */
  publicKey: string | null;
  network: string | null;
  /** In-flight authentication, so concurrent callers share one prompt. */
  pending: Promise<WalletAuthSession> | null;
}

const state: AuthState = {
  session: null,
  publicKey: null,
  network: null,
  pending: null,
};

let options: Required<Pick<WalletAuthOptions, "apiBase" | "now" | "refreshSkewMs">> &
  Pick<WalletAuthOptions, "fetchImpl"> = {
  apiBase: API_BASE,
  now: () => Date.now(),
  refreshSkewMs: 30_000,
};

/** Configure the module (mainly for tests / non-default backends). */
export function configureWalletAuth(opts: WalletAuthOptions = {}): void {
  options = {
    apiBase: opts.apiBase ?? options.apiBase ?? API_BASE,
    now: opts.now ?? options.now ?? (() => Date.now()),
    refreshSkewMs: opts.refreshSkewMs ?? options.refreshSkewMs ?? 30_000,
    fetchImpl: opts.fetchImpl ?? options.fetchImpl,
  };
}

function getFetch(): typeof fetch {
  if (options.fetchImpl) return options.fetchImpl;
  if (typeof fetch === "undefined") {
    throw new WalletAuthError("fetch is not available");
  }
  return fetch;
}

function apiBase(): string {
  return (options.apiBase ?? API_BASE).replace(/\/+$/, "");
}

// ---------------------------------------------------------------------------
// Token accessors
// ---------------------------------------------------------------------------

/** Returns the current token if it is present and not (about to be) expired. */
export function getAuthToken(): string | null {
  const { session } = state;
  if (!session) return null;
  if (options.now() >= session.expiresAt - options.refreshSkewMs) return null;
  return session.token;
}

/** True when a valid (non-expired) token is held. */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

/** Clears the in-memory session. Safe to call at any time. */
export function clearAuthToken(): void {
  state.session = null;
  state.publicKey = null;
  state.network = null;
  state.pending = null;
}

/**
 * Clears the session if it does not belong to the given identity. Call this on
 * account switch / network switch / disconnect.
 */
export function clearAuthTokenIfChanged(
  publicKey: string | null | undefined,
  network?: string | null,
): void {
  if (!state.session) return;
  const keyChanged = (publicKey ?? null) !== state.publicKey;
  const networkChanged =
    network !== undefined && (network ?? null) !== state.network;
  if (keyChanged || networkChanged) {
    clearAuthToken();
  }
}

// ---------------------------------------------------------------------------
// Challenge / exchange
// ---------------------------------------------------------------------------

function parseExpiry(value: string | number | undefined, fallbackMs: number): number {
  if (value === undefined || value === null) return options.now() + fallbackMs;
  if (typeof value === "number") {
    // Heuristic: seconds vs milliseconds.
    return value < 1e12 ? value * 1000 : value;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? options.now() + fallbackMs : parsed;
}

async function requestChallenge(signer: WalletSigner): Promise<WalletAuthChallenge> {
  const res = await getFetch()(`${apiBase()}/auth/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: signer.publicKey,
      network: signer.network,
    }),
  });
  if (!res.ok) {
    throw new WalletAuthError(`Challenge request failed (${res.status})`);
  }
  const data = (await res.json()) as Partial<WalletAuthChallenge>;
  if (!data || typeof data.challenge !== "string" || typeof data.id !== "string") {
    throw new WalletAuthError("Malformed challenge response");
  }
  const scheme: WalletAuthScheme =
    data.scheme === "signAuthEntry" ? "signAuthEntry" : "signMessage";
  return {
    id: data.id,
    challenge: data.challenge,
    scheme,
    networkPassphrase: data.networkPassphrase,
    expiresAt: data.expiresAt,
  };
}

async function signChallenge(
  signer: WalletSigner,
  challenge: WalletAuthChallenge,
): Promise<unknown> {
  const opts = { address: signer.publicKey };
  if (challenge.scheme === "signAuthEntry") {
    if (!signer.signAuthEntry) {
      throw new WalletAuthError("Wallet does not support signAuthEntry");
    }
    return signer.signAuthEntry(challenge.challenge, opts);
  }
  if (!signer.signMessage) {
    throw new WalletAuthError("Wallet does not support signMessage");
  }
  return signer.signMessage(challenge.challenge, opts);
}

async function exchange(
  signer: WalletSigner,
  challenge: WalletAuthChallenge,
  signature: unknown,
): Promise<WalletAuthSession> {
  const res = await getFetch()(`${apiBase()}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: challenge.id,
      publicKey: signer.publicKey,
      network: signer.network,
      scheme: challenge.scheme,
      signature,
    }),
  });
  if (!res.ok) {
    throw new WalletAuthError(`Token exchange failed (${res.status})`);
  }
  const data = (await res.json()) as {
    token?: string;
    expiresAt?: string | number;
    expiresIn?: number;
  };
  if (!data || typeof data.token !== "string" || data.token.length === 0) {
    throw new WalletAuthError("Malformed token response");
  }
  const expiresAt =
    data.expiresAt !== undefined
      ? parseExpiry(data.expiresAt, 0)
      : options.now() + (data.expiresIn ?? 300) * 1000;
  return { token: data.token, expiresAt };
}

// ---------------------------------------------------------------------------
// Public authentication entry points
// ---------------------------------------------------------------------------

/**
 * Authenticate the connected wallet: request a challenge, sign it, and exchange
 * it for a session token. Concurrent calls share a single in-flight request so
 * the user is only prompted once.
 */
export async function authenticateWallet(signer: WalletSigner): Promise<WalletAuthSession> {
  if (!signer || !signer.publicKey) {
    throw new WalletAuthError("No connected wallet");
  }

  // Reuse a valid session for the same identity.
  const existing = getAuthToken();
  if (
    existing &&
    state.publicKey === signer.publicKey &&
    (signer.network === undefined || state.network === (signer.network ?? null))
  ) {
    return state.session as WalletAuthSession;
  }

  // Identity changed: drop any stale session before starting.
  if (state.publicKey && state.publicKey !== signer.publicKey) {
    clearAuthToken();
  }

  if (state.pending) return state.pending;

  const run = (async () => {
    const challenge = await requestChallenge(signer);
    const signature = await signChallenge(signer, challenge);
    const session = await exchange(signer, challenge, signature);
    state.session = session;
    state.publicKey = signer.publicKey;
    state.network = signer.network ?? null;
    return session;
  })();

  state.pending = run;
  try {
    return await run;
  } finally {
    if (state.pending === run) state.pending = null;
  }
}

/**
 * Returns a valid token, silently re-authenticating if the current one has
 * expired. Returns `null` if no signer is available.
 */
export async function ensureAuthToken(
  signer: WalletSigner | null | undefined,
): Promise<string | null> {
  const token = getAuthToken();
  if (token) return token;
  if (!signer) return null;
  try {
    const session = await authenticateWallet(signer);
    return session.token;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

/** True when `url` points at the backend origin. */
export function isBackendUrl(url: string): boolean {
  try {
    const base = new URL(apiBase(), typeof location !== "undefined" ? location.href : undefined);
    const target = new URL(url, base.href);
    return target.origin === base.origin;
  } catch {
    return false;
  }
}

/**
 * Attaches the session token to `headers` when `url` targets the backend
 * origin. Returns the (possibly new) headers object.
 */
export function withAuthHeader(
  url: string,
  headers: HeadersInit = {},
): HeadersInit {
  if (!isBackendUrl(url)) return headers;
  const token = getAuthToken();
  if (!token) return headers;

  if (headers instanceof Headers) {
    const next = new Headers(headers);
    next.set("Authorization", `Bearer ${token}`);
    return next;
  }
  if (Array.isArray(headers)) {
    const filtered = headers.filter(([k]) => k.toLowerCase() !== "authorization");
    return [...filtered, ["Authorization", `Bearer ${token}`]];
  }
  return { ...(headers as Record<string, string>), Authorization: `Bearer ${token}` };
}

/**
 * `fetch` wrapper that attaches the auth token to backend requests and
 * silently re-authenticates once on a 401 when a signer is available.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  signer?: WalletSigner | null,
): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const doFetch = getFetch();

  const first = await doFetch(input, {
    ...init,
    headers: withAuthHeader(url, init.headers),
  });

  if (first.status !== 401 || !signer) return first;

  // Token rejected: clear and try once more with a fresh token.
  clearAuthToken();
  const token = await ensureAuthToken(signer);
  if (!token) return first;

  return doFetch(input, {
    ...init,
    headers: withAuthHeader(url, init.headers),
  });
}