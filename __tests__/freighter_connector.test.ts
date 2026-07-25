import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FREIGHTER_STORAGE_KEY,
  FREIGHTER_STATE_VERSION,
  DEFAULT_FREIGHTER_WALLET_ID,
  isValidStellarAddress,
  isValidWalletId,
  isValidNetwork,
  formatStackTrace,
  buildFreighterWarningBlock,
  logFreighterWarning,
  FreighterStateParseError,
  validateSerializedState,
  serializeWalletState,
  saveFreighterState,
  parseFreighterState,
  loadFreighterState,
  clearFreighterState,
  checkFreighterNetworkMatch,
  warnOnFreighterNetworkMismatch,
  passphraseToNetwork,
  FreighterSessionManager,
} from "@/app/lib/freighter_connector";

const TEST_ADDRESS_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const TEST_ADDRESS_B = "GBBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACQ";
const INVALID_ADDRESS_SHORT = "GSHORT";
const INVALID_ADDRESS_CHARS = "GxxxxxlowercasexxxxxAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVVV";

interface MockStorage {
  store: Map<string, string>;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function makeMockStorage(): MockStorage {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (k) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k, v) => {
      store.set(k, v);
    },
    removeItem: (k) => {
      store.delete(k);
    },
  };
}

function validState(overrides: Partial<{
  address: string;
  selectedWalletId: "freighter" | "albedo" | "xbull" | "hana";
  connectedAt: number;
  network: "mainnet" | "testnet";
  version: number;
}> = {}) {
  return {
    address: TEST_ADDRESS_A,
    selectedWalletId: "freighter" as const,
    connectedAt: 1_700_000_000_000,
    network: "testnet" as const,
    version: FREIGHTER_STATE_VERSION,
    ...overrides,
  };
}

describe("freighter_connector validators", () => {
  describe("isValidStellarAddress", () => {
    it("accepts well-formed G-prefixed 56-char Stellar addresses", () => {
      expect(isValidStellarAddress(TEST_ADDRESS_A)).toBe(true);
      expect(isValidStellarAddress(TEST_ADDRESS_B)).toBe(true);
    });

    it("rejects addresses shorter than 56 chars", () => {
      expect(isValidStellarAddress(INVALID_ADDRESS_SHORT)).toBe(false);
    });

    it("rejects non-G-prefixed strings of the right length", () => {
      const bad = "A" + TEST_ADDRESS_A.slice(1);
      expect(isValidStellarAddress(bad)).toBe(false);
    });

    it("rejects empty strings and nullish inputs", () => {
      expect(isValidStellarAddress("")).toBe(false);
    });
  });

  describe("isValidWalletId", () => {
    it("accepts the four supported wallet identifiers", () => {
      expect(isValidWalletId("freighter")).toBe(true);
      expect(isValidWalletId("albedo")).toBe(true);
      expect(isValidWalletId("xbull")).toBe(true);
      expect(isValidWalletId("hana")).toBe(true);
    });

    it("rejects unknown wallet identifiers and non-strings", () => {
      expect(isValidWalletId("lobstr")).toBe(false);
      expect(isValidWalletId(undefined)).toBe(false);
      expect(isValidWalletId(null)).toBe(false);
      expect(isValidWalletId(42)).toBe(false);
    });
  });

  describe("isValidNetwork", () => {
    it("accepts mainnet and testnet", () => {
      expect(isValidNetwork("mainnet")).toBe(true);
      expect(isValidNetwork("testnet")).toBe(true);
    });

    it("rejects other strings and non-string values", () => {
      expect(isValidNetwork("futurenet")).toBe(false);
      expect(isValidNetwork("")).toBe(false);
      expect(isValidNetwork(undefined)).toBe(false);
    });
  });
});

describe("freighter_connector warning blocks and stack traces", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("formats stack traces from Error instances", () => {
    const err = new Error("connection lost");
    const stack = formatStackTrace(err);

    expect(stack).toContain("Error: connection lost");
    expect(stack).toMatch(/at /);
  });

  it("synthesizes a stack when no Error is provided", () => {
    const stack = formatStackTrace();
    expect(stack).toContain("Error:");
    expect(stack.split("\n").length).toBeGreaterThan(1);
  });

  it("builds a warning block with address, phase, and stack delimiters", () => {
    const stack = formatStackTrace(new Error("tx debug"));
    const block = buildFreighterWarningBlock({
      title: "SESSION RESTORE",
      body: "Restoring wallet from storage",
      stack,
      address: TEST_ADDRESS_A,
      phase: "restoring",
    });

    expect(block).toContain("[freighter_connector]");
    expect(block).toContain("SESSION RESTORE");
    expect(block).toContain("Restoring wallet from storage");
    expect(block).toContain(`address: ${TEST_ADDRESS_A}`);
    expect(block).toContain("phase: restoring");
    expect(block).toContain("--- stack trace ---");
    expect(block).toContain("--- end stack ---");
    expect(block).toContain("Error: tx debug");
  });

  it("logs formatted warning blocks via console.warn", () => {
    const formatted = logFreighterWarning(
      "SIGN FAILED",
      "User rejected signature",
      {
        err: new Error("user cancelled"),
        address: TEST_ADDRESS_A,
        phase: "signing",
      }
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(formatted);
    expect(formatted).toMatch(
      /--- stack trace ---[\s\S]*Error: user cancelled/
    );
    expect(formatted).toContain(`address: ${TEST_ADDRESS_A}`);
  });
});

describe("freighter_connector state validation and serialization", () => {
  describe("FreighterStateParseError", () => {
    it("carries the offending field name on the error", () => {
      const err = new FreighterStateParseError("address", "bad address");
      expect(err.name).toBe("FreighterStateParseError");
      expect(err.field).toBe("address");
      expect(err.message).toBe("bad address");
    });

    it("allows null field for top-level parse failures", () => {
      const err = new FreighterStateParseError(null, "root failure");
      expect(err.field).toBeNull();
    });
  });

  describe("validateSerializedState", () => {
    it("accepts a well-formed state object", () => {
      const s = validState();
      const result = validateSerializedState(s);
      expect(result.address).toBe(TEST_ADDRESS_A);
      expect(result.selectedWalletId).toBe("freighter");
      expect(result.network).toBe("testnet");
      expect(result.version).toBe(FREIGHTER_STATE_VERSION);
    });

    it("rejects null / undefined", () => {
      expect(() => validateSerializedState(null)).toThrow(
        FreighterStateParseError
      );
      expect(() => validateSerializedState(undefined)).toThrow(
        FreighterStateParseError
      );
    });

    it("rejects non-object values", () => {
      expect(() => validateSerializedState("not-json")).toThrow(
        FreighterStateParseError
      );
      expect(() => validateSerializedState(123)).toThrow(
        FreighterStateParseError
      );
    });

    it("rejects missing or wrong version fields", () => {
      const missing = { ...validState(), version: undefined as unknown as number };
      expect(() => validateSerializedState(missing)).toThrow(
        /version must be a number/
      );

      const wrong = validState({ version: 999 });
      expect(() => validateSerializedState(wrong)).toThrow(
        /Unsupported state version/
      );
    });

    it("rejects non-string / invalid addresses", () => {
      const nonStr = validState({ address: 123 as unknown as string });
      expect(() => validateSerializedState(nonStr)).toThrow(
        /address must be a string/
      );

      const bad = validState({ address: INVALID_ADDRESS_SHORT });
      expect(() => validateSerializedState(bad)).toThrow(
        /not a valid Stellar public key/
      );
    });

    it("rejects invalid wallet IDs", () => {
      const bad = validState({ selectedWalletId: "lobstr" as unknown as "freighter" });
      expect(() => validateSerializedState(bad)).toThrow(
        /selectedWalletId is invalid/
      );
    });

    it("rejects invalid connectedAt values", () => {
      const nan = validState({ connectedAt: NaN });
      expect(() => validateSerializedState(nan)).toThrow(
        /connectedAt must be a valid number/
      );

      const zero = validState({ connectedAt: 0 });
      expect(() => validateSerializedState(zero)).toThrow(
        /connectedAt must be positive/
      );

      const neg = validState({ connectedAt: -1 });
      expect(() => validateSerializedState(neg)).toThrow(
        /connectedAt must be positive/
      );
    });

    it("rejects invalid network values", () => {
      const bad = validState({ network: "futurenet" as unknown as "testnet" });
      expect(() => validateSerializedState(bad)).toThrow(/network is invalid/);
    });
  });

  describe("serializeWalletState", () => {
    it("produces a versioned, timestamped state object", () => {
      const before = Date.now();
      const result = serializeWalletState({
        address: TEST_ADDRESS_A,
        selectedWalletId: "albedo",
        network: "mainnet",
      });
      const after = Date.now();

      expect(result.version).toBe(FREIGHTER_STATE_VERSION);
      expect(result.connectedAt).toBeGreaterThanOrEqual(before);
      expect(result.connectedAt).toBeLessThanOrEqual(after);
      expect(result.address).toBe(TEST_ADDRESS_A);
      expect(result.selectedWalletId).toBe("albedo");
      expect(result.network).toBe("mainnet");
    });

    it("allows overriding connectedAt", () => {
      const ts = 1_600_000_000_000;
      const result = serializeWalletState({
        address: TEST_ADDRESS_A,
        selectedWalletId: "freighter",
        network: "testnet",
        connectedAt: ts,
      });
      expect(result.connectedAt).toBe(ts);
    });

    it("throws FreighterStateParseError for invalid inputs", () => {
      expect(() =>
        serializeWalletState({
          address: INVALID_ADDRESS_CHARS,
          selectedWalletId: "freighter",
          network: "testnet",
        })
      ).toThrow(FreighterStateParseError);

      expect(() =>
        serializeWalletState({
          address: TEST_ADDRESS_A,
          selectedWalletId: "nope" as unknown as "freighter",
          network: "testnet",
        })
      ).toThrow(FreighterStateParseError);
    });
  });

  describe("parseFreighterState", () => {
    it("parses and validates a JSON string", () => {
      const raw = JSON.stringify(validState());
      const parsed = parseFreighterState(raw);
      expect(parsed.address).toBe(TEST_ADDRESS_A);
    });

    it("wraps malformed JSON in FreighterStateParseError", () => {
      expect(() => parseFreighterState("{not json")).toThrow(
        FreighterStateParseError
      );
    });
  });
});

describe("freighter_connector storage persistence", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let storage: MockStorage;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    storage = makeMockStorage();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe("saveFreighterState", () => {
    it("serializes and persists a state object under the versioned key", () => {
      const ok = saveFreighterState(
        {
          address: TEST_ADDRESS_A,
          selectedWalletId: "freighter",
          network: "testnet",
        },
        { storage }
      );
      expect(ok).toBe(true);

      const raw = storage.getItem(FREIGHTER_STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw as string);
      expect(parsed.address).toBe(TEST_ADDRESS_A);
      expect(parsed.version).toBe(FREIGHTER_STATE_VERSION);
    });

    it("returns false and logs when serialization fails", () => {
      const ok = saveFreighterState(
        {
          address: "GARBAGE",
          selectedWalletId: "freighter",
          network: "testnet",
        },
        { storage }
      );
      expect(ok).toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(storage.getItem(FREIGHTER_STORAGE_KEY)).toBeNull();
    });

    it("returns false when storage adapter is unavailable", () => {
      const broken = {
        getItem: storage.getItem,
        setItem: () => {
          throw new Error("quota exceeded");
        },
        removeItem: storage.removeItem,
      };
      const ok = saveFreighterState(
        {
          address: TEST_ADDRESS_A,
          selectedWalletId: "xbull",
          network: "testnet",
        },
        { storage: broken }
      );
      expect(ok).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe("loadFreighterState", () => {
    it("returns an empty fallback when nothing is stored", () => {
      const state = loadFreighterState({ storage });
      expect(state.restored).toBe(false);
      expect(state.address).toBeNull();
      expect(state.connectedAt).toBeNull();
      expect(state.network).toBeNull();
      expect(state.parseError).toBeNull();
      expect(state.selectedWalletId).toBe(DEFAULT_FREIGHTER_WALLET_ID);
    });

    it("restores a valid, previously-saved session", () => {
      const savedAt = 1_700_000_000_000;
      saveFreighterState(
        {
          address: TEST_ADDRESS_B,
          selectedWalletId: "hana",
          network: "mainnet",
          connectedAt: savedAt,
        },
        { storage }
      );

      const state = loadFreighterState({ storage });
      expect(state.restored).toBe(true);
      expect(state.address).toBe(TEST_ADDRESS_B);
      expect(state.selectedWalletId).toBe("hana");
      expect(state.network).toBe("mainnet");
      expect(state.connectedAt).toBe(savedAt);
      expect(state.parseError).toBeNull();
    });

    it("drops corrupted sessions and clears the storage key", () => {
      storage.setItem(FREIGHTER_STORAGE_KEY, "{corrupted json");

      const state = loadFreighterState({ storage });
      expect(state.restored).toBe(false);
      expect(state.address).toBeNull();
      expect(state.parseError).not.toBeNull();
      expect(storage.getItem(FREIGHTER_STORAGE_KEY)).toBeNull();
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it("drops sessions with failing validation and clears storage", () => {
      const bad = validState({ address: INVALID_ADDRESS_SHORT });
      storage.setItem(FREIGHTER_STORAGE_KEY, JSON.stringify(bad));

      const state = loadFreighterState({ storage });
      expect(state.restored).toBe(false);
      expect(state.parseError).toMatch(/valid Stellar/);
      expect(storage.getItem(FREIGHTER_STORAGE_KEY)).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
    });

    it("gracefully handles storage getItem exceptions", () => {
      const throwing = {
        getItem: () => {
          throw new Error("bad storage");
        },
        setItem: storage.setItem,
        removeItem: storage.removeItem,
      };
      const state = loadFreighterState({ storage: throwing });
      expect(state.restored).toBe(false);
      expect(state.parseError).not.toBeNull();
    });
  });

  describe("clearFreighterState", () => {
    it("removes the saved session", () => {
      saveFreighterState(
        {
          address: TEST_ADDRESS_A,
          selectedWalletId: "freighter",
          network: "testnet",
        },
        { storage }
      );
      expect(storage.getItem(FREIGHTER_STORAGE_KEY)).not.toBeNull();

      const ok = clearFreighterState({ storage });
      expect(ok).toBe(true);
      expect(storage.getItem(FREIGHTER_STORAGE_KEY)).toBeNull();
    });

    it("returns false and logs when storage remove throws", () => {
      const bad = {
        getItem: storage.getItem,
        setItem: storage.setItem,
        removeItem: () => {
          throw new Error("storage locked");
        },
      };
      const ok = clearFreighterState({ storage: bad });
      expect(ok).toBe(false);
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});

describe("freighter_connector network helpers", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe("checkFreighterNetworkMatch", () => {
    it("reports no mismatch for matching networks", () => {
      const s = checkFreighterNetworkMatch("testnet", "testnet");
      expect(s.mismatched).toBe(false);
      expect(s.warningMessage).toBeNull();
    });

    it("builds a capitalized mismatch message for mainnet vs testnet", () => {
      const s = checkFreighterNetworkMatch("mainnet", "testnet");
      expect(s.mismatched).toBe(true);
      expect(s.walletNetwork).toBe("mainnet");
      expect(s.appNetwork).toBe("testnet");
      expect(s.warningMessage).toMatch(/Mainnet/);
      expect(s.warningMessage).toMatch(/Testnet/);
      expect(s.warningMessage).toMatch(/Network mismatch/);
    });
  });

  describe("warnOnFreighterNetworkMismatch", () => {
    it("logs a formatted warning block when mismatched", () => {
      const s = warnOnFreighterNetworkMismatch("mainnet", "testnet");
      expect(s.mismatched).toBe(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const logged = String(warnSpy.mock.calls[0][0]);
      expect(logged).toContain("[freighter_connector]");
      expect(logged).toContain("NETWORK MISMATCH");
    });

    it("does not log when networks match", () => {
      const s = warnOnFreighterNetworkMismatch("testnet", "testnet");
      expect(s.mismatched).toBe(false);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe("passphraseToNetwork", () => {
    it("maps testnet passphrase to testnet", () => {
      expect(
        passphraseToNetwork("Test SDF Network ; September 2015")
      ).toBe("testnet");
    });

    it("maps mainnet passphrase to mainnet", () => {
      expect(
        passphraseToNetwork("Public Global Stellar Network ; September 2015")
      ).toBe("mainnet");
    });

    it("returns null for unknown passphrases", () => {
      expect(passphraseToNetwork("My Custom Network")).toBeNull();
      expect(passphraseToNetwork("")).toBeNull();
    });
  });
});

describe("FreighterSessionManager", () => {
  let storage: MockStorage;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    storage = makeMockStorage();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("loads any previously stored session at construction time", () => {
    saveFreighterState(
      {
        address: TEST_ADDRESS_A,
        selectedWalletId: "albedo",
        network: "mainnet",
      },
      { storage }
    );

    const mgr = new FreighterSessionManager({ storage });
    const state = mgr.getState();
    expect(state.restored).toBe(true);
    expect(state.address).toBe(TEST_ADDRESS_A);
    expect(state.selectedWalletId).toBe("albedo");
  });

  it("persists new data and refreshes the in-memory copy", () => {
    const mgr = new FreighterSessionManager({ storage });
    expect(mgr.getState().restored).toBe(false);

    const ok = mgr.persist({
      address: TEST_ADDRESS_B,
      selectedWalletId: "xbull",
      network: "testnet",
    });
    expect(ok).toBe(true);

    const state = mgr.getState();
    expect(state.restored).toBe(true);
    expect(state.address).toBe(TEST_ADDRESS_B);
    expect(state.selectedWalletId).toBe("xbull");

    // Also verify the data is on disk via the raw key.
    const raw = JSON.parse(storage.getItem(FREIGHTER_STORAGE_KEY) as string);
    expect(raw.address).toBe(TEST_ADDRESS_B);
  });

  it("restore() re-reads from storage and updates in-memory state", () => {
    const mgr = new FreighterSessionManager({ storage });
    saveFreighterState(
      {
        address: TEST_ADDRESS_A,
        selectedWalletId: "hana",
        network: "testnet",
      },
      { storage }
    );

    const state = mgr.restore();
    expect(state.restored).toBe(true);
    expect(state.address).toBe(TEST_ADDRESS_A);
    expect(state.selectedWalletId).toBe("hana");
  });

  it("clear() wipes both storage and in-memory state", () => {
    const mgr = new FreighterSessionManager({ storage });
    mgr.persist({
      address: TEST_ADDRESS_A,
      selectedWalletId: "freighter",
      network: "testnet",
    });

    const ok = mgr.clear();
    expect(ok).toBe(true);
    expect(mgr.getState().restored).toBe(false);
    expect(mgr.getState().address).toBeNull();
    expect(storage.getItem(FREIGHTER_STORAGE_KEY)).toBeNull();
  });

  it("getState() returns a defensive copy", () => {
    const mgr = new FreighterSessionManager({ storage });
    mgr.persist({
      address: TEST_ADDRESS_A,
      selectedWalletId: "freighter",
      network: "testnet",
    });

    const s1 = mgr.getState();
    s1.address = "MUTATED";
    const s2 = mgr.getState();
    expect(s2.address).toBe(TEST_ADDRESS_A);
  });
});

describe("freighter_connector end-to-end reload simulation", () => {
  let storage: MockStorage;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    storage = makeMockStorage();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("round-trips a session through save -> clear manager -> reload (new manager)", () => {
    const mgr1 = new FreighterSessionManager({ storage });
    mgr1.persist({
      address: TEST_ADDRESS_A,
      selectedWalletId: "albedo",
      network: "testnet",
    });

    const mgr2 = new FreighterSessionManager({ storage });
    const reloaded = mgr2.getState();

    expect(reloaded.restored).toBe(true);
    expect(reloaded.address).toBe(TEST_ADDRESS_A);
    expect(reloaded.selectedWalletId).toBe("albedo");
    expect(reloaded.network).toBe("testnet");
    expect(typeof reloaded.connectedAt).toBe("number");
    expect(reloaded.parseError).toBeNull();
  });

  it("detects a version bump and drops the stale session", () => {
    saveFreighterState(
      {
        address: TEST_ADDRESS_A,
        selectedWalletId: "freighter",
        network: "testnet",
      },
      { storage }
    );
    const onDisk = JSON.parse(storage.getItem(FREIGHTER_STORAGE_KEY) as string);
    onDisk.version = FREIGHTER_STATE_VERSION + 42;
    storage.setItem(FREIGHTER_STORAGE_KEY, JSON.stringify(onDisk));

    const mgr = new FreighterSessionManager({ storage });
    const state = mgr.getState();
    expect(state.restored).toBe(false);
    expect(state.address).toBeNull();
    expect(state.parseError).toMatch(/Unsupported state version/);
    expect(storage.getItem(FREIGHTER_STORAGE_KEY)).toBeNull();
  });

  it("gracefully tolerates a wallet extension swap (address changes under the same session key)", () => {
    saveFreighterState(
      {
        address: TEST_ADDRESS_A,
        selectedWalletId: "freighter",
        network: "testnet",
      },
      { storage }
    );

    const mgr = new FreighterSessionManager({ storage });
    mgr.persist({
      address: TEST_ADDRESS_B,
      selectedWalletId: "albedo",
      network: "mainnet",
    });

    const state = mgr.getState();
    expect(state.address).toBe(TEST_ADDRESS_B);
    expect(state.selectedWalletId).toBe("albedo");
    expect(state.network).toBe("mainnet");
  });
});
