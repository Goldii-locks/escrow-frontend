import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FREIGHTER_STORAGE_KEY,
  FREIGHTER_STORAGE_VERSION,
  clearWalletState,
  deserializeWalletState,
  serializeWalletState,
  validatePersistedState,
  type PersistedWalletState,
} from "@/app/lib/walletPersistence";

function makeValidState(overrides: Partial<PersistedWalletState> = {}): PersistedWalletState {
  return {
    version: FREIGHTER_STORAGE_VERSION,
    address: "GABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABCD",
    network: "testnet",
    connectedAt: Date.now(),
    ...overrides,
  };
}

function omitKey<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const copy = { ...(obj as Record<string, unknown>) };
  delete copy[key as string];
  return copy as Omit<T, K>;
}

describe("validatePersistedState", () => {
  it("accepts a well-formed V1 state object", () => {
    expect(validatePersistedState(makeValidState())).toBe(true);
  });

  it("accepts mainnet network", () => {
    expect(validatePersistedState(makeValidState({ network: "mainnet" }))).toBe(true);
  });

  it("rejects a non-object", () => {
    expect(validatePersistedState(null)).toBe(false);
    expect(validatePersistedState(undefined)).toBe(false);
    expect(validatePersistedState("string")).toBe(false);
    expect(validatePersistedState(42)).toBe(false);
    expect(validatePersistedState([])).toBe(false);
  });

  it("rejects wrong or missing version", () => {
    expect(validatePersistedState({ ...makeValidState(), version: 0 })).toBe(false);
    expect(validatePersistedState({ ...makeValidState(), version: 999 })).toBe(false);
    expect(validatePersistedState(omitKey(makeValidState(), "version"))).toBe(false);
  });

  it("rejects missing or empty address", () => {
    expect(validatePersistedState({ ...makeValidState(), address: "" })).toBe(false);
    expect(validatePersistedState(omitKey(makeValidState(), "address"))).toBe(false);
    expect(validatePersistedState({ ...makeValidState(), address: null as unknown as string })).toBe(
      false,
    );
    expect(validatePersistedState({ ...makeValidState(), address: 123 as unknown as string })).toBe(
      false,
    );
  });

  it("rejects invalid network", () => {
    expect(
      validatePersistedState({ ...makeValidState(), network: "invalid" as unknown as "testnet" }),
    ).toBe(false);
    expect(validatePersistedState(omitKey(makeValidState(), "network"))).toBe(false);
  });

  it("rejects invalid connectedAt", () => {
    expect(validatePersistedState({ ...makeValidState(), connectedAt: Number.NaN })).toBe(false);
    expect(
      validatePersistedState({ ...makeValidState(), connectedAt: "now" as unknown as number }),
    ).toBe(false);
    expect(validatePersistedState(omitKey(makeValidState(), "connectedAt"))).toBe(false);
  });
});

describe("serializeWalletState", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it("writes a valid V1 JSON payload to localStorage", () => {
    const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    serializeWalletState(address, "testnet");

    const raw = window.localStorage.getItem(FREIGHTER_STORAGE_KEY);
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw!);
    expect(parsed).toEqual({
      version: FREIGHTER_STORAGE_VERSION,
      address,
      network: "testnet",
      connectedAt: new Date("2025-01-15T12:00:00Z").getTime(),
    });
  });

  it("defaults network to testnet", () => {
    const address = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
    serializeWalletState(address);

    const parsed = JSON.parse(window.localStorage.getItem(FREIGHTER_STORAGE_KEY)!);
    expect(parsed.network).toBe("testnet");
  });

  it("does not throw when localStorage is unavailable", () => {
    const getItemSpy = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    expect(() => serializeWalletState("GABC")).not.toThrow();
    getItemSpy.mockRestore();
  });
});

describe("deserializeWalletState", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns null when no stored data exists", () => {
    expect(deserializeWalletState()).toBeNull();
  });

  it("restores a valid persisted state", () => {
    const state = makeValidState({
      address: "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      network: "mainnet",
      connectedAt: 1_700_000_000_000,
    });
    window.localStorage.setItem(FREIGHTER_STORAGE_KEY, JSON.stringify(state));

    const restored = deserializeWalletState();
    expect(restored).toEqual(state);
  });

  it("returns null and clears storage for malformed JSON", () => {
    window.localStorage.setItem(FREIGHTER_STORAGE_KEY, "{not valid json");

    const restored = deserializeWalletState();
    expect(restored).toBeNull();
    expect(window.localStorage.getItem(FREIGHTER_STORAGE_KEY)).toBeNull();
  });

  it("returns null and clears storage for schema-invalid payload", () => {
    window.localStorage.setItem(
      FREIGHTER_STORAGE_KEY,
      JSON.stringify({ version: 99, address: "", network: "bad", connectedAt: "oops" }),
    );

    const restored = deserializeWalletState();
    expect(restored).toBeNull();
    expect(window.localStorage.getItem(FREIGHTER_STORAGE_KEY)).toBeNull();
  });

  it("does not throw when localStorage.getItem fails", () => {
    const getItemSpy = vi
      .spyOn(window.localStorage, "getItem")
      .mockImplementation(() => {
        throw new Error("SecurityError");
      });

    expect(() => deserializeWalletState()).not.toThrow();
    expect(deserializeWalletState()).toBeNull();
    getItemSpy.mockRestore();
  });
});

describe("clearWalletState", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("removes the stored wallet entry", () => {
    serializeWalletState("GABC", "testnet");
    expect(window.localStorage.getItem(FREIGHTER_STORAGE_KEY)).not.toBeNull();

    clearWalletState();
    expect(window.localStorage.getItem(FREIGHTER_STORAGE_KEY)).toBeNull();
  });

  it("is a no-op when no entry exists", () => {
    expect(() => clearWalletState()).not.toThrow();
    expect(window.localStorage.getItem(FREIGHTER_STORAGE_KEY)).toBeNull();
  });

  it("does not throw when localStorage.removeItem fails", () => {
    const removeItemSpy = vi
      .spyOn(window.localStorage, "removeItem")
      .mockImplementation(() => {
        throw new Error("SecurityError");
      });

    expect(() => clearWalletState()).not.toThrow();
    removeItemSpy.mockRestore();
  });
});
