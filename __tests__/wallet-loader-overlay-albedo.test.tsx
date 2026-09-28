import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AlbedoLoadingManager } from "@/app/lib/albedo_connector";

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("WalletLoaderOverlay — Albedo integration", () => {
  it("overlay component exists and can be imported", async () => {
    const mod = await import(
      "@/app/components/WalletLoaderOverlay"
    );
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("AlbedoLoadingManager subscribe notifies listeners of loading state", () => {
    const manager = new AlbedoLoadingManager();
    const states: boolean[] = [];
    const unsub = manager.subscribe((s) => states.push(s.isLoading));

    expect(states).toEqual([false]);

    unsub();
    manager.reset();
  });

  it("AlbedoLoadingManager triggers loading transitions on runWithLoading", async () => {
    const manager = new AlbedoLoadingManager();
    const states: boolean[] = [];
    const unsub = manager.subscribe((s) => states.push(s.isLoading));

    let resolveFn!: () => void;
    const deferred = new Promise<void>((resolve) => {
      resolveFn = resolve;
    });

    const promise = manager.runWithLoading("sign", () => deferred);

    expect(states).toContain(true);

    resolveFn();
    await promise;

    expect(states[states.length - 1]).toBe(false);
    unsub();
    manager.reset();
  });

  it("AlbedoLoadingManager clears loading after error", async () => {
    const manager = new AlbedoLoadingManager();

    await expect(
      manager.runWithLoading("popup", () => {
        throw new Error("popup closed");
      })
    ).rejects.toThrow("popup closed");

    expect(manager.getState().isLoading).toBe(false);
    expect(manager.getState().pendingCount).toBe(0);
  });

  it("AlbedoLoadingManager clears loading after user rejection", async () => {
    const manager = new AlbedoLoadingManager();

    await expect(
      manager.runWithLoading("sign", () => {
        throw new Error("user rejected transaction");
      })
    ).rejects.toThrow("user rejected");

    expect(manager.getState().isLoading).toBe(false);
  });

  it("concurrent Albedo operations maintain reference count", async () => {
    const manager = new AlbedoLoadingManager();

    let resolveA!: () => void;
    let resolveB!: () => void;
    const a = new Promise<void>((resolve) => {
      resolveA = resolve;
    });
    const b = new Promise<void>((resolve) => {
      resolveB = resolve;
    });

    const p1 = manager.runWithLoading("sign", () => a);
    const p2 = manager.runWithLoading("submit", () => b);

    expect(manager.getState().isLoading).toBe(true);
    expect(manager.getState().pendingCount).toBe(2);

    resolveA();
    await p1;
    expect(manager.getState().isLoading).toBe(true);
    expect(manager.getState().pendingCount).toBe(1);

    resolveB();
    await p2;
    expect(manager.getState().isLoading).toBe(false);
    expect(manager.getState().pendingCount).toBe(0);
  });
});
