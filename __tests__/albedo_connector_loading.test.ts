import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AlbedoLoadingManager,
  albedoLoading,
  connectWithAlbedoLoading,
  getAddressWithAlbedoLoading,
  runAlbedoPopupWithLoading,
  signWithAlbedoLoading,
  submitWithAlbedoLoading,
  withAlbedoLoading,
} from "@/app/lib/albedo_connector";

describe("albedo_connector loading spinner states", () => {
  let manager: AlbedoLoadingManager;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    manager = new AlbedoLoadingManager();
    albedoLoading.reset();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    albedoLoading.reset();
  });

  it("defaults to not loading", () => {
    expect(manager.getState()).toEqual({
      isLoading: false,
      pendingCount: 0,
      activeOperation: null,
    });
  });

  it("starts the spinner when execution begins", async () => {
    let resolveFn!: (value: string) => void;
    const deferred = new Promise<string>((resolve) => {
      resolveFn = resolve;
    });

    const states: boolean[] = [];
    manager.subscribe((s) => states.push(s.isLoading));

    const runPromise = manager.runWithLoading("sign", () => deferred);

    expect(manager.getState().isLoading).toBe(true);
    expect(manager.getState().activeOperation).toBe("sign");
    expect(states).toContain(true);

    resolveFn("signed");
    await expect(runPromise).resolves.toBe("signed");
  });

  it("keeps the spinner active during async execution", async () => {
    let resolveFn!: (value: string) => void;
    const deferred = new Promise<string>((resolve) => {
      resolveFn = resolve;
    });

    const runPromise = withAlbedoLoading("connect", () => deferred, manager);

    expect(manager.getState().isLoading).toBe(true);
    expect(manager.getState().pendingCount).toBe(1);

    // Still loading before settlement.
    await Promise.resolve();
    expect(manager.getState().isLoading).toBe(true);

    resolveFn("GADDRESS");
    await runPromise;
    expect(manager.getState().isLoading).toBe(false);
  });

  it("stops the spinner after success", async () => {
    const result = await signWithAlbedoLoading(
      async () => "signed-xdr",
      manager
    );
    expect(result).toBe("signed-xdr");
    expect(manager.getState().isLoading).toBe(false);
    expect(manager.getState().pendingCount).toBe(0);
    expect(manager.getState().activeOperation).toBeNull();
  });

  it("stops the spinner after failure", async () => {
    await expect(
      submitWithAlbedoLoading(async () => {
        throw new Error("submit failed");
      }, manager)
    ).rejects.toThrow("submit failed");

    expect(manager.getState().isLoading).toBe(false);
    expect(manager.getState().pendingCount).toBe(0);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("stops the spinner after user cancellation", async () => {
    await expect(
      runAlbedoPopupWithLoading(async () => {
        throw new Error("user cancelled albedo popup");
      }, manager)
    ).rejects.toThrow(/cancelled/i);

    expect(manager.getState().isLoading).toBe(false);
    expect(manager.getState().activeOperation).toBeNull();
  });

  it("does not leave the spinner stuck when an exception occurs", async () => {
    await expect(
      connectWithAlbedoLoading(async () => {
        throw new Error("popup closed");
      }, manager)
    ).rejects.toThrow("popup closed");

    expect(manager.getState()).toEqual({
      isLoading: false,
      pendingCount: 0,
      activeOperation: null,
    });
  });

  it("handles non-Error thrown values and still clears loading", async () => {
    await expect(
      getAddressWithAlbedoLoading(async () => {
        throw "string-failure";
      }, manager)
    ).rejects.toBe("string-failure");

    expect(manager.getState().isLoading).toBe(false);
  });

  it("keeps spinner consistent across overlapping concurrent operations", async () => {
    let resolveA!: () => void;
    let resolveB!: () => void;
    const a = new Promise<void>((resolve) => {
      resolveA = resolve;
    });
    const b = new Promise<void>((resolve) => {
      resolveB = resolve;
    });

    const p1 = manager.runWithLoading("sign", () => a.then(() => "a"));
    const p2 = manager.runWithLoading("submit", () => b.then(() => "b"));

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

  it("notifies subscribers of loading transitions", async () => {
    const seen: boolean[] = [];
    const unsubscribe = manager.subscribe((s) => {
      seen.push(s.isLoading);
    });

    await manager.runWithLoading("other", async () => "ok");

    expect(seen[0]).toBe(false); // initial
    expect(seen).toContain(true);
    expect(seen[seen.length - 1]).toBe(false);

    unsubscribe();
  });

  it("shared albedoLoading singleton supports withAlbedoLoading", async () => {
    expect(albedoLoading.getState().isLoading).toBe(false);
    await withAlbedoLoading("popup", async () => "done");
    expect(albedoLoading.getState().isLoading).toBe(false);
  });
});
