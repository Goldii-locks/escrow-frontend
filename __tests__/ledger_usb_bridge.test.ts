import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkNetworkMatch,
  clearSensitiveMemory,
  DEFAULT_SIGNATURE_TIMEOUT_MS,
  formatConsoleWarningBlock,
  formatStackTrace,
  isUserRejectedError,
  LEDGER_ACTIVE_ADDRESSES_SCHEMA_VERSION,
  LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY,
  LedgerActiveAddressStore,
  LedgerSignatureTimeoutError,
  LedgerTransactionTracker,
  ledgerTracker,
  LedgerUserRejectedError,
  logLedgerWarning,
  signCatchingRejection,
  signWithTimeout,
  warnOnLedgerNetworkMismatch,
  type LedgerActiveAddress,
  type LedgerSignRequest,
  type LedgerSignResult,
} from "@/app/lib/ledger_usb_bridge";

describe("ledger_usb_bridge signature timeout bounds", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves when the signature arrives before the timeout", async () => {
    const request: LedgerSignRequest = {
      xdr: "AAAA...",
      payload: new Uint8Array([1, 2, 3, 4]),
    };

    const signFn = vi.fn(async (): Promise<LedgerSignResult> => ({
      signedXdr: "signed-xdr",
    }));

    const promise = signWithTimeout(request, signFn, 5_000);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.signedXdr).toBe("signed-xdr");
    expect(request.payload).toBeNull();
  });

  it("aborts the operation and clears memory when the signature times out", async () => {
    const payload = new Uint8Array([9, 8, 7, 6]);
    const request: LedgerSignRequest = {
      xdr: "AAAA...",
      payload,
    };

    const signFn = vi.fn(
      () =>
        new Promise<LedgerSignResult>(() => {
          /* never resolves — simulates hung Ledger */
        })
    );

    const promise = signWithTimeout(request, signFn, 1_000);
    const assertion = expect(promise).rejects.toBeInstanceOf(
      LedgerSignatureTimeoutError
    );

    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;

    expect(request.payload).toBeNull();
    expect(payload.every((byte) => byte === 0)).toBe(true);
  });

  it("uses the default signature timeout bound", () => {
    expect(DEFAULT_SIGNATURE_TIMEOUT_MS).toBe(60_000);
  });

  it("clearSensitiveMemory zeroes buffers and nulls the reference", () => {
    const payload = new Uint8Array([1, 1, 1]);
    const request: LedgerSignRequest = { xdr: "x", payload };
    clearSensitiveMemory(request);
    expect(payload.every((b) => b === 0)).toBe(true);
    expect(request.payload).toBeNull();
  });
});

describe("ledger_usb_bridge user rejection handling", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("detects user rejected transaction exceptions", () => {
    expect(isUserRejectedError(new LedgerUserRejectedError())).toBe(true);
    expect(isUserRejectedError(new Error("user rejected transaction"))).toBe(
      true
    );
    expect(isUserRejectedError(new Error("User Declined the request"))).toBe(
      true
    );
    expect(isUserRejectedError(new Error("device locked"))).toBe(false);
  });

  it("catches rejection errors and shows a clean warning toast", async () => {
    const showToast = vi.fn();

    const result = await signCatchingRejection(async () => {
      throw new Error("user rejected transaction");
    }, showToast);

    expect(result).toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      "Transaction cancelled — you rejected the signature on your Ledger.",
      "warning"
    );
    expect(warnSpy).toHaveBeenCalled();
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[ledger_usb_bridge]");
    expect(logged).toContain("SIGNATURE REJECTED");
    expect(logged).toContain("--- stack trace ---");
    expect(logged).toContain("user rejected transaction");
  });

  it("re-throws non-rejection errors without toasting", async () => {
    const showToast = vi.fn();

    await expect(
      signCatchingRejection(async () => {
        throw new Error("USB disconnect");
      }, showToast)
    ).rejects.toThrow("USB disconnect");

    expect(showToast).not.toHaveBeenCalled();
  });

  it("returns the signed result when the user approves", async () => {
    const showToast = vi.fn();
    const result = await signCatchingRejection(
      async () => ({ signedXdr: "ok" }),
      showToast
    );
    expect(result).toEqual({ signedXdr: "ok" });
    expect(showToast).not.toHaveBeenCalled();
  });
});

describe("ledger_usb_bridge network mismatch checks", () => {
  it("reports no mismatch when networks align", () => {
    const state = checkNetworkMatch("testnet", "testnet");
    expect(state.mismatched).toBe(false);
    expect(state.warningMessage).toBeNull();
  });

  it("builds a warning message when Mainnet vs Testnet diverge", () => {
    const state = checkNetworkMatch("mainnet", "testnet");
    expect(state.mismatched).toBe(true);
    expect(state.walletNetwork).toBe("mainnet");
    expect(state.appNetwork).toBe("testnet");
    expect(state.warningMessage).toMatch(/Network mismatch/i);
    expect(state.warningMessage).toMatch(/Mainnet/);
    expect(state.warningMessage).toMatch(/Testnet/);
  });
});

describe("ledger_usb_bridge console warning blocks", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    ledgerTracker.clear();
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

  it("builds a console warning block that includes the stack trace format", () => {
    const stack = formatStackTrace(new Error("tx debug"));
    const block = formatConsoleWarningBlock({
      title: "TX SIGNING",
      body: "Awaiting Ledger signature",
      stack,
      txId: "tx-ledger-1",
      phase: "signing",
    });

    expect(block).toContain("[ledger_usb_bridge]");
    expect(block).toContain("TX SIGNING");
    expect(block).toContain("Awaiting Ledger signature");
    expect(block).toContain("txId: tx-ledger-1");
    expect(block).toContain("phase: signing");
    expect(block).toContain("--- stack trace ---");
    expect(block).toContain("--- end stack ---");
    expect(block).toContain("Error: tx debug");
  });

  it("logs formatted warning blocks (with stack) via console.warn", () => {
    const formatted = logLedgerWarning("TX ERROR", "USB transport failed", {
      err: new Error("device busy"),
      txId: "tx-2",
      phase: "error",
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(formatted);
    expect(formatted).toMatch(/--- stack trace ---[\s\S]*Error: device busy/);
  });

  it("tracks transaction phases and logs a warning block per phase", () => {
    const tracker = new LedgerTransactionTracker();

    tracker.track("tx-99", "building", "Preparing XDR");
    tracker.track("tx-99", "signing", "Prompting Ledger device");
    tracker.track(
      "tx-99",
      "error",
      "Ledger returned failure",
      new Error("locked device")
    );

    const history = tracker.getHistory("tx-99");
    expect(history).toHaveLength(3);
    expect(history.map((e) => e.phase)).toEqual([
      "building",
      "signing",
      "error",
    ]);
    expect(history[2].stack).toContain("Error: locked device");
    expect(warnSpy).toHaveBeenCalledTimes(3);

    const lastCall = String(warnSpy.mock.calls[2][0]);
    expect(lastCall).toContain("TX ERROR");
    expect(lastCall).toContain("--- stack trace ---");
  });

  it("warnOnLedgerNetworkMismatch logs a formatted block on mismatch", () => {
    const state = warnOnLedgerNetworkMismatch("mainnet", "testnet");
    expect(state.mismatched).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("NETWORK MISMATCH");
    expect(logged).toContain("--- stack trace ---");
  });
});

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

function makeAddress(overrides: Partial<LedgerActiveAddress> = {}): LedgerActiveAddress {
  return {
    address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    derivationPath: "m/44'/148'/0'",
    accountIndex: 0,
    label: "Primary",
    network: "testnet",
    lastUsedAt: Date.now(),
    ...overrides,
  };
}

describe("ledger_usb_bridge active address persistence", () => {
  let storage: Storage;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    storage = createMockStorage();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("starts with an empty active address list when storage is empty", () => {
    const store = new LedgerActiveAddressStore(storage);
    expect(store.getActiveAddresses()).toEqual([]);
  });

  it("serializes active addresses to storage when setActiveAddresses is called", () => {
    const store = new LedgerActiveAddressStore(storage);
    const address = makeAddress();

    store.setActiveAddresses([address]);

    const raw = storage.getItem(LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.version).toBe(LEDGER_ACTIVE_ADDRESSES_SCHEMA_VERSION);
    expect(parsed.addresses).toHaveLength(1);
    expect(parsed.addresses[0].address).toBe(address.address);
    expect(parsed.addresses[0].derivationPath).toBe(address.derivationPath);
    expect(parsed.addresses[0].accountIndex).toBe(0);
    expect(store.getActiveAddresses()).toHaveLength(1);
  });

  it("rehydrates persisted addresses when a new store instance reads storage", () => {
    const address1 = makeAddress({
      address: "GADDR1",
      derivationPath: "m/44'/148'/0'",
      accountIndex: 0,
    });
    const address2 = makeAddress({
      address: "GADDR2",
      derivationPath: "m/44'/148'/1'",
      accountIndex: 1,
    });

    const storeA = new LedgerActiveAddressStore(storage);
    storeA.setActiveAddresses([address1, address2]);

    const storeB = new LedgerActiveAddressStore(storage);
    const rehydrated = storeB.getActiveAddresses();
    expect(rehydrated).toHaveLength(2);
    expect(rehydrated.map((a) => a.address)).toEqual(["GADDR1", "GADDR2"]);
    expect(rehydrated[0].derivationPath).toBe("m/44'/148'/0'");
    expect(rehydrated[1].accountIndex).toBe(1);
  });

  it("addOrUpdateAddress inserts new addresses and updates existing matches", () => {
    const store = new LedgerActiveAddressStore(storage);
    const addr = makeAddress({ address: "G1", derivationPath: "m/0" });

    store.addOrUpdateAddress(addr);
    expect(store.getActiveAddresses()).toHaveLength(1);

    store.addOrUpdateAddress(
      makeAddress({ address: "G2", derivationPath: "m/1" })
    );
    expect(store.getActiveAddresses()).toHaveLength(2);

    store.addOrUpdateAddress(
      makeAddress({
        address: "G1",
        derivationPath: "m/0",
        label: "Updated Label",
      })
    );
    const result = store.getActiveAddresses();
    expect(result).toHaveLength(2);
    const updated = result.find((a) => a.address === "G1");
    expect(updated?.label).toBe("Updated Label");
  });

  it("removeAddress filters out entries by address string", () => {
    const store = new LedgerActiveAddressStore(storage);
    store.setActiveAddresses([
      makeAddress({ address: "GKEEP" }),
      makeAddress({ address: "GREMOVE" }),
    ]);

    store.removeAddress("GREMOVE");

    const remaining = store.getActiveAddresses();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].address).toBe("GKEEP");
    const raw = storage.getItem(LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY);
    expect(raw).toContain("GKEEP");
    expect(raw).not.toContain("GREMOVE");
  });

  it("clear empties in-memory state and removes the persisted storage key", () => {
    const store = new LedgerActiveAddressStore(storage);
    store.setActiveAddresses([makeAddress()]);
    expect(storage.getItem(LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY)).not.toBeNull();
    expect(store.getActiveAddresses()).not.toEqual([]);

    store.clear();

    expect(store.getActiveAddresses()).toEqual([]);
    expect(storage.getItem(LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY)).toBeNull();
  });

  it("drops invalid entries silently in setActiveAddresses (no private data leak)", () => {
    const store = new LedgerActiveAddressStore(storage);
    const mixed = [
      makeAddress({ address: "GVALID" }),
      {
        address: "",
        derivationPath: "m/0",
        accountIndex: 0,
        network: "testnet",
        lastUsedAt: Date.now(),
      } as unknown as LedgerActiveAddress,
      {
        address: "GSECRET",
        derivationPath: "m/0",
        accountIndex: "oops" as unknown as number,
        network: "testnet",
        lastUsedAt: Date.now(),
        privateKey: "SHOULD_NEVER_EXIST",
      } as unknown as LedgerActiveAddress,
    ];

    store.setActiveAddresses(mixed);

    const result = store.getActiveAddresses();
    expect(result).toHaveLength(1);
    expect(result[0].address).toBe("GVALID");

    const raw = storage.getItem(LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY);
    expect(raw).toContain("GVALID");
    expect(raw).not.toContain("SHOULD_NEVER_EXIST");
    expect(raw).not.toContain("privateKey");
  });

  it("handles corrupted JSON in storage by falling back to empty state", () => {
    storage.setItem(LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY, "{not valid json!!");

    const store = new LedgerActiveAddressStore(storage);

    expect(store.getActiveAddresses()).toEqual([]);
    expect(storage.getItem(LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    const logged = warnSpy.mock.calls
      .map((c: unknown[]) => String(c[0]))
      .join("\n");
    expect(logged).toContain("REHYDRATE FAILED");
  });

  it("handles wrong schema version by discarding persisted data", () => {
    const futurePayload = JSON.stringify({
      version: 99,
      addresses: [makeAddress()],
    });
    storage.setItem(LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY, futurePayload);

    const store = new LedgerActiveAddressStore(storage);

    expect(store.getActiveAddresses()).toEqual([]);
    expect(storage.getItem(LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY)).toBeNull();
    const logged = warnSpy.mock.calls
      .map((c: unknown[]) => String(c[0]))
      .join("\n");
    expect(logged).toContain("REHYDRATE SCHEMA MISMATCH");
  });

  it("handles malformed payload shape (non-object addresses field)", () => {
    const badPayload = JSON.stringify({
      version: LEDGER_ACTIVE_ADDRESSES_SCHEMA_VERSION,
      addresses: "totally-not-an-array",
    });
    storage.setItem(LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY, badPayload);

    const store = new LedgerActiveAddressStore(storage);

    expect(store.getActiveAddresses()).toEqual([]);
    expect(storage.getItem(LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY)).toBeNull();
  });

  it("handles address entries with missing required fields during rehydrate", () => {
    const badEntries = JSON.stringify({
      version: LEDGER_ACTIVE_ADDRESSES_SCHEMA_VERSION,
      addresses: [
        { address: "GTEST" },
        makeAddress({ address: "GGOOD" }),
      ],
    });
    storage.setItem(LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY, badEntries);

    const store = new LedgerActiveAddressStore(storage);

    expect(store.getActiveAddresses()).toEqual([]);
    expect(storage.getItem(LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY)).toBeNull();
  });

  it("never serializes private, secret, or seed-like fields", () => {
    const store = new LedgerActiveAddressStore(storage);
    const tainted = makeAddress({ address: "GSAFE" }) as LedgerActiveAddress & {
      privateKey?: string;
      seed?: string;
      mnemonic?: string;
    };
    tainted.privateKey = "SCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    tainted.seed = "deadbeef";
    tainted.mnemonic = "word word word";

    store.addOrUpdateAddress(tainted);

    const raw = storage.getItem(LEDGER_ACTIVE_ADDRESSES_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(raw).not.toContain("SCXXXXXXXX");
    expect(raw).not.toContain("deadbeef");
    expect(raw).not.toContain("word word word");
    expect(raw).not.toContain("privateKey");
    expect(raw).not.toContain("seed");
    expect(raw).not.toContain("mnemonic");

    const parsed = JSON.parse(raw as string);
    const serialized = parsed.addresses[0];
    expect(serialized.address).toBe("GSAFE");
    expect(Object.keys(serialized)).toEqual(
      expect.arrayContaining([
        "address",
        "derivationPath",
        "accountIndex",
        "label",
        "network",
        "lastUsedAt",
      ])
    );
    expect(Object.keys(serialized)).not.toEqual(
      expect.arrayContaining(["privateKey", "seed", "mnemonic"])
    );
  });

  it("passes only public fields through the isValidLedgerActiveAddress validator", () => {
    const store = new LedgerActiveAddressStore(storage);
    const withSensitive = makeAddress() as LedgerActiveAddress & {
      privateKey?: string;
    };
    withSensitive.privateKey = "SENSITIVE";

    store.setActiveAddresses([withSensitive]);
    const result = store.getActiveAddresses();
    for (const entry of result) {
      const keys = Object.keys(entry);
      expect(keys).not.toContain("privateKey");
    }
  });

  it("gracefully handles a null storage adapter (SSR / unavailable storage)", () => {
    const store = new LedgerActiveAddressStore(null);
    expect(store.getActiveAddresses()).toEqual([]);

    store.setActiveAddresses([makeAddress()]);
    expect(store.getActiveAddresses()).toHaveLength(1);

    store.clear();
    expect(store.getActiveAddresses()).toEqual([]);
  });

  it("returns defensive copies from getActiveAddresses to prevent mutation", () => {
    const store = new LedgerActiveAddressStore(storage);
    const original = makeAddress({ address: "GCOPY" });
    store.setActiveAddresses([original]);

    const copy1 = store.getActiveAddresses();
    const copy2 = store.getActiveAddresses();
    expect(copy1).not.toBe(copy2);
    copy1[0].address = "GMUTATED";
    expect(store.getActiveAddresses()[0].address).toBe("GCOPY");
  });
});
