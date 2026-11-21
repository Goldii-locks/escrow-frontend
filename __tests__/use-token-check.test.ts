// @vitest-environment jsdom
/**
 * Unit tests for app/(app)/create/useTokenCheck.ts (issue #864).
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── module mocks (hoisted before imports of the hook) ────────────────────────

// Use vi.hoisted so the constant is available inside the vi.mock factory,
// which is hoisted to the top of the file before variable declarations.
const { FACTORY, factoryConfig } = vi.hoisted(() => ({
  FACTORY: "CFACTORY000000000000000000000000000000000000000000000001",
  factoryConfig: { id: "CFACTORY000000000000000000000000000000000000000000000001" },
}));

// No legacy CONTRACT_ID (#836): the factory is the only source of tokens.
// A getter so a test can simulate a deployment without a factory.
vi.mock("@/app/lib/transactions", () => ({
  get FACTORY_CONTRACT_ID() {
    return factoryConfig.id;
  },
}));

const mockFetchWhitelistedTokens = vi.fn();
vi.mock("@/app/lib/whitelist", () => ({
  fetchWhitelistedTokens: (...args: unknown[]) => mockFetchWhitelistedTokens(...args),
}));

const mockValidateTokenContract = vi.fn();
vi.mock("@/app/lib/token_validation", () => ({
  validateTokenContract: (...args: unknown[]) => mockValidateTokenContract(...args),
}));

// ── import hook after mocks ───────────────────────────────────────────────────
import { NO_FACTORY_WHITELIST_ERROR, useTokenCheck } from "@/app/(app)/create/useTokenCheck";

// ── constants ─────────────────────────────────────────────────────────────────

/** Well-formed Stellar contract addresses (C + 55 base32 chars). Generated with StrKey.encodeContract. */
const VALID_TOKEN = "CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526";
const LISTED_TOKEN = "CABAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAFNSZ";

const WHITELIST = [{ address: LISTED_TOKEN, symbol: "USDC" }];

// ── helpers ───────────────────────────────────────────────────────────────────

function resolveWhitelist(tokens = WHITELIST) {
  mockFetchWhitelistedTokens.mockResolvedValueOnce(tokens);
}

function rejectWhitelist(msg = "Network error") {
  mockFetchWhitelistedTokens.mockRejectedValueOnce(new Error(msg));
}

/** Flush all timers AND async microtasks so React state settles.
 * Called twice to handle effects that re-queue timers after a state update
 * (e.g., debounce effect that starts after the whitelist fetch resolves). */
async function flushAll() {
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  // A second pass catches timers queued by effects that ran during the first flush.
  await act(async () => {
    await vi.runAllTimersAsync();
  });
}

// ── setup/teardown ────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  factoryConfig.id = FACTORY;
  mockFetchWhitelistedTokens.mockReset();
  mockValidateTokenContract.mockReset();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("useTokenCheck — whitelist fetch on mount", () => {
  it("populates whitelist after a successful fetch", async () => {
    resolveWhitelist();
    const { result } = renderHook(() => useTokenCheck(""));

    expect(result.current.whitelistLoading).toBe(true);
    await flushAll();

    expect(result.current.whitelistLoading).toBe(false);
    expect(result.current.whitelist).toEqual(WHITELIST);
    expect(result.current.whitelistError).toBeNull();
  });

  it("sets whitelistError when the fetch fails", async () => {
    rejectWhitelist("500 Server Error");
    const { result } = renderHook(() => useTokenCheck(""));

    await flushAll();

    expect(result.current.whitelistLoading).toBe(false);
    expect(result.current.whitelist).toEqual([]);
    expect(result.current.whitelistError).toMatch(/whitelist/i);
  });

  it("passes the factory contract ID to fetchWhitelistedTokens", async () => {
    resolveWhitelist();
    renderHook(() => useTokenCheck(""));

    await flushAll();

    expect(mockFetchWhitelistedTokens).toHaveBeenCalledWith(
      FACTORY,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("has no legacy contract fallback when no factory is configured (#836)", async () => {
    factoryConfig.id = "";
    const { result } = renderHook(() => useTokenCheck(""));

    await flushAll();

    expect(mockFetchWhitelistedTokens).not.toHaveBeenCalled();
    expect(result.current.whitelistLoading).toBe(false);
    expect(result.current.whitelistError).toBe(NO_FACTORY_WHITELIST_ERROR);
  });
});

describe("useTokenCheck — listed flag", () => {
  it("listed is true when the current token is on the whitelist", async () => {
    resolveWhitelist();
    const { result } = renderHook(() => useTokenCheck(LISTED_TOKEN));

    await flushAll();

    expect(result.current.listed).toBe(true);
    expect(result.current.status.whitelisted).toBe(true);
  });

  it("listed is false for a token not on the whitelist", async () => {
    resolveWhitelist();
    const { result } = renderHook(() => useTokenCheck(VALID_TOKEN));

    await flushAll();

    expect(result.current.listed).toBe(false);
  });
});

describe("useTokenCheck — debounced token validation", () => {
  it("does not call validateTokenContract before the debounce delay", async () => {
    resolveWhitelist();
    renderHook(() => useTokenCheck(VALID_TOKEN));

    // Flush the whitelist fetch microtask but not the debounce timer.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    // Advance less than the full debounce (500 ms).
    await act(async () => {
      vi.advanceTimersByTime(499);
    });

    expect(mockValidateTokenContract).not.toHaveBeenCalled();
  });

  it("calls validateTokenContract exactly once after the debounce delay", async () => {
    resolveWhitelist();
    mockValidateTokenContract.mockResolvedValueOnce({ valid: true, symbol: "TKN", decimals: 7 });

    const { result } = renderHook(() => useTokenCheck(VALID_TOKEN));

    await flushAll();

    expect(mockValidateTokenContract).toHaveBeenCalledTimes(1);
    expect(mockValidateTokenContract).toHaveBeenCalledWith(VALID_TOKEN);
    expect(result.current.status.validating).toBe(false);
  });

  it("rapid token changes collapse to a single validation call", async () => {
    resolveWhitelist([]);
    mockValidateTokenContract.mockResolvedValue({ valid: true, symbol: "X", decimals: 7 });

    const TOKEN2 = "CABQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGCK3";
    const TOKEN3 = "CACAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAINCW";

    let token = VALID_TOKEN;
    const { rerender } = renderHook(() => useTokenCheck(token));

    // Advance only partially, then switch token twice.
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    token = TOKEN2;
    rerender();
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    token = TOKEN3;
    rerender();
    // Now allow the debounce for the final token to fire.
    await flushAll();

    // Only the last token triggers a validation call.
    expect(mockValidateTokenContract).toHaveBeenCalledTimes(1);
    expect(mockValidateTokenContract).toHaveBeenCalledWith(TOKEN3);
  });

  it("sets status.validation after a successful validation", async () => {
    resolveWhitelist([]);
    const validResult = { valid: true, symbol: "TKN", decimals: 7 };
    mockValidateTokenContract.mockResolvedValueOnce(validResult);

    const { result } = renderHook(() => useTokenCheck(VALID_TOKEN));
    await flushAll();

    expect(result.current.status.validation).toEqual(validResult);
  });

  it("sets status.validation.valid=false after a failed validation", async () => {
    resolveWhitelist([]);
    mockValidateTokenContract.mockResolvedValueOnce({
      valid: false,
      error: "Not a SEP-41 token",
    });

    const { result } = renderHook(() => useTokenCheck(VALID_TOKEN));
    await flushAll();

    expect(result.current.status.validation?.valid).toBe(false);
  });

  it("sets status.validation on validateTokenContract throw", async () => {
    resolveWhitelist([]);
    mockValidateTokenContract.mockRejectedValueOnce(new Error("RPC down"));

    const { result } = renderHook(() => useTokenCheck(VALID_TOKEN));
    await flushAll();

    expect(result.current.status.validation?.valid).toBe(false);
    expect(result.current.status.validation?.error).toMatch(/validate/i);
  });

  it("does not trigger validation for a listed token", async () => {
    // The whitelist fetch must resolve BEFORE the debounce fires, otherwise
    // `listed` is still false at timer tick and validation runs unnecessarily.
    // Strategy: resolve the whitelist first (without advancing timers),
    // then advance the debounce timer.
    resolveWhitelist(WHITELIST);
    renderHook(() => useTokenCheck(LISTED_TOKEN));

    // Flush only microtasks (the whitelist fetch promise) without advancing timers.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Now the whitelist is loaded → listed=true → needsValidation=false.
    // Advance past the full debounce — validation must NOT be called.
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(mockValidateTokenContract).not.toHaveBeenCalled();
  });

  it("does not trigger validation for a token that doesn't match the contract pattern", async () => {
    resolveWhitelist([]);
    renderHook(() => useTokenCheck("not-a-contract"));

    await flushAll();

    expect(mockValidateTokenContract).not.toHaveBeenCalled();
  });
});

describe("useTokenCheck — race condition", () => {
  it("a slow response for an old token does not overwrite the result for the newer token", async () => {
    resolveWhitelist([]);

    const TOKEN_OLD = "CADAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMBQGAYDAMSST";
    const TOKEN_NEW = "CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR";

    // The old token's validation resolves late; the new token's resolves immediately.
    let resolveOld!: (v: unknown) => void;
    const slowPromise = new Promise((res) => {
      resolveOld = res;
    });
    mockValidateTokenContract
      .mockImplementationOnce(() => slowPromise) // TOKEN_OLD — slow
      .mockResolvedValueOnce({ valid: true, symbol: "NEW", decimals: 7 }); // TOKEN_NEW — fast

    let token = TOKEN_OLD;
    const { result, rerender } = renderHook(() => useTokenCheck(token));

    // Fire the debounce for TOKEN_OLD.
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Switch to TOKEN_NEW before the old one resolves.
    token = TOKEN_NEW;
    rerender();

    // Fire the debounce for TOKEN_NEW and flush all microtasks.
    await flushAll();

    // TOKEN_NEW's validation result should now be settled.
    expect(result.current.status.validation?.symbol).toBe("NEW");
    expect(result.current.status.token).toBe(TOKEN_NEW);

    // Now resolve the stale TOKEN_OLD response.
    await act(async () => {
      resolveOld({ valid: false, error: "old token" });
      await Promise.resolve();
      await Promise.resolve();
    });

    // The result must still belong to TOKEN_NEW.
    expect(result.current.status.validation?.symbol).toBe("NEW");
    expect(result.current.status.token).toBe(TOKEN_NEW);
  });
});

describe("useTokenCheck — confirmation flow", () => {
  it("confirmed starts as false", async () => {
    resolveWhitelist([]);
    mockValidateTokenContract.mockResolvedValueOnce({ valid: true, symbol: "X", decimals: 7 });

    const { result } = renderHook(() => useTokenCheck(VALID_TOKEN));
    await flushAll();

    expect(result.current.status.confirmed).toBe(false);
  });

  it("setConfirmed(true) sets confirmed for the current token", async () => {
    resolveWhitelist([]);
    mockValidateTokenContract.mockResolvedValueOnce({ valid: true, symbol: "X", decimals: 7 });

    const { result } = renderHook(() => useTokenCheck(VALID_TOKEN));
    await flushAll();

    act(() => {
      result.current.setConfirmed(true);
    });

    expect(result.current.status.confirmed).toBe(true);
  });

  it("setConfirmed(false) clears the confirmation", async () => {
    resolveWhitelist([]);
    mockValidateTokenContract.mockResolvedValueOnce({ valid: true, symbol: "X", decimals: 7 });

    const { result } = renderHook(() => useTokenCheck(VALID_TOKEN));
    await flushAll();

    act(() => {
      result.current.setConfirmed(true);
    });
    act(() => {
      result.current.setConfirmed(false);
    });

    expect(result.current.status.confirmed).toBe(false);
  });

  it("changing the token clears confirmation even though state is not reset", async () => {
    resolveWhitelist([]);
    const TOKEN2 = "CACQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQKBIFAUCQLC2U";
    mockValidateTokenContract.mockResolvedValue({ valid: true, symbol: "X", decimals: 7 });

    let token = VALID_TOKEN;
    const { result, rerender } = renderHook(() => useTokenCheck(token));
    await flushAll();

    act(() => {
      result.current.setConfirmed(true);
    });
    expect(result.current.status.confirmed).toBe(true);

    token = TOKEN2;
    rerender();

    // Confirmation is keyed by token, so for the new token it's false.
    expect(result.current.status.confirmed).toBe(false);
  });
});

describe("useTokenCheck — unmount cleanup", () => {
  it("aborts the in-flight whitelist request on unmount", async () => {
    let capturedSignal: AbortSignal | undefined;
    mockFetchWhitelistedTokens.mockImplementationOnce(
      (_id: string, opts: { signal?: AbortSignal }) => {
        capturedSignal = opts?.signal;
        // Never resolves during the test.
        return new Promise(() => {});
      }
    );

    const { unmount } = renderHook(() => useTokenCheck(""));

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });

  it("does not update state after unmount (no pending timer crash)", async () => {
    resolveWhitelist([]);
    mockValidateTokenContract.mockResolvedValueOnce({ valid: true, symbol: "X", decimals: 7 });

    const { unmount } = renderHook(() => useTokenCheck(VALID_TOKEN));

    // Advance timers partially so the debounce is queued.
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Unmount before the debounce fires.
    unmount();

    // Fire all remaining timers; should not throw.
    await expect(flushAll()).resolves.not.toThrow();
  });
});
