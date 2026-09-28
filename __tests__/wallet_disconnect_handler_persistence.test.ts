import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WalletActiveKeysStore,
  registerActiveWalletKey,
  disconnectWalletWithCheck,
  walletActiveKeysStore,
  WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY,
  WALLET_DISCONNECT_SCHEMA_VERSION,
  type WalletActiveKey,
} from "@/app/lib/wallet_disconnect_handler";

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      const v = store.get(key);
      return v === undefined ? null : v;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

function makeActiveKey(overrides: Partial<WalletActiveKey> = {}): WalletActiveKey {
  return {
    walletId: "freighter",
    address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    connectedAt: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// WalletActiveKeysStore - Basic operations
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler WalletActiveKeysStore persistence (#237)", () => {
  let storage: Storage;
  let store: WalletActiveKeysStore;

  beforeEach(() => {
    storage = createMockStorage();
    store = new WalletActiveKeysStore(storage);
  });

  it("starts with empty active keys", () => {
    expect(store.getActiveKeys()).toEqual([]);
  });

  it("adds a single active key", () => {
    const key = makeActiveKey();
    store.addActiveKey(key);
    const keys = store.getActiveKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0]).toEqual(key);
  });

  it("adds multiple active keys for different wallets", () => {
    const key1 = makeActiveKey({ walletId: "freighter", address: "GABC123456789" });
    const key2 = makeActiveKey({ walletId: "albedo", address: "GDEF987654321" });
    store.addActiveKey(key1);
    store.addActiveKey(key2);
    const keys = store.getActiveKeys();
    expect(keys).toHaveLength(2);
    expect(keys).toContainEqual(key1);
    expect(keys).toContainEqual(key2);
  });

  it("replaces existing key when adding same wallet ID", () => {
    const key1 = makeActiveKey({ connectedAt: 1000 });
    const key2 = makeActiveKey({ address: "GXYZ987654321", connectedAt: 2000 });
    store.addActiveKey(key1);
    store.addActiveKey(key2);
    const keys = store.getActiveKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0]).toEqual(key2);
  });

  it("removes active key by wallet ID", () => {
    const key1 = makeActiveKey({ walletId: "freighter", address: "GABC123456789" });
    const key2 = makeActiveKey({ walletId: "albedo", address: "GDEF987654321" });
    store.addActiveKey(key1);
    store.addActiveKey(key2);
    store.removeActiveKey("freighter");
    const keys = store.getActiveKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0]).toEqual(key2);
  });

  it("checks if wallet has active key", () => {
    const key = makeActiveKey();
    store.addActiveKey(key);
    expect(store.hasActiveKey("freighter")).toBe(true);
    expect(store.hasActiveKey("albedo")).toBe(false);
  });

  it("clears all active keys", () => {
    const key1 = makeActiveKey({ walletId: "freighter", address: "GABC123456789" });
    const key2 = makeActiveKey({ walletId: "albedo", address: "GDEF987654321" });
    store.addActiveKey(key1);
    store.addActiveKey(key2);
    store.clear();
    expect(store.getActiveKeys()).toEqual([]);
  });

  it("sanitizes invalid keys", () => {
    store.addActiveKey({ walletId: "", address: "GABC123", connectedAt: Date.now() } as WalletActiveKey);
    store.addActiveKey({ walletId: "freighter", address: "", connectedAt: Date.now() } as WalletActiveKey);
    store.addActiveKey({ walletId: "freighter", address: "GABC123", connectedAt: NaN } as WalletActiveKey);
    expect(store.getActiveKeys()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// WalletActiveKeysStore - Persistence and rehydration
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler WalletActiveKeysStore rehydration (#237)", () => {
  let storage: Storage;
  let store: WalletActiveKeysStore;

  beforeEach(() => {
    storage = createMockStorage();
    store = new WalletActiveKeysStore(storage);
  });

  it("persists active keys to storage", () => {
    const key = makeActiveKey({ address: "GABC123456789", connectedAt: 1234567890 });
    store.addActiveKey(key);
    const stored = storage.getItem(WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.version).toBe(WALLET_DISCONNECT_SCHEMA_VERSION);
    expect(parsed.activeKeys).toHaveLength(1);
    expect(parsed.activeKeys[0]).toEqual(key);
  });

  it("rehydrates active keys from storage on construction", () => {
    const key = makeActiveKey({ address: "GABC123456789", connectedAt: 1234567890 });
    store.addActiveKey(key);

    // Create new store instance to simulate reload
    const newStore = new WalletActiveKeysStore(storage);

    const keys = newStore.getActiveKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0]).toEqual(key);
  });

  it("rehydrates multiple active keys correctly", () => {
    const key1 = makeActiveKey({ walletId: "freighter", address: "GABC123456789", connectedAt: 1000 });
    const key2 = makeActiveKey({ walletId: "albedo", address: "GDEF987654321", connectedAt: 2000 });
    store.addActiveKey(key1);
    store.addActiveKey(key2);

    const newStore = new WalletActiveKeysStore(storage);

    const keys = newStore.getActiveKeys();
    expect(keys).toHaveLength(2);
    expect(keys).toContainEqual(key1);
    expect(keys).toContainEqual(key2);
  });

  it("handles schema mismatch by clearing storage", () => {
    const invalidPayload = JSON.stringify({
      version: 999,
      activeKeys: [],
    });
    storage.setItem(WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY, invalidPayload);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const newStore = new WalletActiveKeysStore(storage);

    expect(newStore.getActiveKeys()).toEqual([]);
    expect(storage.getItem(WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY)).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      "[wallet_disconnect_handler] REHYDRATE SCHEMA MISMATCH",
      "Persisted active keys data failed validation, falling back to clean state."
    );

    warnSpy.mockRestore();
  });

  it("handles malformed JSON by clearing storage", () => {
    storage.setItem(WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY, "invalid json");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const newStore = new WalletActiveKeysStore(storage);

    expect(newStore.getActiveKeys()).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("handles invalid active keys array by sanitizing", () => {
    const payloadWithInvalidKeys = JSON.stringify({
      version: WALLET_DISCONNECT_SCHEMA_VERSION,
      activeKeys: [
        { walletId: "freighter", address: "GABC123", connectedAt: 1000 },
        { walletId: "", address: "GDEF456", connectedAt: 2000 }, // invalid
        { walletId: "albedo", address: "", connectedAt: 3000 }, // invalid
      ],
    });
    storage.setItem(WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY, payloadWithInvalidKeys);

    const newStore = new WalletActiveKeysStore(storage);

    const keys = newStore.getActiveKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0].walletId).toBe("freighter");
  });

  it("public rehydrate method reloads from storage", () => {
    const key = makeActiveKey({ address: "GABC123456789", connectedAt: 1234567890 });
    store.addActiveKey(key);
    store.clear();

    // Manually restore storage
    const payload = JSON.stringify({
      version: WALLET_DISCONNECT_SCHEMA_VERSION,
      activeKeys: [key],
    });
    storage.setItem(WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY, payload);

    store.rehydrate();
    const keys = store.getActiveKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0]).toEqual(key);
  });

  it("overrideStorage swaps storage backend and rehydrates", () => {
    const key = makeActiveKey({ address: "GABC123456789", connectedAt: 1234567890 });
    store.addActiveKey(key);

    const newStorage = createMockStorage();
    const payload = JSON.stringify({
      version: WALLET_DISCONNECT_SCHEMA_VERSION,
      activeKeys: [
        makeActiveKey({
          walletId: "albedo",
          address: "GDEF987654321",
          connectedAt: 9876543210,
        }),
      ],
    });
    newStorage.setItem(WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY, payload);

    store.overrideStorage(newStorage);

    const keys = store.getActiveKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0].walletId).toBe("albedo");
  });
});

// ---------------------------------------------------------------------------
// registerActiveWalletKey helper
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler registerActiveWalletKey (#237)", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMockStorage();
    walletActiveKeysStore.overrideStorage(storage);
  });

  afterEach(() => {
    walletActiveKeysStore.clear();
    walletActiveKeysStore.overrideStorage(null);
  });

  it("registers a new active wallet key", () => {
    registerActiveWalletKey("freighter", "GABC123456789");
    const keys = walletActiveKeysStore.getActiveKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0].walletId).toBe("freighter");
    expect(keys[0].address).toBe("GABC123456789");
    expect(keys[0].connectedAt).toBeGreaterThan(0);
  });

  it("replaces existing key for same wallet ID", () => {
    registerActiveWalletKey("freighter", "GABC123456789");
    registerActiveWalletKey("freighter", "GXYZ987654321");
    const keys = walletActiveKeysStore.getActiveKeys();
    expect(keys).toHaveLength(1);
    expect(keys[0].address).toBe("GXYZ987654321");
  });
});

// ---------------------------------------------------------------------------
// Integration with disconnectWalletWithCheck
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler disconnectWalletWithCheck persistence integration (#237)", () => {
  let storage: Storage;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    storage = createMockStorage();
    walletActiveKeysStore.overrideStorage(storage);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    walletActiveKeysStore.clear();
    walletActiveKeysStore.overrideStorage(null);
  });

  it("removes active key on successful disconnect", async () => {
    registerActiveWalletKey("freighter", "GABC123456789");
    expect(walletActiveKeysStore.hasActiveKey("freighter")).toBe(true);

    const disconnectFn = vi.fn(async () => {});
    const result = await disconnectWalletWithCheck(
      "freighter",
      disconnectFn,
      () => true
    );

    expect(result.success).toBe(true);
    expect(walletActiveKeysStore.hasActiveKey("freighter")).toBe(false);
  });

  it("removes active key when wallet is not installed", async () => {
    registerActiveWalletKey("freighter", "GABC123456789");
    expect(walletActiveKeysStore.hasActiveKey("freighter")).toBe(true);

    const disconnectFn = vi.fn(async () => {});
    const result = await disconnectWalletWithCheck(
      "freighter",
      disconnectFn,
      () => false
    );

    expect(result.success).toBe(false);
    expect(walletActiveKeysStore.hasActiveKey("freighter")).toBe(false);
    expect(disconnectFn).not.toHaveBeenCalled();
  });

  it("does not remove active key on disconnect error", async () => {
    registerActiveWalletKey("freighter", "GABC123456789");
    expect(walletActiveKeysStore.hasActiveKey("freighter")).toBe(true);

    const disconnectFn = vi.fn(async () => {
      throw new Error("disconnect failed");
    });
    const result = await disconnectWalletWithCheck(
      "freighter",
      disconnectFn,
      () => true
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("disconnect failed");
    // Key should still be present since disconnect failed
    expect(walletActiveKeysStore.hasActiveKey("freighter")).toBe(true);
  });

  it("handles multiple wallet disconnects correctly", async () => {
    registerActiveWalletKey("freighter", "GABC123456789");
    registerActiveWalletKey("albedo", "GDEF987654321");

    const freighterDisconnect = vi.fn(async () => {});
    const albedoDisconnect = vi.fn(async () => {});

    await disconnectWalletWithCheck("freighter", freighterDisconnect, () => true);
    await disconnectWalletWithCheck("albedo", albedoDisconnect, () => true);

    expect(walletActiveKeysStore.getActiveKeys()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Session state validation on reload
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler session state validation on reload (#237)", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it("validates session state parses correctly after reload", () => {
    const validPayload = JSON.stringify({
      version: WALLET_DISCONNECT_SCHEMA_VERSION,
      activeKeys: [
        {
          walletId: "freighter",
          address: "GABC123456789",
          connectedAt: 1234567890,
        },
        {
          walletId: "albedo",
          address: "GDEF987654321",
          connectedAt: 1234567891,
        },
      ],
    });
    storage.setItem(WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY, validPayload);

    const store = new WalletActiveKeysStore(storage);

    const keys = store.getActiveKeys();
    expect(keys).toHaveLength(2);
    expect(keys[0].walletId).toBe("freighter");
    expect(keys[0].address).toBe("GABC123456789");
    expect(keys[1].walletId).toBe("albedo");
    expect(keys[1].address).toBe("GDEF987654321");
  });

  it("rejects session state with missing required fields", () => {
    const invalidPayload = JSON.stringify({
      version: WALLET_DISCONNECT_SCHEMA_VERSION,
      activeKeys: [
        {
          walletId: "freighter",
          // missing address
          connectedAt: 1234567890,
        },
      ],
    });
    storage.setItem(WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY, invalidPayload);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const store = new WalletActiveKeysStore(storage);

    const keys = store.getActiveKeys();
    expect(keys).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("rejects session state with invalid data types", () => {
    const invalidPayload = JSON.stringify({
      version: WALLET_DISCONNECT_SCHEMA_VERSION,
      activeKeys: [
        {
          walletId: 123, // should be string
          address: "GABC123456789",
          connectedAt: 1234567890,
        },
      ],
    });
    storage.setItem(WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY, invalidPayload);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const store = new WalletActiveKeysStore(storage);

    const keys = store.getActiveKeys();
    expect(keys).toHaveLength(0);

    warnSpy.mockRestore();
  });

  it("handles empty active keys array correctly", () => {
    const emptyPayload = JSON.stringify({
      version: WALLET_DISCONNECT_SCHEMA_VERSION,
      activeKeys: [],
    });
    storage.setItem(WALLET_DISCONNECT_ACTIVE_KEYS_STORAGE_KEY, emptyPayload);

    const store = new WalletActiveKeysStore(storage);

    const keys = store.getActiveKeys();
    expect(keys).toHaveLength(0);
  });
});
