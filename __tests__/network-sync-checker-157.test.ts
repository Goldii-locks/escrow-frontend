/**
 * Tests for Issue #157 – Secure persistent caching for active keys in
 * network_sync_checker.
 *
 * Covers:
 *   - saveActiveSession  – writes a valid JSON blob to localStorage
 *   - loadActiveSession  – reads and validates the stored session
 *   - clearActiveSession – removes the stored entry
 *   - Resilience against malformed or missing storage data
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
  ACTIVE_SESSION_KEY,
  type ActiveSession,
} from "@/app/lib/network_sync_checker_cache";

// Use a real (in-memory) localStorage via jsdom — no stubs needed for the
// happy-path tests; we only stub for error-path tests.

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("saveActiveSession", () => {
  it("writes an ActiveSession object to localStorage", () => {
    saveActiveSession("GABC1234", "freighter");
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as ActiveSession;
    expect(parsed.address).toBe("GABC1234");
    expect(parsed.walletId).toBe("freighter");
    expect(typeof parsed.savedAt).toBe("number");
  });

  it("records a savedAt timestamp close to Date.now()", () => {
    const before = Date.now();
    saveActiveSession("GABC1234", "albedo");
    const after = Date.now();
    const { savedAt } = JSON.parse(localStorage.getItem(ACTIVE_SESSION_KEY)!) as ActiveSession;
    expect(savedAt).toBeGreaterThanOrEqual(before);
    expect(savedAt).toBeLessThanOrEqual(after);
  });

  it("overwrites an existing session", () => {
    saveActiveSession("GOLD0001", "freighter");
    saveActiveSession("GOLD0002", "albedo");
    const parsed = JSON.parse(localStorage.getItem(ACTIVE_SESSION_KEY)!) as ActiveSession;
    expect(parsed.address).toBe("GOLD0002");
    expect(parsed.walletId).toBe("albedo");
  });

  it("silently handles a localStorage write error", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => saveActiveSession("GABC1234", "freighter")).not.toThrow();
  });
});

describe("loadActiveSession", () => {
  it("returns null when nothing is stored", () => {
    expect(loadActiveSession()).toBeNull();
  });

  it("parses a previously saved session correctly", () => {
    saveActiveSession("GABC1234", "xbull");
    const session = loadActiveSession();
    expect(session).not.toBeNull();
    expect(session!.address).toBe("GABC1234");
    expect(session!.walletId).toBe("xbull");
  });

  it("returns null for malformed JSON", () => {
    localStorage.setItem(ACTIVE_SESSION_KEY, "{ bad json }}}");
    expect(loadActiveSession()).toBeNull();
  });

  it("returns null when address field is missing", () => {
    localStorage.setItem(
      ACTIVE_SESSION_KEY,
      JSON.stringify({ walletId: "freighter", savedAt: Date.now() })
    );
    expect(loadActiveSession()).toBeNull();
  });

  it("returns null when walletId field is missing", () => {
    localStorage.setItem(
      ACTIVE_SESSION_KEY,
      JSON.stringify({ address: "GABC1234", savedAt: Date.now() })
    );
    expect(loadActiveSession()).toBeNull();
  });

  it("returns null when savedAt field is missing", () => {
    localStorage.setItem(
      ACTIVE_SESSION_KEY,
      JSON.stringify({ address: "GABC1234", walletId: "freighter" })
    );
    expect(loadActiveSession()).toBeNull();
  });

  it("returns null when localStorage.getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(loadActiveSession()).toBeNull();
  });
});

describe("clearActiveSession", () => {
  it("removes the stored session", () => {
    saveActiveSession("GABC1234", "freighter");
    clearActiveSession();
    expect(localStorage.getItem(ACTIVE_SESSION_KEY)).toBeNull();
  });

  it("does not throw when there is nothing to clear", () => {
    expect(() => clearActiveSession()).not.toThrow();
  });

  it("silently handles a localStorage removeItem error", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(() => clearActiveSession()).not.toThrow();
  });
});

describe("session round-trip", () => {
  it("save → load → clear cycle works correctly", () => {
    saveActiveSession("GOLDTEST", "hana");

    const loaded = loadActiveSession();
    expect(loaded).toMatchObject({ address: "GOLDTEST", walletId: "hana" });

    clearActiveSession();
    expect(loadActiveSession()).toBeNull();
  });
});
