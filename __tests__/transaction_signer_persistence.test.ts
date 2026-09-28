import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearSignerState,
  isValidSignerAddress,
  loadSignerState,
  parseSignerState,
  saveSignerState,
  serializeSignerState,
  TransactionSignerSessionStore,
  TransactionSignerStateParseError,
  TX_SIGNER_STATE_VERSION,
  TX_SIGNER_STORAGE_KEY,
  validateSignerState,
  type StorageAdapter,
} from "@/app/lib/transaction_signer_component";

// Valid Stellar public keys: "G" followed by 55 base32 (A-Z, 2-7) characters.
const ADDRESS = `G${"A".repeat(55)}`;
const OTHER_ADDRESS = `G${"B".repeat(55)}`;

const NETWORK = "Test SDF Network ; September 2015";

function createMemoryStorage(seed?: Record<string, string>): StorageAdapter {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

const VALID_SESSION = {
  address: ADDRESS,
  walletId: "freighter",
  networkPassphrase: NETWORK,
  connectedAt: 1_700_000_000_000,
};

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("transaction_signer_component — address validation", () => {
  it("accepts a well-formed Stellar public key", () => {
    expect(isValidSignerAddress(ADDRESS)).toBe(true);
  });

  it("rejects an address that is too short", () => {
    expect(isValidSignerAddress("GABC")).toBe(false);
  });

  it("rejects an address with characters outside base32", () => {
    expect(isValidSignerAddress(`G${"1".repeat(55)}`)).toBe(false);
  });

  it("rejects a non-string value", () => {
    expect(isValidSignerAddress(42)).toBe(false);
    expect(isValidSignerAddress(null)).toBe(false);
  });
});

describe("transaction_signer_component — serialization", () => {
  it("stamps the schema version onto the envelope", () => {
    expect(serializeSignerState(VALID_SESSION).version).toBe(
      TX_SIGNER_STATE_VERSION
    );
  });

  it("carries every session field through", () => {
    expect(serializeSignerState(VALID_SESSION)).toEqual({
      version: TX_SIGNER_STATE_VERSION,
      ...VALID_SESSION,
    });
  });

  it("defaults connectedAt to now when omitted", () => {
    const before = Date.now();
    const serialized = serializeSignerState({
      address: ADDRESS,
      walletId: "albedo",
      networkPassphrase: NETWORK,
    });
    expect(serialized.connectedAt).toBeGreaterThanOrEqual(before);
  });

  it("round-trips through JSON", () => {
    const raw = JSON.stringify(serializeSignerState(VALID_SESSION));
    expect(parseSignerState(raw)).toEqual({
      version: TX_SIGNER_STATE_VERSION,
      ...VALID_SESSION,
    });
  });
});

describe("transaction_signer_component — parsing and validation", () => {
  it("rejects malformed JSON", () => {
    expect(() => parseSignerState("{not json")).toThrow(
      TransactionSignerStateParseError
    );
  });

  it("rejects a non-object payload", () => {
    expect(() => validateSignerState("string")).toThrow("expected object");
  });

  it("rejects an array payload", () => {
    expect(() => validateSignerState([])).toThrow("expected object");
  });

  it("rejects an unsupported schema version", () => {
    expect(() =>
      validateSignerState({ ...VALID_SESSION, version: 99 })
    ).toThrow("unsupported version");
  });

  it("rejects an invalid address", () => {
    expect(() =>
      validateSignerState({
        ...VALID_SESSION,
        version: TX_SIGNER_STATE_VERSION,
        address: "nope",
      })
    ).toThrow("invalid address");
  });

  it("rejects an empty walletId", () => {
    expect(() =>
      validateSignerState({
        ...VALID_SESSION,
        version: TX_SIGNER_STATE_VERSION,
        walletId: "  ",
      })
    ).toThrow("invalid walletId");
  });

  it("rejects an empty networkPassphrase", () => {
    expect(() =>
      validateSignerState({
        ...VALID_SESSION,
        version: TX_SIGNER_STATE_VERSION,
        networkPassphrase: "",
      })
    ).toThrow("invalid networkPassphrase");
  });

  it("rejects a non-numeric connectedAt", () => {
    expect(() =>
      validateSignerState({
        ...VALID_SESSION,
        version: TX_SIGNER_STATE_VERSION,
        connectedAt: "yesterday",
      })
    ).toThrow("invalid connectedAt");
  });

  it("refuses to restore a payload carrying a secret key", () => {
    expect(() =>
      validateSignerState({
        ...VALID_SESSION,
        version: TX_SIGNER_STATE_VERSION,
        secretKey: "S...",
      })
    ).toThrow(/forbidden sensitive field/);
  });

  it("refuses to restore a payload carrying a seed or mnemonic", () => {
    expect(() =>
      validateSignerState({
        ...VALID_SESSION,
        version: TX_SIGNER_STATE_VERSION,
        mnemonic: "word word",
      })
    ).toThrow(/forbidden sensitive field/);
  });

  it("drops unknown extra fields from the returned envelope", () => {
    const parsed = validateSignerState({
      ...VALID_SESSION,
      version: TX_SIGNER_STATE_VERSION,
      somethingElse: true,
    });
    expect(parsed).not.toHaveProperty("somethingElse");
  });
});

describe("transaction_signer_component — save / load across a reload", () => {
  it("persists the active session", () => {
    const storage = createMemoryStorage();
    expect(saveSignerState(VALID_SESSION, { storage })).toBe(true);
    expect(storage.getItem(TX_SIGNER_STORAGE_KEY)).toContain(ADDRESS);
  });

  it("parses the active session back on reload", () => {
    const storage = createMemoryStorage();
    saveSignerState(VALID_SESSION, { storage });

    const restored = loadSignerState({ storage });
    expect(restored.restored).toBe(true);
    expect(restored.parseError).toBeNull();
    expect(restored.session).toEqual(VALID_SESSION);
  });

  it("remembers the active address across a real localStorage reload", () => {
    saveSignerState(VALID_SESSION);
    // A reload is just a fresh read against the same backing store.
    expect(loadSignerState().session?.address).toBe(ADDRESS);
  });

  it("returns an empty state when nothing was persisted", () => {
    const restored = loadSignerState({ storage: createMemoryStorage() });
    expect(restored).toEqual({
      restored: false,
      parseError: null,
      session: null,
    });
  });

  it("reports storage unavailability instead of throwing", () => {
    const restored = loadSignerState({ storage: null });
    expect(restored.restored).toBe(false);
    expect(restored.parseError).toBe("storage unavailable");
  });

  it("refuses to persist an invalid address", () => {
    const storage = createMemoryStorage();
    expect(
      saveSignerState({ ...VALID_SESSION, address: "bad" }, { storage })
    ).toBe(false);
    expect(storage.getItem(TX_SIGNER_STORAGE_KEY)).toBeNull();
  });

  it("refuses to persist an empty walletId", () => {
    const storage = createMemoryStorage();
    expect(saveSignerState({ ...VALID_SESSION, walletId: "" }, { storage })).toBe(
      false
    );
  });

  it("returns false when the storage write throws", () => {
    const storage: StorageAdapter = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: () => {},
    };
    expect(saveSignerState(VALID_SESSION, { storage })).toBe(false);
  });

  it("discards a corrupt payload and starts clean", () => {
    const storage = createMemoryStorage({
      [TX_SIGNER_STORAGE_KEY]: "{not json",
    });

    const restored = loadSignerState({ storage });
    expect(restored.restored).toBe(false);
    expect(restored.parseError).toBe("invalid JSON");
    expect(storage.getItem(TX_SIGNER_STORAGE_KEY)).toBeNull();
  });

  it("discards a payload written by an older schema version", () => {
    const storage = createMemoryStorage({
      [TX_SIGNER_STORAGE_KEY]: JSON.stringify({ ...VALID_SESSION, version: 0 }),
    });

    const restored = loadSignerState({ storage });
    expect(restored.parseError).toBe("unsupported version");
    expect(storage.getItem(TX_SIGNER_STORAGE_KEY)).toBeNull();
  });

  it("discards a payload smuggling a secret key", () => {
    const storage = createMemoryStorage({
      [TX_SIGNER_STORAGE_KEY]: JSON.stringify({
        ...VALID_SESSION,
        version: TX_SIGNER_STATE_VERSION,
        secretKey: "SABC",
      }),
    });

    const restored = loadSignerState({ storage });
    expect(restored.restored).toBe(false);
    expect(restored.parseError).toMatch(/forbidden sensitive field/);
  });

  it("survives a storage read that throws", () => {
    const storage: StorageAdapter = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(loadSignerState({ storage }).parseError).toBe("storage read failed");
  });

  it("clears the persisted session on disconnect", () => {
    const storage = createMemoryStorage();
    saveSignerState(VALID_SESSION, { storage });

    expect(clearSignerState({ storage })).toBe(true);
    expect(loadSignerState({ storage }).session).toBeNull();
  });

  it("clearSignerState returns false without storage", () => {
    expect(clearSignerState({ storage: null })).toBe(false);
  });

  it("overwrites a previous session with the newer one", () => {
    const storage = createMemoryStorage();
    saveSignerState(VALID_SESSION, { storage });
    saveSignerState(
      { ...VALID_SESSION, address: OTHER_ADDRESS, walletId: "albedo" },
      { storage }
    );

    expect(loadSignerState({ storage }).session?.address).toBe(OTHER_ADDRESS);
  });
});

describe("TransactionSignerSessionStore", () => {
  it("rehydrates the active session on construction", () => {
    const storage = createMemoryStorage();
    saveSignerState(VALID_SESSION, { storage });

    const store = new TransactionSignerSessionStore(storage);
    expect(store.getActiveAddress()).toBe(ADDRESS);
    expect(store.getState().restored).toBe(true);
  });

  it("starts empty when nothing was persisted", () => {
    const store = new TransactionSignerSessionStore(createMemoryStorage());
    expect(store.getActiveAddress()).toBeNull();
    expect(store.getState().session).toBeNull();
  });

  it("persists and mirrors the session in memory", () => {
    const store = new TransactionSignerSessionStore(createMemoryStorage());
    expect(store.persist(VALID_SESSION)).toBe(true);
    expect(store.getState().session).toEqual(VALID_SESSION);
  });

  it("does not mirror a rejected session", () => {
    const store = new TransactionSignerSessionStore(createMemoryStorage());
    expect(store.persist({ ...VALID_SESSION, address: "bad" })).toBe(false);
    expect(store.getActiveAddress()).toBeNull();
  });

  it("makes the persisted session visible to a fresh store — the reload path", () => {
    const storage = createMemoryStorage();
    new TransactionSignerSessionStore(storage).persist(VALID_SESSION);

    const afterReload = new TransactionSignerSessionStore(storage);
    expect(afterReload.getState().session).toEqual(VALID_SESSION);
  });

  it("restore() re-reads storage written by another tab", () => {
    const storage = createMemoryStorage();
    const store = new TransactionSignerSessionStore(storage);
    expect(store.getActiveAddress()).toBeNull();

    saveSignerState(VALID_SESSION, { storage });
    expect(store.restore().session?.address).toBe(ADDRESS);
  });

  it("returns a defensive copy of the session", () => {
    const store = new TransactionSignerSessionStore(createMemoryStorage());
    store.persist(VALID_SESSION);

    const first = store.getState().session;
    expect(first).not.toBeNull();
    first!.address = "mutated";

    expect(store.getActiveAddress()).toBe(ADDRESS);
  });

  it("clear() drops both the memory mirror and the persisted payload", () => {
    const storage = createMemoryStorage();
    const store = new TransactionSignerSessionStore(storage);
    store.persist(VALID_SESSION);

    store.clear();
    expect(store.getActiveAddress()).toBeNull();
    expect(storage.getItem(TX_SIGNER_STORAGE_KEY)).toBeNull();
  });

  it("overrideStorage() rehydrates from the new adapter", () => {
    const store = new TransactionSignerSessionStore(createMemoryStorage());
    const seeded = createMemoryStorage();
    saveSignerState(VALID_SESSION, { storage: seeded });

    store.overrideStorage(seeded);
    expect(store.getActiveAddress()).toBe(ADDRESS);
  });

  it("defaults connectedAt when persisting without one", () => {
    const store = new TransactionSignerSessionStore(createMemoryStorage());
    const before = Date.now();
    store.persist({
      address: ADDRESS,
      walletId: "albedo",
      networkPassphrase: NETWORK,
    });
    expect(store.getState().session?.connectedAt).toBeGreaterThanOrEqual(before);
  });

  it("uses the real localStorage adapter by default", () => {
    const store = new TransactionSignerSessionStore();
    expect(store.persist(VALID_SESSION)).toBe(true);
    expect(
      new TransactionSignerSessionStore().getActiveAddress()
    ).toBe(ADDRESS);
  });
});
