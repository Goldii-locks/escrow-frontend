/**
 * safe_storage.ts
 *
 * Single source of truth for localStorage availability detection.
 *
 * Problem: every module that persists state was duplicating the same
 * write/remove probe, each with slightly different key names and error
 * handling. This module centralises the probe and provides an in-memory
 * fallback for Safari private mode and SSR environments where localStorage
 * is unavailable or throws.
 *
 * Usage:
 *   import { getSafeStorage } from "@/app/lib/safe_storage";
 *   const storage = getSafeStorage();
 *   storage.setItem("key", "value");
 */

const PROBE_KEY = "__X_storage_test__";

/** Minimal in-memory Storage implementation used when localStorage is unavailable. */
export class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    const value = this.store.get(key);
    return value === undefined ? null : value;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

/**
 * Returns the browser's localStorage when available, or a MemoryStorage
 * fallback otherwise (SSR, Safari private mode, storage quota exceeded).
 *
 * The result is cached after the first call so the probe runs at most once
 * per module lifetime.
 */
let cached: Storage | null = null;

export function getSafeStorage(): Storage {
  if (cached !== null) return cached;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PROBE_KEY, "1");
      window.localStorage.removeItem(PROBE_KEY);
      cached = window.localStorage;
      return cached;
    } catch {
      // localStorage unavailable (Safari private mode, quota exceeded, etc.)
    }
  }

  cached = new MemoryStorage();
  return cached;
}

/**
 * Resets the cached storage adapter. Intended for use in tests only.
 */
export function resetSafeStorageCache(): void {
  cached = null;
}
