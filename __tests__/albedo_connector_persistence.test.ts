import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALBEDO_STATE_VERSION,
  ALBEDO_STORAGE_KEY,
  AlbedoSessionManager,
  AlbedoStateParseError,
  clearAlbedoState,
  isValidNetwork,
  isValidStellarAddress,
  loadAlbedoState,
  parseAlbedoState,
  saveAlbedoState,
  serializeWalletState,
  validateSerializedState,
  type AlbedoSerializedState,
  type StorageAdapter,
} from "@/app/lib/albedo_connector";

/** Valid G-prefixed 56-char public keys (format-only; checksum not required). */
const ADDRESS_A = `G${"A".repeat(55)}`;
const ADDRESS_B = `G${"B".repeat(55)}`;

class MockStorage implements StorageAdapter {
  private store = new Map<string, string>();
  throwOnGet = false;
  throwOnSet = false;
  throwOnRemove = false;

  getItem(key: string): string | null {
    if (this.throwOnGet) throw new Error("getItem failed");
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSet) throw new Error("setItem failed");
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    if (this.throwOnRemove) throw new Error("removeItem failed");
    this.store.delete(key);
  }
}

function validState(
  overrides: Partial<AlbedoSerializedState> = {}
): AlbedoSerializedState {
  return {
    version: ALBEDO_STATE_VERSION,
    address: ADDRESS_A,
    network: "testnet",
    connectedAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe("albedo_connector address / network validators", () => {
  it("accepts valid Stellar public keys", () => {
    expect(isValidStellarAddress(ADDRESS_A)).toBe(true);
    expect(isValidStellarAddress(ADDRESS_B)).toBe(true);
  });

  it("rejects short, empty, non-G, and secret-key-shaped values", () => {
    expect(isValidStellarAddress("GSHORT")).toBe(false);
    expect(isValidStellarAddress("")).toBe(false);
    expect(isValidStellarAddress("S" + "A".repeat(55))).toBe(false);
    expect(isValidStellarAddress(null)).toBe(false);
    expect(isValidStellarAddress(123)).toBe(false);
  });

  it("accepts only mainnet/testnet networks", () => {
    expect(isValidNetwork("mainnet")).toBe(true);
    expect(isValidNetwork("testnet")).toBe(true);
    expect(isValidNetwork("futurenet")).toBe(false);
    expect(isValidNetwork(null)).toBe(false);
  });
});

describe("albedo_connector serialize / deserialize", () => {
  it("serializes the minimum non-sensitive session fields", () => {
    const serialized = serializeWalletState({
      address: ADDRESS_A,
      network: "mainnet",
      connectedAt: 42,
    });

    expect(serialized).toEqual({
      version: ALBEDO_STATE_VERSION,
      address: ADDRESS_A,
      network: "mainnet",
      connectedAt: 42,
    });
    expect(serialized).not.toHaveProperty("secret");
    expect(serialized).not.toHaveProperty("privateKey");
    expect(JSON.stringify(serialized)).not.toMatch(/secret|privateKey|seed|mnemonic/i);
  });

  it("auto-stamps connectedAt when omitted", () => {
    const before = Date.now();
    const serialized = serializeWalletState({
      address: ADDRESS_A,
      network: "testnet",
    });
    expect(serialized.connectedAt).toBeGreaterThanOrEqual(before);
  });

  it("round-trips JSON via parseAlbedoState", () => {
    const serialized = serializeWalletState({
      address: ADDRESS_B,
      network: "testnet",
      connectedAt: 99,
    });
    const parsed = parseAlbedoState(JSON.stringify(serialized));
    expect(parsed).toEqual(serialized);
  });

  it("throws AlbedoStateParseError on malformed JSON", () => {
    expect(() => parseAlbedoState("{not-json")).toThrow(AlbedoStateParseError);
  });
});

describe("albedo_connector validateSerializedState", () => {
  it("accepts a valid persisted payload", () => {
    expect(validateSerializedState(validState())).toEqual(validState());
  });

  it("rejects missing / non-object roots", () => {
    expect(() => validateSerializedState(null)).toThrow(AlbedoStateParseError);
    expect(() => validateSerializedState(undefined)).toThrow(AlbedoStateParseError);
    expect(() => validateSerializedState("x")).toThrow(AlbedoStateParseError);
    expect(() => validateSerializedState(1)).toThrow(AlbedoStateParseError);
  });

  it("rejects stale / unsupported versions", () => {
    expect(() =>
      validateSerializedState(validState({ version: 99 as typeof ALBEDO_STATE_VERSION }))
    ).toThrow(/version/i);
  });

  it("rejects invalid addresses and networks", () => {
    expect(() =>
      validateSerializedState(validState({ address: "bad" }))
    ).toThrow(AlbedoStateParseError);
    expect(() =>
      validateSerializedState({
        ...validState(),
        network: "devnet",
      })
    ).toThrow(/network/i);
  });

  it("rejects non-positive or non-finite connectedAt", () => {
    expect(() =>
      validateSerializedState(validState({ connectedAt: 0 }))
    ).toThrow(/connectedAt/);
    expect(() =>
      validateSerializedState(validState({ connectedAt: -1 }))
    ).toThrow(/connectedAt/);
    expect(() =>
      validateSerializedState(validState({ connectedAt: Number.NaN }))
    ).toThrow(/connectedAt/);
  });

  it("rejects payloads that include sensitive credential fields", () => {
    expect(() =>
      validateSerializedState({
        ...validState(),
        secretKey: "S" + "A".repeat(55),
      })
    ).toThrow(/forbidden sensitive field/);
  });
});

describe("albedo_connector storage persistence", () => {
  let storage: MockStorage;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    storage = new MockStorage();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("saves and loads a valid session (reload restoration)", () => {
    const saved = saveAlbedoState(
      { address: ADDRESS_A, network: "testnet", connectedAt: 10 },
      { storage }
    );
    expect(saved).toBe(true);
    expect(storage.getItem(ALBEDO_STORAGE_KEY)).toBeTruthy();

    const restored = loadAlbedoState({ storage });
    expect(restored.restored).toBe(true);
    expect(restored.address).toBe(ADDRESS_A);
    expect(restored.network).toBe("testnet");
    expect(restored.connectedAt).toBe(10);
    expect(restored.parseError).toBeNull();
  });

  it("returns empty restored state when nothing is persisted", () => {
    const restored = loadAlbedoState({ storage });
    expect(restored).toEqual({
      restored: false,
      parseError: null,
      address: null,
      network: null,
      connectedAt: null,
    });
  });

  it("discards malformed JSON and clears the key", () => {
    storage.setItem(ALBEDO_STORAGE_KEY, "{corrupted");
    const restored = loadAlbedoState({ storage });
    expect(restored.restored).toBe(false);
    expect(restored.parseError).toMatch(/JSON|invalid/i);
    expect(storage.getItem(ALBEDO_STORAGE_KEY)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("discards invalid persisted state and clears the key", () => {
    storage.setItem(
      ALBEDO_STORAGE_KEY,
      JSON.stringify(validState({ address: "not-a-key" }))
    );
    const restored = loadAlbedoState({ storage });
    expect(restored.restored).toBe(false);
    expect(storage.getItem(ALBEDO_STORAGE_KEY)).toBeNull();
  });

  it("handles storage write failures without throwing", () => {
    storage.throwOnSet = true;
    expect(
      saveAlbedoState({ address: ADDRESS_A, network: "testnet" }, { storage })
    ).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("handles storage read failures without throwing", () => {
    storage.throwOnGet = true;
    const restored = loadAlbedoState({ storage });
    expect(restored.restored).toBe(false);
    expect(restored.parseError).toMatch(/read failed|storage/i);
  });

  it("handles unavailable storage (null adapter)", () => {
    expect(
      saveAlbedoState({ address: ADDRESS_A, network: "testnet" }, { storage: null })
    ).toBe(false);
    const restored = loadAlbedoState({ storage: null });
    expect(restored.restored).toBe(false);
    expect(restored.parseError).toMatch(/unavailable/i);
  });

  it("clears cached state on disconnect/logout", () => {
    saveAlbedoState(
      { address: ADDRESS_A, network: "mainnet", connectedAt: 1 },
      { storage }
    );
    expect(clearAlbedoState({ storage })).toBe(true);
    expect(storage.getItem(ALBEDO_STORAGE_KEY)).toBeNull();
    expect(loadAlbedoState({ storage }).restored).toBe(false);
  });

  it("returns false when clear fails due to storage errors", () => {
    storage.throwOnRemove = true;
    expect(clearAlbedoState({ storage })).toBe(false);
  });

  it("rejects save of invalid address without writing", () => {
    expect(
      saveAlbedoState({ address: "bad", network: "testnet" }, { storage })
    ).toBe(false);
    expect(storage.getItem(ALBEDO_STORAGE_KEY)).toBeNull();
  });
});

describe("AlbedoSessionManager reload restoration", () => {
  it("restores active session after a simulated page reload", () => {
    const shared = new MockStorage();
    const first = new AlbedoSessionManager(shared);
    expect(first.getState().restored).toBe(false);

    first.persist({
      address: ADDRESS_A,
      network: "testnet",
      connectedAt: 1234,
    });
    expect(first.getState().address).toBe(ADDRESS_A);

    // Simulate reload: new manager instance reading the same storage.
    const second = new AlbedoSessionManager(shared);
    const restored = second.getState();
    expect(restored.restored).toBe(true);
    expect(restored.address).toBe(ADDRESS_A);
    expect(restored.network).toBe("testnet");
    expect(restored.connectedAt).toBe(1234);
  });

  it("updates in-memory state when the active wallet address changes", () => {
    const storage = new MockStorage();
    const manager = new AlbedoSessionManager(storage);
    manager.persist({ address: ADDRESS_A, network: "testnet", connectedAt: 1 });
    manager.persist({ address: ADDRESS_B, network: "mainnet", connectedAt: 2 });

    expect(manager.getState().address).toBe(ADDRESS_B);
    expect(manager.getState().network).toBe("mainnet");

    const reloaded = manager.restore();
    expect(reloaded.address).toBe(ADDRESS_B);
  });

  it("clears both memory and storage on logout", () => {
    const storage = new MockStorage();
    const manager = new AlbedoSessionManager(storage);
    manager.persist({ address: ADDRESS_A, network: "testnet", connectedAt: 1 });
    manager.clear();

    expect(manager.getState().restored).toBe(false);
    expect(manager.getState().address).toBeNull();
    expect(storage.getItem(ALBEDO_STORAGE_KEY)).toBeNull();
  });

  it("returns a defensive copy from getState", () => {
    const storage = new MockStorage();
    const manager = new AlbedoSessionManager(storage);
    manager.persist({ address: ADDRESS_A, network: "testnet", connectedAt: 1 });
    const snapshot = manager.getState();
    snapshot.address = "MUTATED";
    expect(manager.getState().address).toBe(ADDRESS_A);
  });
});
