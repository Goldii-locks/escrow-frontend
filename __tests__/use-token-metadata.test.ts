// @vitest-environment jsdom
/**
 * Tests for app/lib/useTokenMetadata (#880).
 *
 * Covers:
 *  - Non-XLM token: resolves correct symbol + decimals (not "XLM"/7).
 *  - 6-decimal token: 500000000 base units → "500" at 6 decimals, not "50" at 7.
 *  - 18-decimal token: scaled correctly without precision loss (BigInt path).
 *  - Loading / failure: shows truncated address, never "XLM".
 *  - Cache: two hook instances with the same token share one validateTokenContract call.
 *  - Failed lookup can be retried (not permanently cached).
 *  - Native XLM address: returns "XLM" / 7 without any RPC call.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock validateTokenContract before the module is imported ─────────────────

const mockValidateTokenContract = vi.fn();

vi.mock("@/app/lib/token_validation", () => ({
  validateTokenContract: (...args: unknown[]) => mockValidateTokenContract(...args),
}));

// Import after mock is in place.
import {
  clearTokenMetadataCache,
  NATIVE_XLM_CONTRACT,
  NATIVE_XLM_DECIMALS,
  NATIVE_XLM_SYMBOL,
  useTokenMetadata,
} from "@/app/lib/useTokenMetadata";
import { formatBaseUnits } from "@/app/lib/amounts";

// ── Constants ────────────────────────────────────────────────────────────────

const USDC_ADDRESS = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const USDC_6_ADDRESS = "CAMELPFACEKEYCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const TOKEN_18_ADDRESS = "C18DECIMALSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Flush all pending microtasks and state updates. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  mockValidateTokenContract.mockReset();
  clearTokenMetadataCache();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("useTokenMetadata — non-XLM token resolves correctly", () => {
  it("returns the token's own symbol and decimals, not XLM/7", async () => {
    mockValidateTokenContract.mockResolvedValueOnce({
      valid: true,
      symbol: "USDC",
      decimals: 6,
    });

    const { result } = renderHook(() => useTokenMetadata(USDC_ADDRESS));

    // Initial state is loading.
    expect(result.current.status).toBe("loading");

    await flush();

    expect(result.current.status).toBe("ready");
    if (result.current.status === "ready") {
      expect(result.current.symbol).toBe("USDC");
      expect(result.current.symbol).not.toBe("XLM");
      expect(result.current.decimals).toBe(6);
      expect(result.current.decimals).not.toBe(7);
    }
  });
});

describe("useTokenMetadata — 6-decimal token scaling", () => {
  it("500000000 base units formats as 500 at 6 decimals, not 50 at 7", async () => {
    mockValidateTokenContract.mockResolvedValueOnce({
      valid: true,
      symbol: "USDC6",
      decimals: 6,
    });

    const { result } = renderHook(() => useTokenMetadata(USDC_6_ADDRESS));
    await flush();

    expect(result.current.status).toBe("ready");
    if (result.current.status === "ready") {
      expect(result.current.decimals).toBe(6);
      // With 6 decimals: 500000000 / 10^6 = 500
      const formatted6 = formatBaseUnits("500000000", { decimals: result.current.decimals });
      expect(formatted6).toBe("500");

      // Prove the 7-decimal assumption would be wrong.
      const formatted7 = formatBaseUnits("500000000", { decimals: 7 });
      expect(formatted7).toBe("50");
    }
  });
});

describe("useTokenMetadata — 18-decimal token precision", () => {
  it("scales an 18-decimal token correctly without precision loss", async () => {
    mockValidateTokenContract.mockResolvedValueOnce({
      valid: true,
      symbol: "WETH",
      decimals: 18,
    });

    const { result } = renderHook(() => useTokenMetadata(TOKEN_18_ADDRESS));
    await flush();

    expect(result.current.status).toBe("ready");
    if (result.current.status === "ready") {
      expect(result.current.decimals).toBe(18);

      // 1.5 WETH = 1_500_000_000_000_000_000 base units (too large for JS number)
      const baseUnits = "1500000000000000000";
      const formatted = formatBaseUnits(baseUnits, { decimals: result.current.decimals });
      expect(formatted).toBe("1.5");

      // With 7 decimals the same value would be wildly wrong.
      const formatted7 = formatBaseUnits(baseUnits, { decimals: 7 });
      // 1500000000000000000 / 10^7 = 150000000000.0
      expect(formatted7).toBe("150,000,000,000");
    }
  });

  it("handles very large 18-decimal amounts without precision loss (beyond Number.MAX_SAFE_INTEGER)", async () => {
    mockValidateTokenContract.mockResolvedValueOnce({
      valid: true,
      symbol: "BIG18",
      decimals: 18,
    });

    const { result } = renderHook(() => useTokenMetadata(TOKEN_18_ADDRESS));
    await flush();

    if (result.current.status === "ready") {
      // 123456789012345678901234567 base units (way beyond MAX_SAFE_INTEGER)
      const baseUnits = "123456789012345678901234567";
      const formatted = formatBaseUnits(baseUnits, { decimals: 18 });
      // 123456789012345678901234567 / 10^18 = 123456789.012345678901234567
      expect(formatted).toBe("123,456,789.012345678901234567");
    }
  });
});

describe("useTokenMetadata — loading state", () => {
  it("shows loading status while metadata is in flight, never XLM", async () => {
    let resolve!: (v: unknown) => void;
    mockValidateTokenContract.mockImplementationOnce(() => new Promise((r) => (resolve = r)));

    const { result } = renderHook(() => useTokenMetadata(USDC_ADDRESS));

    // Must be loading while the promise is pending.
    expect(result.current.status).toBe("loading");

    // Resolve so cleanup works.
    await act(async () => {
      resolve({ valid: true, symbol: "USDC", decimals: 6 });
      await Promise.resolve();
    });
  });

  it("loading status has no symbol or decimals field", async () => {
    let resolve!: (v: unknown) => void;
    mockValidateTokenContract.mockImplementationOnce(() => new Promise((r) => (resolve = r)));

    const { result } = renderHook(() => useTokenMetadata(USDC_ADDRESS));

    expect(result.current.status).toBe("loading");
    expect(result.current).not.toHaveProperty("symbol");
    expect(result.current).not.toHaveProperty("decimals");

    await act(async () => {
      resolve({ valid: true, symbol: "USDC", decimals: 6 });
      await Promise.resolve();
    });
  });
});

describe("useTokenMetadata — failure state", () => {
  it("returns error state with truncated address, never XLM, on validateTokenContract invalid result", async () => {
    mockValidateTokenContract.mockResolvedValueOnce({
      valid: false,
      error: "Not a SEP-41 token",
    });

    const { result } = renderHook(() => useTokenMetadata(USDC_ADDRESS));
    await flush();

    expect(result.current.status).toBe("error");
    if (result.current.status === "error") {
      // Must contain some part of the address, never "XLM".
      expect(result.current.truncatedAddress).not.toBe("XLM");
      expect(result.current.truncatedAddress).toContain("…");
      // Should start with the first 4 chars of the address.
      expect(result.current.truncatedAddress.startsWith(USDC_ADDRESS.slice(0, 4))).toBe(true);
    }
  });

  it("returns error state when validateTokenContract throws", async () => {
    mockValidateTokenContract.mockRejectedValueOnce(new Error("RPC down"));

    const { result } = renderHook(() => useTokenMetadata(USDC_ADDRESS));
    await flush();

    expect(result.current.status).toBe("error");
    if (result.current.status === "error") {
      expect(result.current.truncatedAddress).not.toBe("XLM");
    }
  });
});

describe("useTokenMetadata — cache: shared lookup for same address", () => {
  it("two hook instances with the same token trigger only one validateTokenContract call", async () => {
    mockValidateTokenContract.mockResolvedValue({
      valid: true,
      symbol: "SHARE",
      decimals: 6,
    });

    const { result: r1 } = renderHook(() => useTokenMetadata(USDC_ADDRESS));
    const { result: r2 } = renderHook(() => useTokenMetadata(USDC_ADDRESS));

    await flush();

    expect(r1.current.status).toBe("ready");
    expect(r2.current.status).toBe("ready");

    // Only one RPC call despite two hook instances.
    expect(mockValidateTokenContract).toHaveBeenCalledTimes(1);
  });

  it("resolved value is immediately available to a new hook instance (cache hit)", async () => {
    mockValidateTokenContract.mockResolvedValueOnce({
      valid: true,
      symbol: "CACHED",
      decimals: 8,
    });

    // First instance populates the cache.
    const { result: r1 } = renderHook(() => useTokenMetadata(USDC_ADDRESS));
    await flush();
    expect(r1.current.status).toBe("ready");

    // Second instance renders — must start ready from cache without an RPC call.
    const { result: r2 } = renderHook(() => useTokenMetadata(USDC_ADDRESS));

    // Synchronous initial state should already be "ready" since the cache is warm.
    expect(r2.current.status).toBe("ready");
    if (r2.current.status === "ready") {
      expect(r2.current.symbol).toBe("CACHED");
    }

    // Still only one call total.
    expect(mockValidateTokenContract).toHaveBeenCalledTimes(1);
  });
});

describe("useTokenMetadata — failed lookup is retryable", () => {
  it("a failed lookup does NOT persist in the cache, allowing a retry on remount", async () => {
    // First attempt fails.
    mockValidateTokenContract.mockResolvedValueOnce({ valid: false, error: "RPC error" });

    const { result: r1, unmount } = renderHook(() => useTokenMetadata(USDC_ADDRESS));
    await flush();

    expect(r1.current.status).toBe("error");
    unmount();

    // Clear the mock count, then set up a successful response.
    mockValidateTokenContract.mockResolvedValueOnce({
      valid: true,
      symbol: "RETRY",
      decimals: 6,
    });

    // Second mount — the failure was not cached so a new lookup fires.
    const { result: r2 } = renderHook(() => useTokenMetadata(USDC_ADDRESS));
    await flush();

    expect(r2.current.status).toBe("ready");
    if (r2.current.status === "ready") {
      expect(r2.current.symbol).toBe("RETRY");
    }
    // Two total calls: one failure + one success.
    expect(mockValidateTokenContract).toHaveBeenCalledTimes(2);
  });
});

describe("useTokenMetadata — native XLM", () => {
  it("resolves instantly as XLM / 7 for the native XLM contract address", async () => {
    const { result } = renderHook(() => useTokenMetadata(NATIVE_XLM_CONTRACT));

    // Must be ready synchronously (no RPC call needed for native).
    expect(result.current.status).toBe("ready");
    if (result.current.status === "ready") {
      expect(result.current.symbol).toBe(NATIVE_XLM_SYMBOL);
      expect(result.current.decimals).toBe(NATIVE_XLM_DECIMALS);
    }

    // No RPC call should have been made.
    expect(mockValidateTokenContract).not.toHaveBeenCalled();
  });

  it("native XLM: 7 decimals, 1 XLM = 10000000 stroops", async () => {
    const { result } = renderHook(() => useTokenMetadata(NATIVE_XLM_CONTRACT));

    expect(result.current.status).toBe("ready");
    if (result.current.status === "ready") {
      expect(result.current.decimals).toBe(7);
      const formatted = formatBaseUnits("10000000", { decimals: result.current.decimals });
      expect(formatted).toBe("1");
    }
  });
});

describe("useTokenMetadata — preloaded job metadata", () => {
  it("uses job-provided symbol and decimals without any RPC call", async () => {
    const { result } = renderHook(() =>
      useTokenMetadata(USDC_ADDRESS, { symbol: "JOBUSDC", decimals: 6 })
    );

    // Synchronously ready — no async work needed.
    expect(result.current.status).toBe("ready");
    if (result.current.status === "ready") {
      expect(result.current.symbol).toBe("JOBUSDC");
      expect(result.current.decimals).toBe(6);
    }

    expect(mockValidateTokenContract).not.toHaveBeenCalled();
  });
});

describe("useTokenMetadata — undefined tokenAddress", () => {
  it("returns loading when tokenAddress is undefined", () => {
    const { result } = renderHook(() => useTokenMetadata(undefined));
    expect(result.current.status).toBe("loading");
    expect(mockValidateTokenContract).not.toHaveBeenCalled();
  });
});
