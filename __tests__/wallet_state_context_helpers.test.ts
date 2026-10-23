import { describe, expect, it, vi } from "vitest";
import {
  applyMultiSigSignature,
  createMultiSigSplit,
  DEFAULT_MULTISIG_MIN_SIGNATURES,
  formatConsoleWarningBlock,
  formatStackTrace,
  logWalletWarning,
  parseMultiSigEnvelope,
  simulateMultiSigAssembly,
  subscribeToWalletLoading,
  validateMultiSigAssembly,
  WalletMultiSigStructureError,
  WalletTransactionTracker,
  withWalletLoader,
} from "@/app/lib/wallet_state_context";

function toBase64(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64");
}

describe("wallet_state_context multi-sig helpers (#119)", () => {
  it("parseMultiSigEnvelope throws empty_xdr for an empty string", () => {
    expect(() => parseMultiSigEnvelope("")).toThrow(WalletMultiSigStructureError);
    try {
      parseMultiSigEnvelope("   ");
    } catch (err) {
      expect((err as WalletMultiSigStructureError).code).toBe("empty_xdr");
    }
  });

  it("parseMultiSigEnvelope throws invalid_base64 for non-base64 input", () => {
    try {
      parseMultiSigEnvelope("not-valid-base64!!!");
      throw new Error("expected parseMultiSigEnvelope to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(WalletMultiSigStructureError);
      expect((err as WalletMultiSigStructureError).code).toBe("invalid_base64");
    }
  });

  it("parseMultiSigEnvelope returns a shape with signature slots for well-formed input", () => {
    const xdr = toBase64("a".repeat(200));
    const shape = parseMultiSigEnvelope(xdr);
    expect(shape.baseXdr).toBe(xdr);
    expect(shape.signatures).toBeGreaterThan(0);
    expect(shape.signatureSlotIndices).toHaveLength(shape.signatures);
  });

  it("parseMultiSigEnvelope uses an injected parseEnvelopeXdr and reports source account", () => {
    const xdr = toBase64("stub-envelope");
    const shape = parseMultiSigEnvelope(xdr, {
      parseEnvelopeXdr: () => ({ signatures: 3, sourceAccount: "GABC" }),
    });
    expect(shape.signatures).toBe(3);
    expect(shape.sourceAccount).toBe("GABC");
  });

  it("parseMultiSigEnvelope throws envelope_parse_failure when the injected parser throws", () => {
    const xdr = toBase64("stub-envelope");
    try {
      parseMultiSigEnvelope(xdr, {
        parseEnvelopeXdr: () => {
          throw new Error("boom");
        },
      });
      throw new Error("expected parseMultiSigEnvelope to throw");
    } catch (err) {
      expect((err as WalletMultiSigStructureError).code).toBe("envelope_parse_failure");
    }
  });

  it("parseMultiSigEnvelope throws decorator_mismatch when expectedSignatures does not match", () => {
    const xdr = toBase64("stub-envelope");
    try {
      parseMultiSigEnvelope(xdr, {
        parseEnvelopeXdr: () => ({ signatures: 1, sourceAccount: null }),
        expectedSignatures: 2,
      });
      throw new Error("expected parseMultiSigEnvelope to throw");
    } catch (err) {
      expect((err as WalletMultiSigStructureError).code).toBe("decorator_mismatch");
    }
  });

  it("createMultiSigSplit rejects an empty base XDR", () => {
    expect(() => createMultiSigSplit("", { publicKey: "GABC", hint: "abcd" })).toThrow(
      WalletMultiSigStructureError
    );
  });

  it("createMultiSigSplit rejects a signer missing publicKey or hint", () => {
    expect(() => createMultiSigSplit(toBase64("x"), { publicKey: "", hint: "abcd" })).toThrow(
      WalletMultiSigStructureError
    );
  });

  it("createMultiSigSplit builds a split seeded with the base XDR as signedXdr", () => {
    const xdr = toBase64("x".repeat(200));
    const split = createMultiSigSplit(xdr, { publicKey: "GABC", hint: "abcd" });
    expect(split.baseXdr).toBe(xdr);
    expect(split.signedXdr).toBe(xdr);
    expect(split.signer).toEqual({ publicKey: "GABC", hint: "abcd" });
  });

  it("applyMultiSigSignature overwrites signedXdr and rejects empty input", () => {
    const xdr = toBase64("x".repeat(200));
    const split = createMultiSigSplit(xdr, { publicKey: "GABC", hint: "abcd" });
    applyMultiSigSignature(split, "  signed-value  ");
    expect(split.signedXdr).toBe("signed-value");
    expect(() => applyMultiSigSignature(split, "   ")).toThrow(WalletMultiSigStructureError);
  });

  it("simulateMultiSigAssembly counts unique signers and flags duplicates", () => {
    const xdr = toBase64("x".repeat(200));
    const splitA = createMultiSigSplit(xdr, { publicKey: "GA", hint: "aaaa" });
    const splitB = createMultiSigSplit(xdr, { publicKey: "GB", hint: "bbbb" });
    const splitDup = createMultiSigSplit(xdr, { publicKey: "GA", hint: "aaaa" });

    const result = simulateMultiSigAssembly([splitA, splitB, splitDup]);
    expect(result.uniqueSigners).toBe(2);
    expect(result.duplicates).toEqual([{ publicKey: "GA", hint: "aaaa" }]);
  });

  it("validateMultiSigAssembly throws insufficient_signatures below the minimum", () => {
    const xdr = toBase64("x".repeat(200));
    const splitA = createMultiSigSplit(xdr, { publicKey: "GA", hint: "aaaa" });
    try {
      validateMultiSigAssembly([splitA]);
      throw new Error("expected validateMultiSigAssembly to throw");
    } catch (err) {
      expect((err as WalletMultiSigStructureError).code).toBe("insufficient_signatures");
    }
  });

  it("validateMultiSigAssembly throws duplicate_signer for repeated signers", () => {
    const xdr = toBase64("x".repeat(200));
    const splitA = createMultiSigSplit(xdr, { publicKey: "GA", hint: "aaaa" });
    const splitDup = createMultiSigSplit(xdr, { publicKey: "GA", hint: "aaaa" });
    try {
      validateMultiSigAssembly([splitA, splitDup], { minRequired: 1 });
      throw new Error("expected validateMultiSigAssembly to throw");
    } catch (err) {
      expect((err as WalletMultiSigStructureError).code).toBe("duplicate_signer");
    }
  });

  it("validateMultiSigAssembly succeeds and reports counts when the assembly meets the threshold", () => {
    const xdr = toBase64("x".repeat(200));
    const splitA = createMultiSigSplit(xdr, { publicKey: "GA", hint: "aaaa" });
    const splitB = createMultiSigSplit(xdr, { publicKey: "GB", hint: "bbbb" });
    const result = validateMultiSigAssembly([splitA, splitB]);
    expect(result).toEqual({ uniqueSigners: 2, splitsValidated: 2 });
  });

  it("DEFAULT_MULTISIG_MIN_SIGNATURES is 2", () => {
    expect(DEFAULT_MULTISIG_MIN_SIGNATURES).toBe(2);
  });
});

describe("wallet_state_context console warning + tx tracking (#121)", () => {
  it("formatStackTrace returns the error's own stack when present", () => {
    const err = new Error("boom");
    expect(formatStackTrace(err)).toBe(err.stack);
  });

  it("formatStackTrace synthesizes a stack when no error is given", () => {
    const stack = formatStackTrace();
    expect(stack).toContain("Error");
  });

  it("formatConsoleWarningBlock frames the stack trace between markers", () => {
    const formatted = formatConsoleWarningBlock({
      title: "TX ERROR",
      body: "signing failed",
      stack: "Error: boom\n    at somewhere",
      txId: "tx-1",
      phase: "error",
    });
    expect(formatted).toContain("[wallet_state_context]");
    expect(formatted).toContain("--- stack trace ---");
    expect(formatted).toContain("--- end stack ---");
    expect(formatted).toContain("tx-1");
    expect(formatted).toContain("signing failed");
  });

  it("logWalletWarning logs a formatted block to console.warn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const formatted = logWalletWarning("TX ERROR", "signing failed", {
      err: new Error("boom"),
      txId: "tx-1",
      phase: "error",
    });
    expect(warnSpy).toHaveBeenCalledWith(formatted);
    expect(formatted).toContain("--- stack trace ---");
    warnSpy.mockRestore();
  });

  it("WalletTransactionTracker records entries with a stack trace and supports history/clear", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tracker = new WalletTransactionTracker();
    tracker.track("tx-1", "connecting", "connecting to wallet");
    tracker.track("tx-1", "error", "connect failed", new Error("boom"));
    tracker.track("tx-2", "success", "signed");

    expect(tracker.getHistory("tx-1")).toHaveLength(2);
    expect(tracker.getHistory("tx-1")[1].stack).toContain("boom");
    expect(tracker.getHistory()).toHaveLength(3);

    tracker.clear();
    expect(tracker.getHistory()).toHaveLength(0);
    warnSpy.mockRestore();
  });
});

describe("wallet_state_context loader listener (#118)", () => {
  it("subscribeToWalletLoading emits the current state immediately on subscribe", () => {
    const states: boolean[] = [];
    const unsubscribe = subscribeToWalletLoading((isLoading) => states.push(isLoading));
    expect(states).toEqual([false]);
    unsubscribe();
  });

  it("withWalletLoader notifies subscribers true then false around a successful call", async () => {
    const states: boolean[] = [];
    const unsubscribe = subscribeToWalletLoading((isLoading) => states.push(isLoading));

    const result = await withWalletLoader(async () => "done");

    expect(result).toBe("done");
    expect(states).toEqual([false, true, false]);
    unsubscribe();
  });

  it("withWalletLoader notifies false even when the wrapped call throws", async () => {
    const states: boolean[] = [];
    const unsubscribe = subscribeToWalletLoading((isLoading) => states.push(isLoading));

    await expect(
      withWalletLoader(async () => {
        throw new Error("fail");
      })
    ).rejects.toThrow("fail");

    expect(states).toEqual([false, true, false]);
    unsubscribe();
  });

  it("subscribeToWalletLoading's unsubscribe function stops further notifications", async () => {
    const states: boolean[] = [];
    const unsubscribe = subscribeToWalletLoading((isLoading) => states.push(isLoading));
    unsubscribe();

    await withWalletLoader(async () => "done");

    expect(states).toEqual([false]);
  });
});
