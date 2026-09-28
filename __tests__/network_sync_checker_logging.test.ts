import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatConsoleWarningBlock,
  formatStackTrace,
  logNetworkSyncWarning,
  networkSyncTracker,
  runNetworkSyncSign,
  validateNetworkSyncWithSignature,
} from "@/app/lib/network_sync_checker";

const LOG_PREFIX = "[network_sync_checker]";

describe("network_sync_checker formatted console output", () => {
  beforeEach(() => {
    networkSyncTracker.clear();
  });

  describe("formatStackTrace", () => {
    it("returns the real stack of an Error", () => {
      const stack = formatStackTrace(new Error("boom"));
      expect(stack).toContain("Error: boom");
      expect(stack).toContain("\n");
    });

    it("keeps multi-line strings as-is", () => {
      const lines = "line one\nline two";
      expect(formatStackTrace(lines)).toBe(lines);
    });

    it("synthesizes a stack for primitives and single-line values", () => {
      expect(formatStackTrace("just a message")).toContain(
        "Error: just a message"
      );
      expect(formatStackTrace(undefined)).toContain("network_sync_checker trace");
    });
  });

  describe("formatConsoleWarningBlock", () => {
    it("renders a bordered block with title, body, txId, phase and stack frames", () => {
      const block = formatConsoleWarningBlock({
        title: "TX ERROR",
        body: "signature rejected during network sync",
        stack: "Error: nope\n  at probe (file.ts:1:1)",
        txId: "sync-123",
        phase: "error",
      });

      expect(block).toContain(`${LOG_PREFIX} ╔══`);
      expect(block).toContain(`${LOG_PREFIX} ╚══`);
      expect(block).toContain("TX ERROR");
      expect(block).toContain(`${LOG_PREFIX} signature rejected during network sync`);
      expect(block).toContain(`${LOG_PREFIX} txId: sync-123`);
      expect(block).toContain(`${LOG_PREFIX} phase: error`);
      expect(block).toContain(`${LOG_PREFIX} --- stack trace ---`);
      expect(block).toContain(`${LOG_PREFIX}   at probe (file.ts:1:1)`);
      expect(block).toContain(`${LOG_PREFIX} --- end stack ---`);
    });
  });

  describe("logNetworkSyncWarning", () => {
    it("logs a single formatted warning block to the console", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const formatted = logNetworkSyncWarning(
        "NETWORK MISMATCH",
        "wallet availability check failed",
        { phase: "checking" }
      );

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(String(warnSpy.mock.calls[0][0])).toContain(LOG_PREFIX);
      expect(String(warnSpy.mock.calls[0][0])).toContain("NETWORK MISMATCH");
      expect(formatted).toContain(LOG_PREFIX);
      warnSpy.mockRestore();
    });
  });
});

describe("network_sync_checker transaction tracking", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    networkSyncTracker.clear();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("records successful probes without console noise", async () => {
    const result = await runNetworkSyncSign(async () => "signed", vi.fn(), {
      txId: "sync-ok",
    });

    expect(result).toBe("signed");
    expect(warnSpy).not.toHaveBeenCalled();

    const history = networkSyncTracker.getHistory("sync-ok");
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      txId: "sync-ok",
      phase: "success",
      message: "network sync probe signed",
    });
  });

  it("emits one formatted TX ERROR block when the user rejects the probe", async () => {
    const showToast = vi.fn();

    const result = await runNetworkSyncSign(async () => {
      throw new Error("user rejected transaction");
    }, showToast);

    expect(result).toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      "Network sync cancelled — you rejected the signature in your wallet.",
      "warning"
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);

    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain(LOG_PREFIX);
    expect(logged).toContain("TX ERROR");
    expect(logged).toContain("signature rejected during network sync");
    expect(logged).toContain("phase: error");

    const history = networkSyncTracker.getHistory("network-sync-probe");
    expect(history).toHaveLength(1);
    expect(history[0].phase).toBe("error");
  });

  it("emits no tracking block and no warn when a non-rejection error rethrows", async () => {
    await expect(
      runNetworkSyncSign(async () => {
        throw new Error("horizon unreachable");
      }, vi.fn())
    ).rejects.toThrow("horizon unreachable");

    expect(warnSpy).not.toHaveBeenCalled();
    expect(networkSyncTracker.getHistory()).toHaveLength(0);
  });

  it("tracks the out-of-sync failure in validateNetworkSyncWithSignature", async () => {
    const showToast = vi.fn();
    const signFn = vi.fn();

    const result = await validateNetworkSyncWithSignature(
      "mainnet",
      "testnet",
      signFn,
      showToast,
      { txId: "sync-mismatch" }
    );

    expect(result).toBeNull();
    expect(signFn).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/Network out of sync/i),
      "warning"
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);

    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain(LOG_PREFIX);
    expect(logged).toContain("network out of sync");

    const history = networkSyncTracker.getHistory("sync-mismatch");
    expect(history).toHaveLength(1);
    expect(history[0].phase).toBe("error");
  });

  it("records success through validateNetworkSyncWithSignature when aligned", async () => {
    const result = await validateNetworkSyncWithSignature(
      "testnet",
      "testnet",
      async () => "signed",
      vi.fn(),
      { txId: "sync-align" }
    );

    expect(result).toBe("signed");
    expect(warnSpy).not.toHaveBeenCalled();
    expect(networkSyncTracker.getHistory("sync-align")[0].phase).toBe("success");
  });

  it("filters history by txId and clears the tracker", () => {
    networkSyncTracker.track("a", "signing", "start");
    networkSyncTracker.track("b", "signing", "start");

    expect(networkSyncTracker.getHistory("a")).toHaveLength(1);
    expect(networkSyncTracker.getHistory()).toHaveLength(2);

    networkSyncTracker.clear();
    expect(networkSyncTracker.getHistory()).toHaveLength(0);
  });
});