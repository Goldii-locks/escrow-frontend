/**
 * Unit tests for app/lib/wallet_loader.ts
 *
 * Verifies the loader-overlay subscription pair and withWalletLoader helper
 * that were extracted from wallet_state_context.ts.
 */
import { describe, expect, it } from "vitest";
import {
  endWalletOperation,
  isWalletLoading,
  startWalletOperation,
  subscribeToWalletLoading,
  withWalletLoader,
} from "@/app/lib/wallet_loader";

describe("wallet_loader — subscribeToWalletLoading", () => {
  it("emits the current state (false) immediately on subscribe", () => {
    const states: boolean[] = [];
    const unsub = subscribeToWalletLoading((v) => states.push(v));
    expect(states).toEqual([false]);
    unsub();
  });

  it("emits true when a wallet operation starts and false when it ends", () => {
    const states: boolean[] = [];
    const unsub = subscribeToWalletLoading((v) => states.push(v));
    startWalletOperation();
    endWalletOperation();
    // initial false + true on start + false on end
    expect(states).toEqual([false, true, false]);
    unsub();
  });

  it("unsubscribing stops further notifications", () => {
    const states: boolean[] = [];
    const unsub = subscribeToWalletLoading((v) => states.push(v));
    unsub();
    startWalletOperation();
    endWalletOperation();
    // only the initial notification before unsubscribe
    expect(states).toEqual([false]);
  });

  it("isWalletLoading reflects the operation count", () => {
    expect(isWalletLoading()).toBe(false);
    startWalletOperation();
    expect(isWalletLoading()).toBe(true);
    endWalletOperation();
    expect(isWalletLoading()).toBe(false);
  });

  it("endWalletOperation never goes below zero", () => {
    endWalletOperation(); // extra end
    expect(isWalletLoading()).toBe(false);
  });
});

describe("wallet_loader — withWalletLoader", () => {
  it("resolves with the wrapped function's return value", async () => {
    const result = await withWalletLoader(async () => 42);
    expect(result).toBe(42);
  });

  it("notifies true then false around a successful call", async () => {
    const states: boolean[] = [];
    const unsub = subscribeToWalletLoading((v) => states.push(v));
    await withWalletLoader(async () => "ok");
    expect(states).toEqual([false, true, false]);
    unsub();
  });

  it("notifies false even when the wrapped call throws", async () => {
    const states: boolean[] = [];
    const unsub = subscribeToWalletLoading((v) => states.push(v));
    await expect(
      withWalletLoader(async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    expect(states).toEqual([false, true, false]);
    unsub();
  });
});
