/**
 * Unit tests for app/lib/wallet_log.ts
 *
 * Verifies the console warning formatter and WalletTransactionTracker that
 * were extracted from wallet_state_context.ts.
 */
import { describe, expect, it, vi } from "vitest";
import {
  formatConsoleWarningBlock,
  formatStackTrace,
  logWalletWarning,
  WalletTransactionTracker,
} from "@/app/lib/wallet_log";

describe("wallet_log — formatStackTrace", () => {
  it("returns the error's own stack when present", () => {
    const err = new Error("boom");
    expect(formatStackTrace(err)).toBe(err.stack);
  });

  it("synthesizes a stack when no error is given", () => {
    const stack = formatStackTrace();
    expect(stack).toContain("Error");
  });

  it("returns a multi-line string when given a raw stack string", () => {
    const raw = "Error: boom\n    at somewhere";
    expect(formatStackTrace(raw)).toBe(raw);
  });
});

describe("wallet_log — formatConsoleWarningBlock", () => {
  it("contains the prefix, title, body, and stack markers", () => {
    const formatted = formatConsoleWarningBlock({
      title: "TX ERROR",
      body: "signing failed",
      stack: "Error: boom\n    at somewhere",
      txId: "tx-1",
      phase: "error",
    });
    expect(formatted).toContain("[wallet_state_context]");
    expect(formatted).toContain("TX ERROR");
    expect(formatted).toContain("signing failed");
    expect(formatted).toContain("--- stack trace ---");
    expect(formatted).toContain("--- end stack ---");
    expect(formatted).toContain("tx-1");
    expect(formatted).toContain("error");
  });

  it("omits txId and phase lines when they are not supplied", () => {
    const formatted = formatConsoleWarningBlock({
      title: "WARN",
      body: "something happened",
      stack: "Error: x",
    });
    expect(formatted).not.toContain("txId:");
    expect(formatted).not.toContain("phase:");
  });
});

describe("wallet_log — logWalletWarning", () => {
  it("calls console.warn with the formatted block and returns it", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = logWalletWarning("TX ERROR", "signing failed", {
      err: new Error("boom"),
      txId: "tx-1",
      phase: "error",
    });
    expect(spy).toHaveBeenCalledWith(result);
    expect(result).toContain("--- stack trace ---");
    spy.mockRestore();
  });
});

describe("wallet_log — WalletTransactionTracker", () => {
  it("records entries and supports history filtering by txId", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tracker = new WalletTransactionTracker();

    tracker.track("tx-1", "connecting", "opening wallet");
    tracker.track("tx-1", "error", "connect failed", new Error("fail"));
    tracker.track("tx-2", "success", "signed");

    expect(tracker.getHistory("tx-1")).toHaveLength(2);
    expect(tracker.getHistory("tx-1")[1].stack).toContain("fail");
    expect(tracker.getHistory()).toHaveLength(3);
    spy.mockRestore();
  });

  it("clear() removes all entries", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tracker = new WalletTransactionTracker();
    tracker.track("tx-1", "success", "done");
    tracker.clear();
    expect(tracker.getHistory()).toHaveLength(0);
    spy.mockRestore();
  });
});
