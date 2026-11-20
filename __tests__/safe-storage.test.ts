// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSafeStorage, MemoryStorage, resetSafeStorageCache } from "@/app/lib/safe_storage";

beforeEach(() => {
  resetSafeStorageCache();
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetSafeStorageCache();
});

describe("getSafeStorage", () => {
  it("returns window.localStorage when it works, and removes the probe key", () => {
    const storage = getSafeStorage();
    expect(storage).toBe(window.localStorage);
    expect(window.localStorage.length).toBe(0);
  });

  it("falls back to memory when the localStorage getter throws", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    expect(getSafeStorage()).toBeInstanceOf(MemoryStorage);
  });

  it("falls back to memory when setItem throws a quota error", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    expect(getSafeStorage()).toBeInstanceOf(MemoryStorage);
  });

  it("falls back to memory when window is undefined (SSR)", () => {
    vi.stubGlobal("window", undefined);
    expect(getSafeStorage()).toBeInstanceOf(MemoryStorage);
  });

  it("caches the result so the probe runs once", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const first = getSafeStorage();
    expect(getSafeStorage()).toBe(first);
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it("resetSafeStorageCache makes the next call probe again", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementationOnce(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    expect(getSafeStorage()).toBeInstanceOf(MemoryStorage);

    resetSafeStorageCache();
    expect(getSafeStorage()).toBe(window.localStorage);
    expect(setItem).toHaveBeenCalledTimes(2);
  });
});

describe("MemoryStorage", () => {
  it("implements the Storage interface", () => {
    const s = new MemoryStorage();
    expect(s.getItem("missing")).toBeNull();
    s.setItem("a", "1");
    s.setItem("b", 2 as unknown as string);
    expect(s.length).toBe(2);
    expect(s.getItem("b")).toBe("2");
    expect(s.key(0)).toBe("a");
    expect(s.key(5)).toBeNull();
    s.removeItem("a");
    expect(s.getItem("a")).toBeNull();
    s.clear();
    expect(s.length).toBe(0);
  });
});
