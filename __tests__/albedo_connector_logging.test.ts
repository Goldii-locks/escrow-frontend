import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  albedoTracker,
  AlbedoTransactionTracker,
  formatConsoleWarningBlock,
  formatStackTrace,
  logAlbedoError,
  logAlbedoWarning,
  sanitizeAlbedoLogText,
  trackAlbedoLifecycle,
} from "@/app/lib/albedo_connector";

describe("albedo_connector stack / warning formatting", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    albedoTracker.clear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    albedoTracker.clear();
  });

  it("formats stack traces from Error instances", () => {
    const err = new Error("albedo sign failed");
    const stack = formatStackTrace(err);

    expect(stack).toContain("Error: albedo sign failed");
    expect(stack).toMatch(/at /);
  });

  it("synthesizes a stack when no Error is provided", () => {
    const stack = formatStackTrace();
    expect(stack).toContain("Error:");
    expect(stack.split("\n").length).toBeGreaterThan(1);
  });

  it("synthesizes a stack from a plain string message", () => {
    const stack = formatStackTrace("something went wrong");
    expect(stack).toContain("something went wrong");
  });

  it("returns multi-line strings directly as stack traces", () => {
    const multiLine = "Error: custom\n  at foo (bar.ts:1:1)";
    expect(formatStackTrace(multiLine)).toBe(multiLine);
  });

  it("builds a warning block with prefix, tx tracking, and stack delimiters", () => {
    const stack = formatStackTrace(new Error("tx debug"));
    const block = formatConsoleWarningBlock({
      title: "TX SIGNING",
      body: "Awaiting Albedo popup signature",
      stack,
      txId: "tx-abc",
      txHash: "hash-123",
      phase: "signing",
      network: "testnet",
      operationType: "payment",
    });

    expect(block).toContain("[albedo_connector]");
    expect(block).toContain("TX SIGNING");
    expect(block).toContain("Awaiting Albedo popup signature");
    expect(block).toContain("txId: tx-abc");
    expect(block).toContain("txHash: hash-123");
    expect(block).toContain("phase: signing");
    expect(block).toContain("network: testnet");
    expect(block).toContain("operation: payment");
    expect(block).toContain("--- stack trace ---");
    expect(block).toContain("--- end stack ---");
    expect(block).toContain("Error: tx debug");
  });

  it("logs formatted warnings via console.warn with stack preserved", () => {
    const formatted = logAlbedoWarning("TX ERROR", "Submission failed", {
      err: new Error("network down"),
      txId: "tx-1",
      phase: "error",
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(formatted);
    expect(formatted).toMatch(/--- stack trace ---[\s\S]*Error: network down/);
  });

  it("logs failures via console.error and keeps the Error object for stack", () => {
    const err = new Error("popup failed");
    const formatted = logAlbedoError("TX ERROR", "Albedo popup failed", {
      err,
      txId: "tx-err",
      phase: "error",
      network: "testnet",
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toBe(formatted);
    expect(errorSpy.mock.calls[0][1]).toBe(err);
    expect(formatted).toContain("--- stack trace ---");
    expect(formatted).toContain("Error: popup failed");
  });

  it("handles non-Error thrown values in error logging", () => {
    const formatted = logAlbedoError("TX ERROR", "Unexpected throw", {
      err: "string-failure",
      phase: "error",
    });

    expect(errorSpy).toHaveBeenCalledWith(formatted, "string-failure");
    expect(formatted).toContain("string-failure");
  });
});

describe("albedo_connector sensitive information handling", () => {
  it("redacts secret-key shaped values from log text", () => {
    const secret = `S${"A".repeat(55)}`;
    const labeled = sanitizeAlbedoLogText(
      `payload secret=${secret} privateKey=abc seed=xyz`
    );
    const bare = sanitizeAlbedoLogText(`leaked key ${secret}`);

    expect(labeled).not.toContain(secret);
    expect(labeled).toMatch(/secret=\[REDACTED\]/i);
    expect(labeled).toMatch(/privateKey=\[REDACTED\]/i);
    expect(labeled).toMatch(/seed=\[REDACTED\]/i);
    expect(bare).not.toContain(secret);
    expect(bare).toContain("[REDACTED_SECRET]");
  });

  it("does not include secret material in formatted console blocks", () => {
    const secret = `S${"B".repeat(55)}`;
    const block = formatConsoleWarningBlock({
      title: "SAFE LOG",
      body: `do not leak ${secret}`,
      stack: formatStackTrace(new Error("ok")),
    });

    expect(block).not.toContain(secret);
    expect(block).toContain("[REDACTED_SECRET]");
  });
});

describe("albedo_connector transaction lifecycle tracking", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    albedoTracker.clear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    albedoTracker.clear();
  });

  it("tracks lifecycle phases and preserves stack traces", () => {
    const tracker = new AlbedoTransactionTracker();

    tracker.track("tx-10", "building", "Preparing XDR");
    tracker.track("tx-10", "popup", "Opening Albedo");
    tracker.track("tx-10", "signing", "Awaiting signature");
    tracker.track("tx-10", "signed", "Signature received", {
      txHash: undefined,
    });
    tracker.track("tx-10", "submitting", "Broadcasting", {
      txHash: "abc",
      network: "testnet",
      operationType: "payment",
    });
    tracker.track(
      "tx-10",
      "error",
      "Albedo popup closed",
      { err: new Error("popup closed") }
    );

    const history = tracker.getHistory("tx-10");
    expect(history).toHaveLength(6);
    expect(history.map((e) => e.phase)).toEqual([
      "building",
      "popup",
      "signing",
      "signed",
      "submitting",
      "error",
    ]);
    expect(history[5].stack).toContain("Error: popup closed");
    expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(errorSpy).toHaveBeenCalled();

    const errorCall = String(errorSpy.mock.calls[0][0]);
    expect(errorCall).toContain("[albedo_connector]");
    expect(errorCall).toContain("TX ERROR");
    expect(errorCall).toContain("--- stack trace ---");
  });

  it("logs cancellations as warnings", () => {
    trackAlbedoLifecycle("tx-c", "cancelled", "User closed Albedo popup");
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(albedoTracker.getHistory("tx-c")[0].phase).toBe("cancelled");
  });

  it("isolates history by txId and supports clear", () => {
    const tracker = new AlbedoTransactionTracker();
    tracker.track("a", "idle", "start");
    tracker.track("b", "success", "done", { txHash: "h" });

    expect(tracker.getHistory("a")).toHaveLength(1);
    expect(tracker.getHistory("b")).toHaveLength(1);
    expect(tracker.getHistory()).toHaveLength(2);
    expect(tracker.getHistory("b")[0].txHash).toBe("h");

    tracker.clear();
    expect(tracker.getHistory()).toHaveLength(0);
  });

  it("module-level albedoTracker is cleared between tests", () => {
    albedoTracker.track("x", "confirming", "Waiting for confirmation");
    albedoTracker.clear();
    expect(albedoTracker.getHistory()).toHaveLength(0);
  });
});
