import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WalletSelectorStore,
  walletSelectorStore,
  type WalletCachedKey,
} from "@/app/lib/wallet_selector_modal";

const STORAGE_KEY = "wallet_selector_modal_active_key";

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

function makeKey(overrides: Partial<WalletCachedKey> = {}): WalletCachedKey {
  return {
    walletId: "freighter",
    address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    networkPassphrase: "Test SDF Network ; September 2015",
    connectedAt: Date.now(),
    ...overrides,
  };
}

describe("WalletSelectorStore (#task-2) — initialization and rehydration", () => {
  let storage: Storage;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let originalStorageRef: Storage | null;

  beforeEach(() => {
    storage = createMockStorage();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    originalStorageRef = null;
    walletSelectorStore.overrideStorage(storage);
    walletSelectorStore.clear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    walletSelectorStore.clear();
    walletSelectorStore.overrideStorage(originalStorageRef);
  });

  it("initializes to null when storage is empty", () => {
    const store = new WalletSelectorStore(storage);
    expect(store.getCachedKey()).toBeNull();
  });

  it("rehydrates persisted state correctly on reinitialization", () => {
    const storeA = new WalletSelectorStore(storage);
    const key = makeKey();
    storeA.setCachedKey(key);

    const storeB = new WalletSelectorStore(storage);
    const rehydrated = storeB.getCachedKey();
    expect(rehydrated).toEqual(key);
  });

  it("rehydrates with walletId preserved for albedo", () => {
    const storeA = new WalletSelectorStore(storage);
    storeA.setCachedKey(makeKey({ walletId: "albedo" }));

    const storeB = new WalletSelectorStore(storage);
    const rehydrated = storeB.getCachedKey();
    expect(rehydrated).not.toBeNull();
    expect(rehydrated!.walletId).toBe("albedo");
  });

  it("rehydrates with xbull wallet type", () => {
    const storeA = new WalletSelectorStore(storage);
    storeA.setCachedKey(makeKey({ walletId: "xbull" }));

    const storeB = new WalletSelectorStore(storage);
    expect(storeB.getCachedKey()!.walletId).toBe("xbull");
  });

  it("rehydrates with hana wallet type", () => {
    const storeA = new WalletSelectorStore(storage);
    storeA.setCachedKey(makeKey({ walletId: "hana" }));

    const storeB = new WalletSelectorStore(storage);
    expect(storeB.getCachedKey()!.walletId).toBe("hana");
  });
});

describe("WalletSelectorStore (#task-2) — serialization and validation", () => {
  let storage: Storage;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let originalStorageRef: Storage | null;

  beforeEach(() => {
    storage = createMockStorage();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    originalStorageRef = null;
    walletSelectorStore.overrideStorage(storage);
    walletSelectorStore.clear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    walletSelectorStore.clear();
    walletSelectorStore.overrideStorage(originalStorageRef);
  });

  it("serializes full state to storage when setCachedKey is called", () => {
    const store = new WalletSelectorStore(storage);
    const key = makeKey();
    store.setCachedKey(key);

    const raw = storage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.address).toBe(key.address);
    expect(parsed.walletId).toBe(key.walletId);
    expect(parsed.networkPassphrase).toBe(key.networkPassphrase);
    expect(parsed.connectedAt).toBe(key.connectedAt);
    expect(parsed.version).toBe(1);
  });

  it("includes version field in serialized payload", () => {
    const store = new WalletSelectorStore(storage);
    store.setCachedKey(makeKey());

    const raw = storage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveProperty("version", 1);
  });

  it("rejects payload with missing version field on rehydrate", () => {
    const payload = {
      walletId: "freighter",
      address: "G...",
      networkPassphrase: "testnet",
      connectedAt: Date.now(),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    const store = new WalletSelectorStore(storage);
    expect(store.getCachedKey()).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("rejects payload with wrong version on rehydrate", () => {
    const payload = {
      version: 99,
      walletId: "freighter",
      address: "G...",
      networkPassphrase: "testnet",
      connectedAt: Date.now(),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    const store = new WalletSelectorStore(storage);
    expect(store.getCachedKey()).toBeNull();
  });

  it("rejects payload with empty address on rehydrate", () => {
    const payload = {
      version: 1,
      walletId: "freighter",
      address: "",
      networkPassphrase: "testnet",
      connectedAt: Date.now(),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    const store = new WalletSelectorStore(storage);
    expect(store.getCachedKey()).toBeNull();
  });

  it("rejects payload with empty walletId on rehydrate", () => {
    const payload = {
      version: 1,
      walletId: "",
      address: "G...",
      networkPassphrase: "testnet",
      connectedAt: Date.now(),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    const store = new WalletSelectorStore(storage);
    expect(store.getCachedKey()).toBeNull();
  });

  it("rejects payload with missing fields on rehydrate", () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1 }));
    const store = new WalletSelectorStore(storage);
    expect(store.getCachedKey()).toBeNull();
  });

  it("gracefully handles corrupted JSON on rehydrate", () => {
    storage.setItem(STORAGE_KEY, "{bad json");
    const store = new WalletSelectorStore(storage);
    expect(store.getCachedKey()).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("gracefully handles non-object payloads on rehydrate", () => {
    storage.setItem(STORAGE_KEY, JSON.stringify("just a string"));
    const store = new WalletSelectorStore(storage);
    expect(store.getCachedKey()).toBeNull();
  });

  it("removes corrupted data from storage on rehydrate failure", () => {
    storage.setItem(STORAGE_KEY, "{bad json");
    const store = new WalletSelectorStore(storage);
    expect(store.getCachedKey()).toBeNull();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("WalletSelectorStore (#task-2) — state mutation", () => {
  let storage: Storage;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let originalStorageRef: Storage | null;

  beforeEach(() => {
    storage = createMockStorage();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    originalStorageRef = null;
    walletSelectorStore.overrideStorage(storage);
    walletSelectorStore.clear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    walletSelectorStore.clear();
    walletSelectorStore.overrideStorage(originalStorageRef);
  });

  it("clears cached key when null is passed to setCachedKey", () => {
    const store = new WalletSelectorStore(storage);
    store.setCachedKey(makeKey());
    expect(store.getCachedKey()).not.toBeNull();

    store.setCachedKey(null);
    expect(store.getCachedKey()).toBeNull();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("replaces existing key with new data", () => {
    const store = new WalletSelectorStore(storage);
    store.setCachedKey(makeKey({ address: "GOLD" }));

    store.setCachedKey(makeKey({ address: "GNEW" }));
    expect(store.getCachedKey()!.address).toBe("GNEW");
  });

  it("clears key when clear is called", () => {
    const store = new WalletSelectorStore(storage);
    store.setCachedKey(makeKey());
    expect(store.getCachedKey()).not.toBeNull();

    store.clear();
    expect(store.getCachedKey()).toBeNull();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("overriding with null clears both memory and storage", () => {
    const store = new WalletSelectorStore(storage);
    store.setCachedKey(makeKey());
    store.setCachedKey(null);

    expect(store.getCachedKey()).toBeNull();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("WalletSelectorStore (#task-2) — defensive copying", () => {
  let storage: Storage;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let originalStorageRef: Storage | null;

  beforeEach(() => {
    storage = createMockStorage();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    originalStorageRef = null;
    walletSelectorStore.overrideStorage(storage);
    walletSelectorStore.clear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    walletSelectorStore.clear();
    walletSelectorStore.overrideStorage(originalStorageRef);
  });

  it("returns a copy from getCachedKey to prevent external mutation", () => {
    const store = new WalletSelectorStore(storage);
    const original = makeKey({ address: "GCOPYTEST" });
    store.setCachedKey(original);

    const copy1 = store.getCachedKey();
    expect(copy1).not.toBeNull();
    copy1!.address = "GMUTATED";

    const copy2 = store.getCachedKey();
    expect(copy2!.address).toBe("GCOPYTEST");
  });

  it("original input object mutation does not affect internal state", () => {
    const store = new WalletSelectorStore(storage);
    const input = makeKey();
    store.setCachedKey(input);

    input.address = "GHACKED";
    input.walletId = "albedo";

    expect(store.getCachedKey()!.address).not.toBe("GHACKED");
    expect(store.getCachedKey()!.walletId).toBe("freighter");
  });
});

describe("WalletSelectorStore (#task-2) — input sanitization", () => {
  let storage: Storage;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let originalStorageRef: Storage | null;

  beforeEach(() => {
    storage = createMockStorage();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    originalStorageRef = null;
    walletSelectorStore.overrideStorage(storage);
    walletSelectorStore.clear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    walletSelectorStore.clear();
    walletSelectorStore.overrideStorage(originalStorageRef);
  });

  it("rejects key with non-finite connectedAt", () => {
    const store = new WalletSelectorStore(storage);
    store.setCachedKey(makeKey({ connectedAt: NaN }));
    expect(store.getCachedKey()).toBeNull();
  });

  it("rejects key with Infinity connectedAt", () => {
    const store = new WalletSelectorStore(storage);
    store.setCachedKey(makeKey({ connectedAt: Infinity }));
    expect(store.getCachedKey()).toBeNull();
  });

  it("only stores public fields, filtering unknown extra properties", () => {
    const store = new WalletSelectorStore(storage);
    const withExtra = makeKey() as WalletCachedKey & {
      privateKey?: string;
      seed?: string;
    };
    withExtra.privateKey = "S...";
    withExtra.seed = "supersecret";

    store.setCachedKey(withExtra);
    const result = store.getCachedKey();
    expect(result).not.toBeNull();
    const bag = result as unknown as Record<string, unknown>;
    expect("privateKey" in bag).toBe(false);
    expect("seed" in bag).toBe(false);
  });
});

describe("WalletSelectorStore (#task-2) — storage adapter", () => {
  let storage: Storage;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let originalStorageRef: Storage | null;

  beforeEach(() => {
    storage = createMockStorage();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    originalStorageRef = null;
    walletSelectorStore.overrideStorage(storage);
    walletSelectorStore.clear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    walletSelectorStore.clear();
    walletSelectorStore.overrideStorage(originalStorageRef);
  });

  it("uses provided storage mock when passed as argument", () => {
    const mockStore = createMockStorage();
    const store = new WalletSelectorStore(mockStore);
    expect(store.getCachedKey()).toBeNull();

    store.setCachedKey(makeKey({ address: "GMOCK" }));
    expect(store.getCachedKey()!.address).toBe("GMOCK");
    expect(mockStore.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("overrideStorage swaps backend and rehydrates", () => {
    const store = new WalletSelectorStore(storage);
    store.setCachedKey(makeKey({ address: "GORIG" }));

    const newStorage = createMockStorage();
    store.overrideStorage(newStorage);
    expect(store.getCachedKey()).toBeNull();

    store.setCachedKey(makeKey({ address: "GNEWSTORAGE" }));
    expect(store.getCachedKey()!.address).toBe("GNEWSTORAGE");
  });

  it("works with null storage (server-side)", () => {
    const store = new WalletSelectorStore(null);
    expect(store.getCachedKey()).toBeNull();

    store.setCachedKey(makeKey());
    expect(store.getCachedKey()).not.toBeNull();
  });
});

describe("walletSelectorStore singleton (#task-2)", () => {
  let storage: Storage;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    storage = createMockStorage();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    walletSelectorStore.overrideStorage(storage);
    walletSelectorStore.clear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    walletSelectorStore.clear();
    walletSelectorStore.overrideStorage(null);
  });

  it("is a singleton instance of WalletSelectorStore", () => {
    expect(walletSelectorStore).toBeInstanceOf(WalletSelectorStore);
  });

  it("survives a simulate-reload cycle via fresh singleton access", () => {
    const key = makeKey({ address: "GRELOAD" });
    walletSelectorStore.setCachedKey(key);

    const rehydrated = walletSelectorStore.getCachedKey();
    expect(rehydrated).not.toBeNull();
    expect(rehydrated!.address).toBe("GRELOAD");
  });

  it("persists state that can be read by a new WalletSelectorStore instance", () => {
    walletSelectorStore.setCachedKey(makeKey({ address: "GINSTANCE" }));

    const freshStore = new WalletSelectorStore(storage);
    expect(freshStore.getCachedKey()!.address).toBe("GINSTANCE");
  });
});
