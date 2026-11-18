import {
  WalletAuthManager,
  createWalletAuthManager,
  isBackendOrigin,
  type WalletAuthStorage,
  type WalletSigner,
  type WalletAuthConfig,
} from '../lib/wallet_auth';

const BACKEND_ORIGIN = 'https://api.escrow.example';
const OTHER_ORIGIN = 'https://other.example';

interface FakeSigner extends WalletSigner {
  signMessageCalls: string[];
  signAuthEntryCalls: string[];
  address: string;
  network: string;
}

function makeSigner(address = 'GABC', network = 'testnet'): FakeSigner {
  const signer: FakeSigner = {
    address,
    network,
    signMessageCalls: [],
    signAuthEntryCalls: [],
    async signMessage(message: string) {
      signer.signMessageCalls.push(message);
      return `sig:${message}`;
    },
    async signAuthEntry(entry: string) {
      signer.signAuthEntryCalls.push(entry);
      return `auth:${entry}`;
    },
  };
  return signer;
}

interface FakeBackend {
  challengeCalls: number;
  exchangeCalls: Array<{ challenge: string; signature: string; address: string }>;
  tokenCounter: number;
  tokenTtlMs: number;
  failNextExchange?: boolean;
}

function makeBackend(ttlMs = 60_000): FakeBackend {
  return {
    challengeCalls: 0,
    exchangeCalls: [],
    tokenCounter: 0,
    tokenTtlMs: ttlMs,
  };
}

function makeConfig(
  signer: FakeSigner,
  backend: FakeBackend,
  overrides: Partial<WalletAuthConfig> = {},
): WalletAuthConfig {
  return {
    backendOrigin: BACKEND_ORIGIN,
    getSigner: () => signer,
    requestChallenge: async () => {
      backend.challengeCalls += 1;
      return {
        challenge: `challenge-${backend.challengeCalls}`,
        scheme: 'message',
      };
    },
    exchangeChallenge: async (payload) => {
      if (backend.failNextExchange) {
        backend.failNextExchange = false;
        throw new Error('exchange failed');
      }
      backend.exchangeCalls.push(payload);
      backend.tokenCounter += 1;
      return {
        token: `token-${backend.tokenCounter}`,
        expiresAt: Date.now() + backend.tokenTtlMs,
      };
    },
    now: () => Date.now(),
    ...overrides,
  };
}

describe('wallet auth (#905)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('obtains a token after connecting without an extra prompt beyond the signature', async () => {
    const signer = makeSigner();
    const backend = makeBackend();
    const manager = createWalletAuthManager(makeConfig(signer, backend));

    await manager.connect();

    expect(backend.challengeCalls).toBe(1);
    expect(signer.signMessageCalls).toHaveLength(1);
    expect(signer.signAuthEntryCalls).toHaveLength(0);
    expect(backend.exchangeCalls).toHaveLength(1);
    expect(backend.exchangeCalls[0].address).toBe('GABC');
    expect(manager.getToken()).toBe('token-1');
    expect(manager.isAuthenticated()).toBe(true);
  });

  it('uses signAuthEntry when the challenge scheme requires it', async () => {
    const signer = makeSigner();
    const backend = makeBackend();
    const manager = createWalletAuthManager(
      makeConfig(signer, backend, {
        requestChallenge: async () => ({
          challenge: 'auth-entry-1',
          scheme: 'authEntry',
        }),
      }),
    );

    await manager.connect();

    expect(signer.signAuthEntryCalls).toEqual(['auth-entry-1']);
    expect(signer.signMessageCalls).toHaveLength(0);
    expect(manager.getToken()).toBe('token-1');
  });

  it('silently re-authenticates when the token expires', async () => {
    const signer = makeSigner();
    const backend = makeBackend(1_000);
    const manager = createWalletAuthManager(makeConfig(signer, backend));

    await manager.connect();
    expect(manager.getToken()).toBe('token-1');

    // Advance past expiry.
    jest.advanceTimersByTime(1_500);
    expect(manager.isAuthenticated()).toBe(false);

    // Requesting a valid token triggers silent re-auth.
    const token = await manager.getValidToken();
    expect(token).toBe('token-2');
    expect(backend.challengeCalls).toBe(2);
    expect(backend.exchangeCalls).toHaveLength(2);
    expect(signer.signMessageCalls).toHaveLength(2);
    expect(manager.isAuthenticated()).toBe(true);
  });

  it('does not re-authenticate when the token is still valid', async () => {
    const signer = makeSigner();
    const backend = makeBackend(60_000);
    const manager = createWalletAuthManager(makeConfig(signer, backend));

    await manager.connect();
    jest.advanceTimersByTime(1_000);

    const token = await manager.getValidToken();
    expect(token).toBe('token-1');
    expect(backend.challengeCalls).toBe(1);
    expect(backend.exchangeCalls).toHaveLength(1);
  });

  it('invalidates the token when the account switches', async () => {
    const signer = makeSigner('GABC');
    const backend = makeBackend();
    const manager = createWalletAuthManager(makeConfig(signer, backend));

    await manager.connect();
    expect(manager.getToken()).toBe('token-1');

    // Simulate account switch.
    signer.address = 'GXYZ';
    manager.handleAccountChange('GXYZ');

    expect(manager.getToken()).toBeNull();
    expect(manager.isAuthenticated()).toBe(false);

    // Next valid-token request re-authenticates for the new account.
    const token = await manager.getValidToken();
    expect(token).toBe('token-2');
    expect(backend.exchangeCalls).toHaveLength(2);
    expect(backend.exchangeCalls[1].address).toBe('GXYZ');
  });

  it('clears the token on disconnect', async () => {
    const signer = makeSigner();
    const backend = makeBackend();
    const manager = createWalletAuthManager(makeConfig(signer, backend));

    await manager.connect();
    expect(manager.getToken()).toBe('token-1');

    manager.disconnect();

    expect(manager.getToken()).toBeNull();
    expect(manager.isAuthenticated()).toBe(false);

    // No re-auth happens after disconnect until reconnected.
    expect(await manager.getValidToken()).toBeNull();
    expect(backend.challengeCalls).toBe(1);
  });

  it('clears the token on network switch', async () => {
    const signer = makeSigner('GABC', 'testnet');
    const backend = makeBackend();
    const manager = createWalletAuthManager(makeConfig(signer, backend));

    await manager.connect();
    expect(manager.getToken()).toBe('token-1');

    signer.network = 'mainnet';
    manager.handleNetworkChange('mainnet');

    expect(manager.getToken()).toBeNull();
    expect(manager.isAuthenticated()).toBe(false);
  });

  it('keeps the token in memory only (no localStorage)', async () => {
    const setItem = jest.fn();
    const getItem = jest.fn();
    const originalLocalStorage = (globalThis as any).localStorage;
    (globalThis as any).localStorage = { setItem, getItem };

    try {
      const signer = makeSigner();
      const backend = makeBackend();
      const manager = createWalletAuthManager(makeConfig(signer, backend));

      await manager.connect();
      expect(manager.getToken()).toBe('token-1');

      expect(setItem).not.toHaveBeenCalled();
      expect(getItem).not.toHaveBeenCalled();
    } finally {
      (globalThis as any).localStorage = originalLocalStorage;
    }
  });

  it('attaches the token only to backend-origin requests', async () => {
    const signer = makeSigner();
    const backend = makeBackend();
    const manager = createWalletAuthManager(makeConfig(signer, backend));

    await manager.connect();

    const backendHeaders = await manager.authorizeRequest(`${BACKEND_ORIGIN}/jobs`);
    expect(backendHeaders).toEqual({ Authorization: 'Bearer token-1' });

    const otherHeaders = await manager.authorizeRequest(`${OTHER_ORIGIN}/jobs`);
    expect(otherHeaders).toEqual({});

    // Relative URLs are not backend-origin requests.
    const relativeHeaders = await manager.authorizeRequest('/jobs');
    expect(relativeHeaders).toEqual({});
  });

  it('does not attach a token to backend requests when unauthenticated', async () => {
    const signer = makeSigner();
    const backend = makeBackend();
    const manager = createWalletAuthManager(makeConfig(signer, backend));

    const headers = await manager.authorizeRequest(`${BACKEND_ORIGIN}/jobs`);
    expect(headers).toEqual({});
  });

  it('isBackendOrigin matches only the configured backend origin', () => {
    expect(isBackendOrigin(`${BACKEND_ORIGIN}/jobs`, BACKEND_ORIGIN)).toBe(true);
    expect(isBackendOrigin(`${BACKEND_ORIGIN}`, BACKEND_ORIGIN)).toBe(true);
    expect(isBackendOrigin(`${OTHER_ORIGIN}/jobs`, BACKEND_ORIGIN)).toBe(false);
    expect(isBackendOrigin('/jobs', BACKEND_ORIGIN)).toBe(false);
    expect(isBackendOrigin(`https://api.escrow.example.evil.com/jobs`, BACKEND_ORIGIN)).toBe(false);
  });

  it('surfaces exchange failures without leaving a stale token', async () => {
    const signer = makeSigner();
    const backend = makeBackend();
    backend.failNextExchange = true;
    const manager = createWalletAuthManager(makeConfig(signer, backend));

    await expect(manager.connect()).rejects.toThrow('exchange failed');
    expect(manager.getToken()).toBeNull();
    expect(manager.isAuthenticated()).toBe(false);
  });

  it('deduplicates concurrent re-authentication requests', async () => {
    const signer = makeSigner();
    const backend = makeBackend(1_000);
    const manager = createWalletAuthManager(makeConfig(signer, backend));

    await manager.connect();
    jest.advanceTimersByTime(1_500);

    const [a, b] = await Promise.all([
      manager.getValidToken(),
      manager.getValidToken(),
    ]);

    expect(a).toBe('token-2');
    expect(b).toBe('token-2');
    expect(backend.challengeCalls).toBe(2);
    expect(backend.exchangeCalls).toHaveLength(2);
  });
});