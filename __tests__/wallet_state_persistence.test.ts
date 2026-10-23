import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WalletStateStore,
  walletStateStore,
  type WalletActiveState,
} from "@/app/lib/wallet_state_store";

const STORAGE_KEY = "wallet_state_store_active_state";

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

function makeState(overrides: Partial<WalletActiveState> = {}): WalletActiveState {
  return {
    address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    selectedWalletId: "freighter",
    networkPassphrase: "Test SDF Network ; September 2025",
    connectedAt: Date.now(),
    ...overrides,
  };
}

describe("WalletStateStore", () => {
  let storage: Storage;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let originalStorageRef: Storage | null;

  beforeEach(() => {
    storage = createMockStorage();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    originalStorageRef = null;
    walletStateStore.overrideStorage(storage);
    walletStateStore.clear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    walletStateStore.clear();
    walletStateStore.overrideStorage(originalStorageRef);
  });

  describe("initialization and rehydration", () => {
    it("initializes to null when storage is empty", () => {
      const store = new WalletStateStore(storage);
      expect(store.getActiveState()).toBeNull();
    });

    it("rehydrates persisted state correctly on reinitialization", () => {
      const storeA = new WalletStateStore(storage);
      const state = makeState();
      storeA.setActiveState(state);

      const storeB = new WalletStateStore(storage);
      const rehydrated = storeB.getActiveState();
      expect(rehydrated).toEqual(state);
    });

    it("rehydrates with selectedWalletId preserved", () => {
      const storeA = new WalletStateStore(storage);
      storeA.setActiveState(makeState({ selectedWalletId: "albedo" }));

      const storeB = new WalletStateStore(storage);
      const rehydrated = storeB.getActiveState();
      expect(rehydrated).not.toBeNull();
      expect(rehydrated!.selectedWalletId).toBe("albedo");
    });

    it("rehydrates with xbull wallet type", () => {
      const storeA = new WalletStateStore(storage);
      storeA.setActiveState(makeState({ selectedWalletId: "xbull" }));

      const storeB = new WalletStateStore(storage);
      const rehydrated = storeB.getActiveState();
      expect(rehydrated).not.toBeNull();
      expect(rehydrated!.selectedWalletId).toBe("xbull");
    });

    it("rehydrates with hana wallet type", () => {
      const storeA = new WalletStateStore(storage);
      storeA.setActiveState(makeState({ selectedWalletId: "hana" }));

      const storeB = new WalletStateStore(storage);
      const rehydrated = storeB.getActiveState();
      expect(rehydrated).not.toBeNull();
      expect(rehydrated!.selectedWalletId).toBe("hana");
    });
  });

  describe("serialization and validation", () => {
    it("serializes full state to storage when setActiveState is called", () => {
      const store = new WalletStateStore(storage);
      const state = makeState();
      store.setActiveState(state);

      const raw = storage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.address).toBe(state.address);
      expect(parsed.selectedWalletId).toBe(state.selectedWalletId);
      expect(parsed.networkPassphrase).toBe(state.networkPassphrase);
      expect(parsed.connectedAt).toBe(state.connectedAt);
      expect(parsed.version).toBe(1);
    });

    it("includes version field in serialized payload", () => {
      const store = new WalletStateStore(storage);
      store.setActiveState(makeState());

      const raw = storage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(raw!);
      expect(parsed).toHaveProperty("version", 1);
    });

    it("rejects payload with missing version field on rehydrate", () => {
      const payload = {
        address: "G...",
        selectedWalletId: "freighter",
        networkPassphrase: "testnet",
        connectedAt: Date.now(),
      };
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
      const store = new WalletStateStore(storage);
      expect(store.getActiveState()).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
    });

    it("rejects payload with wrong version on rehydrate", () => {
      const payload = {
        version: 99,
        address: "G...",
        selectedWalletId: "freighter",
        networkPassphrase: "testnet",
        connectedAt: Date.now(),
      };
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
      const store = new WalletStateStore(storage);
      expect(store.getActiveState()).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
    });

    it("rejects payload with empty address on rehydrate", () => {
      const payload = {
        version: 1,
        address: "",
        selectedWalletId: "freighter",
        networkPassphrase: "testnet",
        connectedAt: Date.now(),
      };
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
      const store = new WalletStateStore(storage);
      expect(store.getActiveState()).toBeNull();
    });

    it("rejects payload with empty selectedWalletId on rehydrate", () => {
      const payload = {
        version: 1,
        address: "G...",
        selectedWalletId: "",
        networkPassphrase: "testnet",
        connectedAt: Date.now(),
      };
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
      const store = new WalletStateStore(storage);
      expect(store.getActiveState()).toBeNull();
    });

    it("rejects payload with missing fields on rehydrate", () => {
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1 }));
      const store = new WalletStateStore(storage);
      expect(store.getActiveState()).toBeNull();
    });

    it("gracefully handles corrupted JSON on rehydrate", () => {
      storage.setItem(STORAGE_KEY, "{bad json");
      const store = new WalletStateStore(storage);
      expect(store.getActiveState()).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
    });

    it("gracefully handles non-object payloads on rehydrate", () => {
      storage.setItem(STORAGE_KEY, JSON.stringify("just a string"));
      const store = new WalletStateStore(storage);
      expect(store.getActiveState()).toBeNull();
    });

    it("removes corrupted data from storage on rehydrate failure", () => {
      storage.setItem(STORAGE_KEY, "{bad json");
      const store = new WalletStateStore(storage);
      expect(store.getActiveState()).toBeNull();
      expect(storage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe("state mutation", () => {
    it("clears active state when null is passed to setActiveState", () => {
      const store = new WalletStateStore(storage);
      store.setActiveState(makeState());
      expect(store.getActiveState()).not.toBeNull();

      store.setActiveState(null);
      expect(store.getActiveState()).toBeNull();
      expect(storage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("replaces existing state with new data", () => {
      const store = new WalletStateStore(storage);
      store.setActiveState(makeState({ address: "GOLD" }));

      store.setActiveState(makeState({ address: "GNEW" }));
      const result = store.getActiveState();
      expect(result).not.toBeNull();
      expect(result!.address).toBe("GNEW");
    });

    it("clears state when clear is called", () => {
      const store = new WalletStateStore(storage);
      store.setActiveState(makeState());
      expect(store.getActiveState()).not.toBeNull();

      store.clear();
      expect(store.getActiveState()).toBeNull();
      expect(storage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("overriding with null clears both memory and storage", () => {
      const store = new WalletStateStore(storage);
      store.setActiveState(makeState());
      store.setActiveState(null);

      expect(store.getActiveState()).toBeNull();
      expect(storage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe("defensive copying", () => {
    it("returns a copy from getActiveState to prevent external mutation", () => {
      const store = new WalletStateStore(storage);
      const original = makeState({ address: "GCOPYTEST" });
      store.setActiveState(original);

      const copy1 = store.getActiveState();
      expect(copy1).not.toBeNull();
      copy1!.address = "GMUTATED";

      const copy2 = store.getActiveState();
      expect(copy2!.address).toBe("GCOPYTEST");
    });

    it("original input object mutation does not affect internal state", () => {
      const store = new WalletStateStore(storage);
      const input = makeState();
      store.setActiveState(input);

      input.address = "GHACKED";
      input.selectedWalletId = "albedo";

      const stored = store.getActiveState();
      expect(stored!.address).not.toBe("GHACKED");
      expect(stored!.selectedWalletId).toBe("freighter");
    });
  });

  describe("input sanitization", () => {
    it("sanitizes state with non-finite connectedAt", () => {
      const store = new WalletStateStore(storage);
      store.setActiveState(makeState({ connectedAt: NaN }));
      expect(store.getActiveState()).toBeNull();
    });

    it("sanitizes state with Infinity connectedAt", () => {
      const store = new WalletStateStore(storage);
      store.setActiveState(makeState({ connectedAt: Infinity }));
      expect(store.getActiveState()).toBeNull();
    });

    it("sanitizes state with negative connectedAt", () => {
      const store = new WalletStateStore(storage);
      store.setActiveState(makeState({ connectedAt: -1 }));
      expect(store.getActiveState()).not.toBeNull();
      expect(store.getActiveState()!.connectedAt).toBe(-1);
    });

    it("only stores public fields, filtering unknown extra properties", () => {
      const store = new WalletStateStore(storage);
      const withExtra = makeState() as WalletActiveState & {
        privateKey?: string;
        seed?: string;
      };
      withExtra.privateKey = "S...";
      withExtra.seed = "supersecret";

      store.setActiveState(withExtra);
      const result = store.getActiveState();
      expect(result).not.toBeNull();
      expect(result!.address).toBe(withExtra.address);
      const bag = result as unknown as Record<string, unknown>;
      expect("privateKey" in bag).toBe(false);
      expect("seed" in bag).toBe(false);
    });
  });

  describe("rehydrate", () => {
    it("throws a warning and returns null for schema version 0 (no version field)", () => {
      const unversioned = {
        address: "G...",
        selectedWalletId: "freighter",
        networkPassphrase: "testnet",
        connectedAt: Date.now(),
      };
      storage.setItem(STORAGE_KEY, JSON.stringify(unversioned));
      const store = new WalletStateStore(storage);
      expect(store.getActiveState()).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("REHYDRATE SCHEMA MISMATCH"),
        expect.any(String)
      );
    });

    it("restores valid state after clear and set cycle", () => {
      const store = new WalletStateStore(storage);
      store.setActiveState(makeState());
      store.clear();
      expect(store.getActiveState()).toBeNull();

      store.setActiveState(makeState({ address: "GAFTERCLEAR" }));
      expect(store.getActiveState()).not.toBeNull();
      expect(store.getActiveState()!.address).toBe("GAFTERCLEAR");
    });

    it("persists to same storage key across store instances", () => {
      const storeA = new WalletStateStore(storage);
      storeA.setActiveState(makeState({ address: "GINSTANCEA" }));

      const storeB = new WalletStateStore(storage);
      expect(storeB.getActiveState()!.address).toBe("GINSTANCEA");
    });
  });

  describe("storage adapter", () => {
    it("uses provided storage mock when passed as argument", () => {
      const mockStore = createMockStorage();
      const store = new WalletStateStore(mockStore);
      expect(store.getActiveState()).toBeNull();

      store.setActiveState(makeState({ address: "GMOCK" }));
      expect(store.getActiveState()!.address).toBe("GMOCK");
      expect(mockStore.getItem(STORAGE_KEY)).not.toBeNull();
    });

    it("overrideStorage swaps backend and rehydrates", () => {
      const store = new WalletStateStore(storage);
      store.setActiveState(makeState({ address: "GORIG" }));

      const newStorage = createMockStorage();
      store.overrideStorage(newStorage);
      expect(store.getActiveState()).toBeNull();

      store.setActiveState(makeState({ address: "GNEWSTORAGE" }));
      expect(store.getActiveState()!.address).toBe("GNEWSTORAGE");
      expect(storage.getItem(STORAGE_KEY)).not.toBeNull();
      expect(newStorage.getItem(STORAGE_KEY)).not.toBeNull();
    });

    it("works with null storage (server-side)", () => {
      const store = new WalletStateStore(null);
      expect(store.getActiveState()).toBeNull();

      store.setActiveState(makeState());
      expect(store.getActiveState()).not.toBeNull();
      expect(store.getActiveState()!.address).toBe(makeState().address);
    });
  });

  describe("overrideStorage", () => {
    it("rehydrates from the new storage backend immediately", () => {
      const store = new WalletStateStore(storage);
      store.setActiveState(makeState({ address: "GOLD" }));

      const secondStorage = createMockStorage();
      secondStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          address: "GNEWBACKEND",
          selectedWalletId: "xbull",
          networkPassphrase: "testnet",
          connectedAt: Date.now(),
        })
      );

      store.overrideStorage(secondStorage);
      expect(store.getActiveState()!.address).toBe("GNEWBACKEND");
      expect(store.getActiveState()!.selectedWalletId).toBe("xbull");
    });
  });

  describe("setActiveState validation", () => {
    it("rejects state with empty address", () => {
      const store = new WalletStateStore(storage);
      store.setActiveState(makeState({ address: "" }));
      expect(store.getActiveState()).toBeNull();
    });

    it("rejects state with empty selectedWalletId", () => {
      const store = new WalletStateStore(storage);
      store.setActiveState(makeState({ selectedWalletId: "" }));
      expect(store.getActiveState()).toBeNull();
    });

    it("rejects state with non-string address", () => {
      const store = new WalletStateStore(storage);
      store.setActiveState({
        ...makeState(),
        address: 123,
      } as unknown as WalletActiveState);
      expect(store.getActiveState()).toBeNull();
    });

    it("rejects state with non-finite connectedAt", () => {
      const store = new WalletStateStore(storage);
      store.setActiveState(makeState({ connectedAt: NaN }));
      expect(store.getActiveState()).toBeNull();
    });

    it("rejects state with non-number connectedAt", () => {
      const store = new WalletStateStore(storage);
      store.setActiveState({
        ...makeState(),
        connectedAt: "yesterday",
      } as unknown as WalletActiveState);
      expect(store.getActiveState()).toBeNull();
    });
  });
});

describe("walletStateStore singleton", () => {
  let storage: Storage;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    storage = createMockStorage();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    walletStateStore.overrideStorage(storage);
    walletStateStore.clear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    walletStateStore.clear();
    walletStateStore.overrideStorage(null);
  });

  it("is a singleton instance of WalletStateStore", () => {
    expect(walletStateStore).toBeInstanceOf(WalletStateStore);
  });

  it("survives a simulate-reload cycle via fresh singleton access", () => {
    const state = makeState({ address: "GRELOAD" });
    walletStateStore.setActiveState(state);

    const rehydrated = walletStateStore.getActiveState();
    expect(rehydrated).not.toBeNull();
    expect(rehydrated!.address).toBe("GRELOAD");
  });

  it("persists state that can be read by a new WalletStateStore instance", () => {
    walletStateStore.setActiveState(makeState({ address: "GINSTANCE" }));

    const freshStore = new WalletStateStore(storage);
    expect(freshStore.getActiveState()!.address).toBe("GINSTANCE");
  });
});
