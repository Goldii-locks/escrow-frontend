/**
 * Tests for issue #247 — Secure persistent caching for active keys in
 * signature_timeout_alert.
 *
 * Validates that SignatureAlertActiveAddressStore correctly persists the active
 * signing address across simulated reload cycles using an in-memory Storage
 * stub, rejects corrupt / schema-mismatched payloads, and returns defensive
 * copies so callers cannot mutate stored state.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SignatureAlertActiveAddressStore,
  SIGNATURE_ALERT_STORAGE_KEY,
  SIGNATURE_ALERT_SCHEMA_VERSION,
  signatureAlertActiveAddress,
  type SignatureAlertActiveAddress,
} from "@/app/lib/signature_timeout_alert";

// ---------------------------------------------------------------------------
// In-memory Storage stub
// ---------------------------------------------------------------------------

function makeStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as Storage;
}

const SAMPLE_ADDRESS: SignatureAlertActiveAddress = {
  address: "GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12345678901234567890",
  network: "testnet",
  connectedAt: 1_700_000_000_000,
};

// ---------------------------------------------------------------------------
// SignatureAlertActiveAddressStore — basic set / get / clear
// ---------------------------------------------------------------------------

describe("SignatureAlertActiveAddressStore — set / get / clear (#247)", () => {
  it("returns null when nothing has been stored", () => {
    const store = new SignatureAlertActiveAddressStore(makeStorage());
    expect(store.getActiveAddress()).toBeNull();
  });

  it("stores and retrieves an active address", () => {
    const store = new SignatureAlertActiveAddressStore(makeStorage());
    store.setActiveAddress(SAMPLE_ADDRESS);
    expect(store.getActiveAddress()).toEqual(SAMPLE_ADDRESS);
  });

  it("returns a defensive copy — mutations do not affect stored state", () => {
    const store = new SignatureAlertActiveAddressStore(makeStorage());
    store.setActiveAddress(SAMPLE_ADDRESS);

    const copy = store.getActiveAddress()!;
    copy.address = "MUTATED";

    expect(store.getActiveAddress()!.address).toBe(SAMPLE_ADDRESS.address);
  });

  it("clear() removes the active address from memory and storage", () => {
    const storage = makeStorage();
    const store = new SignatureAlertActiveAddressStore(storage);
    store.setActiveAddress(SAMPLE_ADDRESS);
    store.clear();

    expect(store.getActiveAddress()).toBeNull();
    expect(storage.getItem(SIGNATURE_ALERT_STORAGE_KEY)).toBeNull();
  });

  it("setActiveAddress(null) clears the stored value", () => {
    const storage = makeStorage();
    const store = new SignatureAlertActiveAddressStore(storage);
    store.setActiveAddress(SAMPLE_ADDRESS);
    store.setActiveAddress(null);

    expect(store.getActiveAddress()).toBeNull();
    expect(storage.getItem(SIGNATURE_ALERT_STORAGE_KEY)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Persistence — data is written with the correct versioned schema
// ---------------------------------------------------------------------------

describe("SignatureAlertActiveAddressStore — persistence schema (#247)", () => {
  it("writes a versioned JSON payload to storage", () => {
    const storage = makeStorage();
    const store = new SignatureAlertActiveAddressStore(storage);
    store.setActiveAddress(SAMPLE_ADDRESS);

    const raw = storage.getItem(SIGNATURE_ALERT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as Record<string, unknown>;

    expect(parsed.version).toBe(SIGNATURE_ALERT_SCHEMA_VERSION);
    expect(parsed.address).toBe(SAMPLE_ADDRESS.address);
    expect(parsed.network).toBe(SAMPLE_ADDRESS.network);
    expect(parsed.connectedAt).toBe(SAMPLE_ADDRESS.connectedAt);
  });

  it("removes the storage key when setActiveAddress(null) is called", () => {
    const storage = makeStorage();
    const store = new SignatureAlertActiveAddressStore(storage);
    store.setActiveAddress(SAMPLE_ADDRESS);
    store.setActiveAddress(null);

    expect(storage.getItem(SIGNATURE_ALERT_STORAGE_KEY)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Rehydration — state survives a simulated reload cycle
// ---------------------------------------------------------------------------

describe("SignatureAlertActiveAddressStore — rehydration / reload cycle (#247)", () => {
  it("restores active address after a simulated reload (new store instance, same storage)", () => {
    const storage = makeStorage();

    // First "session": persist the address.
    const session1 = new SignatureAlertActiveAddressStore(storage);
    session1.setActiveAddress(SAMPLE_ADDRESS);

    // Second "session": new instance reads from the same storage.
    const session2 = new SignatureAlertActiveAddressStore(storage);
    expect(session2.getActiveAddress()).toEqual(SAMPLE_ADDRESS);
  });

  it("rehydrate() on an existing instance restores newly written data", () => {
    const storage = makeStorage();
    const store = new SignatureAlertActiveAddressStore(storage);

    // Write a payload directly into storage (simulating another tab / reload).
    const payload = {
      version: SIGNATURE_ALERT_SCHEMA_VERSION,
      ...SAMPLE_ADDRESS,
    };
    storage.setItem(SIGNATURE_ALERT_STORAGE_KEY, JSON.stringify(payload));

    store.rehydrate();
    expect(store.getActiveAddress()).toEqual(SAMPLE_ADDRESS);
  });

  it("returns null after a reload when storage is empty", () => {
    const storage = makeStorage();
    const store = new SignatureAlertActiveAddressStore(storage);
    store.rehydrate();
    expect(store.getActiveAddress()).toBeNull();
  });

  it("overrideStorage() re-reads state from the new backend", () => {
    const storage1 = makeStorage();
    const storage2 = makeStorage();

    const store = new SignatureAlertActiveAddressStore(storage1);

    // Write the address into the second storage.
    const payload = {
      version: SIGNATURE_ALERT_SCHEMA_VERSION,
      ...SAMPLE_ADDRESS,
    };
    storage2.setItem(SIGNATURE_ALERT_STORAGE_KEY, JSON.stringify(payload));

    store.overrideStorage(storage2);
    expect(store.getActiveAddress()).toEqual(SAMPLE_ADDRESS);
  });
});

// ---------------------------------------------------------------------------
// Rehydration — corrupt / mismatched payloads are discarded
// ---------------------------------------------------------------------------

describe("SignatureAlertActiveAddressStore — corrupt payload handling (#247)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("falls back to null and removes the corrupt entry on invalid JSON", () => {
    const storage = makeStorage();
    storage.setItem(SIGNATURE_ALERT_STORAGE_KEY, "not-valid-json{{{");
    const store = new SignatureAlertActiveAddressStore(storage);

    expect(store.getActiveAddress()).toBeNull();
    expect(storage.getItem(SIGNATURE_ALERT_STORAGE_KEY)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("falls back to null when the schema version does not match", () => {
    const storage = makeStorage();
    storage.setItem(
      SIGNATURE_ALERT_STORAGE_KEY,
      JSON.stringify({ version: 99, ...SAMPLE_ADDRESS })
    );
    const store = new SignatureAlertActiveAddressStore(storage);

    expect(store.getActiveAddress()).toBeNull();
    expect(storage.getItem(SIGNATURE_ALERT_STORAGE_KEY)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("falls back to null when the address field is missing", () => {
    const storage = makeStorage();
    storage.setItem(
      SIGNATURE_ALERT_STORAGE_KEY,
      JSON.stringify({
        version: SIGNATURE_ALERT_SCHEMA_VERSION,
        network: "testnet",
        connectedAt: 1_700_000_000_000,
      })
    );
    const store = new SignatureAlertActiveAddressStore(storage);

    expect(store.getActiveAddress()).toBeNull();
  });

  it("falls back to null when connectedAt is not a finite number", () => {
    const storage = makeStorage();
    storage.setItem(
      SIGNATURE_ALERT_STORAGE_KEY,
      JSON.stringify({
        version: SIGNATURE_ALERT_SCHEMA_VERSION,
        address: SAMPLE_ADDRESS.address,
        network: SAMPLE_ADDRESS.network,
        connectedAt: "not-a-number",
      })
    );
    const store = new SignatureAlertActiveAddressStore(storage);

    expect(store.getActiveAddress()).toBeNull();
  });

  it("falls back to null when the stored value is an array", () => {
    const storage = makeStorage();
    storage.setItem(SIGNATURE_ALERT_STORAGE_KEY, JSON.stringify([1, 2, 3]));
    const store = new SignatureAlertActiveAddressStore(storage);

    expect(store.getActiveAddress()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Storage unavailable (null adapter)
// ---------------------------------------------------------------------------

describe("SignatureAlertActiveAddressStore — null storage adapter (#247)", () => {
  it("operates purely in memory when no storage is available", () => {
    const store = new SignatureAlertActiveAddressStore(null);
    store.setActiveAddress(SAMPLE_ADDRESS);

    expect(store.getActiveAddress()).toEqual(SAMPLE_ADDRESS);
  });

  it("clear() is a no-op when no storage is available", () => {
    const store = new SignatureAlertActiveAddressStore(null);
    store.setActiveAddress(SAMPLE_ADDRESS);
    expect(() => store.clear()).not.toThrow();
    expect(store.getActiveAddress()).toBeNull();
  });

  it("rehydrate() is a no-op when no storage is available", () => {
    const store = new SignatureAlertActiveAddressStore(null);
    expect(() => store.rehydrate()).not.toThrow();
    expect(store.getActiveAddress()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

describe("signatureAlertActiveAddress singleton (#247)", () => {
  afterEach(() => {
    signatureAlertActiveAddress.overrideStorage(null);
  });

  it("is an instance of SignatureAlertActiveAddressStore", () => {
    expect(signatureAlertActiveAddress).toBeInstanceOf(
      SignatureAlertActiveAddressStore
    );
  });

  it("singleton state round-trips through overrideStorage / set / get / clear", () => {
    const storage = makeStorage();
    signatureAlertActiveAddress.overrideStorage(storage);

    signatureAlertActiveAddress.setActiveAddress(SAMPLE_ADDRESS);
    expect(signatureAlertActiveAddress.getActiveAddress()).toEqual(
      SAMPLE_ADDRESS
    );

    signatureAlertActiveAddress.clear();
    expect(signatureAlertActiveAddress.getActiveAddress()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("signature_timeout_alert persistence constants (#247)", () => {
  it("SIGNATURE_ALERT_STORAGE_KEY is a non-empty string", () => {
    expect(typeof SIGNATURE_ALERT_STORAGE_KEY).toBe("string");
    expect(SIGNATURE_ALERT_STORAGE_KEY.length).toBeGreaterThan(0);
  });

  it("SIGNATURE_ALERT_SCHEMA_VERSION is 1", () => {
    expect(SIGNATURE_ALERT_SCHEMA_VERSION).toBe(1);
  });
});
