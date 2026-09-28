import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkRabeNetworkMatch,
  clearRabeAddressCache,
  deserializeRabeAddressCache,
  formatConsoleWarningBlock,
  formatStackTrace,
  loadRabeAddressCache,
  logRabeWarning,
  RABE_CACHE_KEY,
  RabeActiveAddressCache,
  RabeNetworkMismatchError,
  RabeTransactionTracker,
  rabeTracker,
  saveRabeAddressCache,
  serializeRabeAddressCache,
  validateRabeAddressCache,
  warnOnRabeNetworkMismatch,
} from "@/app/lib/rabe_connector";

describe("rabe_connector formatStackTrace edge cases", () => {
  it("returns a string error as-is when it already contains a stack-like format", () => {
    const multiline = "Error: boom\n    at foo (file.ts:1:1)";
    expect(formatStackTrace(multiline)).toBe(multiline);
  });

  it("synthesizes a stack using a plain string message with no newline", () => {
    const stack = formatStackTrace("sign rejected");
    expect(stack).toContain("Error: sign rejected");
    expect(stack.split("\n").length).toBeGreaterThan(1);
  });

  it("synthesizes a default stack when an Error instance has no stack property", () => {
    const err = new Error("no stack here");
    Object.defineProperty(err, "stack", { value: undefined });

    const stack = formatStackTrace(err);
    expect(stack).toContain("Error: Rabe connector trace");
  });
});

describe("rabe_connector formatConsoleWarningBlock edge cases", () => {
  it("truncates titles longer than the padded column width", () => {
    const longTitle = "A".repeat(50);
    const block = formatConsoleWarningBlock({
      title: longTitle,
      body: "body text",
      stack: "Error: stack",
    });

    const titleLine = block.split("\n")[1];
    expect(titleLine).toContain("A".repeat(36));
    expect(titleLine).not.toContain("A".repeat(37));
  });

  it("omits txId and phase lines when they are not provided", () => {
    const block = formatConsoleWarningBlock({
      title: "NO EXTRAS",
      body: "just body and stack",
      stack: "Error: stack",
    });

    expect(block).not.toContain("txId:");
    expect(block).not.toContain("phase:");
  });
});

describe("rabe_connector logRabeWarning without options", () => {
  it("logs a warning block using only title and body", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const formatted = logRabeWarning("PLAIN WARNING", "no extra context");

    expect(warnSpy).toHaveBeenCalledWith(formatted);
    expect(formatted).toContain("PLAIN WARNING");
    expect(formatted).toContain("no extra context");
    expect(formatted).not.toContain("txId:");
    expect(formatted).not.toContain("phase:");

    warnSpy.mockRestore();
  });
});

describe("rabe_connector shared rabeTracker singleton", () => {
  beforeEach(() => {
    rabeTracker.clear();
  });

  it("tracks entries independently of ad-hoc tracker instances", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    rabeTracker.track("tx-shared", "submitting", "Broadcasting to network");

    expect(rabeTracker.getHistory("tx-shared")).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });
});

describe("rabe_connector console warning blocks", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    rabeTracker.clear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("formats stack traces from Error instances", () => {
    const err = new Error("sign failed");
    const stack = formatStackTrace(err);

    expect(stack).toContain("Error: sign failed");
    expect(stack).toMatch(/at /);
  });

  it("synthesizes a stack when no Error is provided", () => {
    const stack = formatStackTrace();
    expect(stack).toContain("Error:");
    expect(stack.split("\n").length).toBeGreaterThan(1);
  });

  it("builds a console warning block that includes the stack trace format", () => {
    const stack = formatStackTrace(new Error("tx debug"));
    const block = formatConsoleWarningBlock({
      title: "TX SIGNING",
      body: "Awaiting wallet signature",
      stack,
      txId: "tx-abc",
      phase: "signing",
    });

    expect(block).toContain("[rabe_connector]");
    expect(block).toContain("TX SIGNING");
    expect(block).toContain("Awaiting wallet signature");
    expect(block).toContain("txId: tx-abc");
    expect(block).toContain("phase: signing");
    expect(block).toContain("--- stack trace ---");
    expect(block).toContain("--- end stack ---");
    expect(block).toContain("Error: tx debug");
  });

  it("logs formatted warning blocks (with stack) via console.warn", () => {
    const formatted = logRabeWarning("TX ERROR", "Submission failed", {
      err: new Error("network down"),
      txId: "tx-1",
      phase: "error",
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(formatted);
    expect(formatted).toMatch(/--- stack trace ---[\s\S]*Error: network down/);
  });

  it("tracks transaction phases and logs a warning block per phase", () => {
    const tracker = new RabeTransactionTracker();

    tracker.track("tx-42", "building", "Preparing XDR");
    tracker.track("tx-42", "signing", "Prompting Rabe wallet");
    tracker.track(
      "tx-42",
      "error",
      "Wallet returned failure",
      new Error("device busy")
    );

    const history = tracker.getHistory("tx-42");
    expect(history).toHaveLength(3);
    expect(history.map((e) => e.phase)).toEqual([
      "building",
      "signing",
      "error",
    ]);
    expect(history[2].stack).toContain("Error: device busy");
    expect(warnSpy).toHaveBeenCalledTimes(3);

    const lastCall = String(warnSpy.mock.calls[2][0]);
    expect(lastCall).toContain("TX ERROR");
    expect(lastCall).toContain("--- stack trace ---");
  });

  it("isolates history by txId and clears tracking state", () => {
    const tracker = new RabeTransactionTracker();
    tracker.track("a", "idle", "start");
    tracker.track("b", "success", "done");

    expect(tracker.getHistory("a")).toHaveLength(1);
    expect(tracker.getHistory()).toHaveLength(2);

    tracker.clear();
    expect(tracker.getHistory()).toHaveLength(0);
  });
});

describe("rabe_connector network mismatch checks", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("reports no mismatch when networks align", () => {
    const state = checkRabeNetworkMatch("testnet", "testnet");
    expect(state.mismatched).toBe(false);
    expect(state.warningMessage).toBeNull();
  });

  it("builds a warning message when Mainnet vs Testnet diverge", () => {
    const state = checkRabeNetworkMatch("mainnet", "testnet");
    expect(state.mismatched).toBe(true);
    expect(state.walletNetwork).toBe("mainnet");
    expect(state.appNetwork).toBe("testnet");
    expect(state.warningMessage).toMatch(/Network mismatch/i);
    expect(state.warningMessage).toMatch(/Mainnet/);
    expect(state.warningMessage).toMatch(/Testnet/);
  });

  it("builds the inverse warning (testnet wallet on mainnet app)", () => {
    const state = checkRabeNetworkMatch("testnet", "mainnet");
    expect(state.mismatched).toBe(true);
    expect(state.warningMessage).toMatch(/Testnet/);
    expect(state.warningMessage).toMatch(/Mainnet/);
  });

  it("carries wallet and app networks on the mismatch error", () => {
    const err = new RabeNetworkMismatchError("mainnet", "testnet");
    expect(err.name).toBe("RabeNetworkMismatchError");
    expect(err.walletNetwork).toBe("mainnet");
    expect(err.appNetwork).toBe("testnet");
    expect(err.message).toMatch(/Network mismatch/i);
  });

  it("logs a formatted warning block on mismatch", () => {
    const state = warnOnRabeNetworkMismatch("mainnet", "testnet");

    expect(state.mismatched).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[rabe_connector]");
    expect(logged).toContain("NETWORK MISMATCH");
    expect(logged).toContain("--- stack trace ---");
    expect(logged).toContain("RabeNetworkMismatchError");
  });

  it("does not log when networks match", () => {
    const state = warnOnRabeNetworkMismatch("testnet", "testnet");
    expect(state.mismatched).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Persistent address-cache tests
// ---------------------------------------------------------------------------

/** A valid Stellar public key (56 chars, starts with G, Base32 A-Z2-7). */
const VALID_ADDRESS = "GD4TI4BA2F6L3UE2SFNFEM5DBGIP2MYH7ID2KHDI2HF3YEEGCFB2OOAI";
const VALID_NETWORK = "testnet" as const;

function makeCache(
  overrides: Partial<RabeActiveAddressCache> = {}
): RabeActiveAddressCache {
  return {
    version: 1,
    address: VALID_ADDRESS,
    savedAt: Date.now(),
    network: VALID_NETWORK,
    ...overrides,
  };
}

describe("rabe_connector active-address cache — validateRabeAddressCache", () => {
  it("accepts a fully-valid cache object", () => {
    expect(validateRabeAddressCache(makeCache())).toBe(true);
  });

  it("accepts mainnet as a valid network", () => {
    expect(validateRabeAddressCache(makeCache({ network: "mainnet" }))).toBe(
      true
    );
  });

  it("rejects null", () => {
    expect(validateRabeAddressCache(null)).toBe(false);
  });

  it("rejects a non-object primitive", () => {
    expect(validateRabeAddressCache("string")).toBe(false);
    expect(validateRabeAddressCache(42)).toBe(false);
  });

  it("rejects an empty object", () => {
    expect(validateRabeAddressCache({})).toBe(false);
  });

  it("rejects wrong version number", () => {
    expect(validateRabeAddressCache({ ...makeCache(), version: 2 })).toBe(
      false
    );
  });

  it("rejects a missing address field", () => {
    const { address: _a, ...rest } = makeCache();
    expect(validateRabeAddressCache(rest)).toBe(false);
  });

  it("rejects an address that does not start with G", () => {
    expect(
      validateRabeAddressCache(makeCache({ address: "XD4TI4BA2F6L3UE2SFNFEM5DBGIP2MYH7ID2KHDI2HF3YEEGCFB2OOAI" }))
    ).toBe(false);
  });

  it("rejects an address that is too short", () => {
    expect(
      validateRabeAddressCache(makeCache({ address: "GABC" }))
    ).toBe(false);
  });

  it("rejects an address with invalid Base32 characters", () => {
    // Contains '0' which is not in Base32 alphabet A-Z2-7
    expect(
      validateRabeAddressCache(makeCache({ address: "G04TI4BA2F6L3UE2SFNFEM5DBGIP2MYH7ID2KHDI2HF3YEEGCFB2OOAI" }))
    ).toBe(false);
  });

  it("rejects a non-numeric savedAt", () => {
    expect(
      validateRabeAddressCache({ ...makeCache(), savedAt: "now" })
    ).toBe(false);
  });

  it("rejects a zero savedAt", () => {
    expect(validateRabeAddressCache(makeCache({ savedAt: 0 }))).toBe(false);
  });

  it("rejects a negative savedAt", () => {
    expect(validateRabeAddressCache(makeCache({ savedAt: -1 }))).toBe(false);
  });

  it("rejects an unknown network string", () => {
    expect(
      validateRabeAddressCache({ ...makeCache(), network: "devnet" })
    ).toBe(false);
  });

  it("rejects when network is missing", () => {
    const { network: _n, ...rest } = makeCache();
    expect(validateRabeAddressCache(rest)).toBe(false);
  });
});

describe("rabe_connector active-address cache — serialization round-trip", () => {
  it("serializes to valid JSON and deserializes back to the original object", () => {
    const original = makeCache();
    const json = serializeRabeAddressCache(original);

    expect(typeof json).toBe("string");
    expect(() => JSON.parse(json)).not.toThrow();

    const restored = deserializeRabeAddressCache(json);
    expect(restored).toEqual(original);
  });

  it("deserialization returns null for invalid JSON", () => {
    expect(deserializeRabeAddressCache("{bad json")).toBeNull();
  });

  it("deserialization returns null for JSON that fails validation", () => {
    const badJson = JSON.stringify({ version: 99, address: "NOT_AN_ADDRESS" });
    expect(deserializeRabeAddressCache(badJson)).toBeNull();
  });

  it("deserialization returns null for an empty string", () => {
    expect(deserializeRabeAddressCache("")).toBeNull();
  });

  it("deserialization returns null for a JSON null literal", () => {
    expect(deserializeRabeAddressCache("null")).toBeNull();
  });

  it("serialized output contains the address and network fields", () => {
    const cache = makeCache({ network: "mainnet" });
    const json = serializeRabeAddressCache(cache);
    expect(json).toContain(VALID_ADDRESS);
    expect(json).toContain("mainnet");
  });
});

describe("rabe_connector active-address cache — localStorage integration", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    localStorage.clear();
    warnSpy.mockRestore();
  });

  it("RABE_CACHE_KEY is a non-empty string constant", () => {
    expect(typeof RABE_CACHE_KEY).toBe("string");
    expect(RABE_CACHE_KEY.length).toBeGreaterThan(0);
  });

  it("saveRabeAddressCache writes a valid entry to localStorage", () => {
    saveRabeAddressCache(VALID_ADDRESS, VALID_NETWORK);

    const raw = localStorage.getItem(RABE_CACHE_KEY);
    expect(raw).not.toBeNull();

    const parsed = deserializeRabeAddressCache(raw!);
    expect(parsed).not.toBeNull();
    expect(parsed!.address).toBe(VALID_ADDRESS);
    expect(parsed!.network).toBe(VALID_NETWORK);
    expect(parsed!.version).toBe(1);
    expect(parsed!.savedAt).toBeGreaterThan(0);
  });

  it("loadRabeAddressCache returns null when the key is absent", () => {
    expect(loadRabeAddressCache()).toBeNull();
  });

  it("loadRabeAddressCache returns the saved cache after saveRabeAddressCache", () => {
    saveRabeAddressCache(VALID_ADDRESS, "mainnet");

    const loaded = loadRabeAddressCache();
    expect(loaded).not.toBeNull();
    expect(loaded!.address).toBe(VALID_ADDRESS);
    expect(loaded!.network).toBe("mainnet");
  });

  it("loadRabeAddressCache returns null for corrupt localStorage data", () => {
    localStorage.setItem(RABE_CACHE_KEY, "!!!not-json!!!");
    expect(loadRabeAddressCache()).toBeNull();
  });

  it("loadRabeAddressCache returns null when stored data fails validation", () => {
    localStorage.setItem(
      RABE_CACHE_KEY,
      JSON.stringify({ version: 1, address: "bad", savedAt: -1, network: "testnet" })
    );
    expect(loadRabeAddressCache()).toBeNull();
  });

  it("clearRabeAddressCache removes the entry from localStorage", () => {
    saveRabeAddressCache(VALID_ADDRESS, VALID_NETWORK);
    expect(localStorage.getItem(RABE_CACHE_KEY)).not.toBeNull();

    clearRabeAddressCache();
    expect(localStorage.getItem(RABE_CACHE_KEY)).toBeNull();
  });

  it("clearRabeAddressCache is a no-op when the key does not exist", () => {
    expect(() => clearRabeAddressCache()).not.toThrow();
    expect(localStorage.getItem(RABE_CACHE_KEY)).toBeNull();
  });

  it("second save overwrites the first entry", () => {
    const SECOND_ADDRESS = "GCCS3QYX4XXUWSTYIDP2R6XQFSVWZVWOWNSWTA37ZAND5Z4Z5K7L5I6Y";
    saveRabeAddressCache(VALID_ADDRESS, VALID_NETWORK);
    saveRabeAddressCache(SECOND_ADDRESS, "mainnet");

    const loaded = loadRabeAddressCache();
    expect(loaded!.address).toBe(SECOND_ADDRESS);
    expect(loaded!.network).toBe("mainnet");
  });

  it("save → clear → load returns null", () => {
    saveRabeAddressCache(VALID_ADDRESS, VALID_NETWORK);
    clearRabeAddressCache();
    expect(loadRabeAddressCache()).toBeNull();
  });

  it("savedAt timestamp is close to Date.now()", () => {
    const before = Date.now();
    saveRabeAddressCache(VALID_ADDRESS, VALID_NETWORK);
    const after = Date.now();

    const loaded = loadRabeAddressCache();
    expect(loaded!.savedAt).toBeGreaterThanOrEqual(before);
    expect(loaded!.savedAt).toBeLessThanOrEqual(after);
  });

  it("saveRabeAddressCache logs a warning when localStorage.setItem throws", () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("QuotaExceededError");
      });

    // Should not throw itself
    expect(() =>
      saveRabeAddressCache(VALID_ADDRESS, VALID_NETWORK)
    ).not.toThrow();

    // And should have logged a warning
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[rabe_connector]");
    expect(logged).toContain("CACHE WRITE FAILED");

    setItemSpy.mockRestore();
  });
});
