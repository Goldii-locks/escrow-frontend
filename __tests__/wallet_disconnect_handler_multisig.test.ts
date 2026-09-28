import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  splitDisconnectMultiSigTransaction,
  validateDisconnectMultiSigSplits,
  prepareDisconnectMultiSigSplits,
  type DisconnectMultiSigSnapshot,
} from "@/app/lib/wallet_disconnect_handler";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a valid base64-encoded XDR stub. The multi-sig parse pipeline needs
 * a non-empty string that round-trips through base64 and produces at least
 * 80 bytes (the default heuristic floor for one signature slot).
 */
function makeValidXdr(byteLength = 160): string {
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) bytes[i] = i % 256;
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

const SIGNER_A = "GABCDEFGHIJKLMNOPQRSTUVWXYZ01234567890ABCDEFGHIJKLMNOP";
const SIGNER_B = "GZYXWVUTSRQPONMLKJIHGFEDCBA09876543210ZYXWVUTSRQPONML";

// ---------------------------------------------------------------------------
// splitDisconnectMultiSigTransaction
// ---------------------------------------------------------------------------

describe("splitDisconnectMultiSigTransaction (#239)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns valid splits for a well-formed XDR with two signers", () => {
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: makeValidXdr(),
      signerPublicKeys: [SIGNER_A, SIGNER_B],
    };

    const result = splitDisconnectMultiSigTransaction(snapshot);

    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.splits).toHaveLength(2);
    expect(result.signatureCount).toBeGreaterThanOrEqual(1);
    expect(result.splits[0].signer.publicKey).toBe(SIGNER_A);
    expect(result.splits[1].signer.publicKey).toBe(SIGNER_B);
  });

  it("populates signer hints from the last 4 characters of each public key", () => {
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: makeValidXdr(),
      signerPublicKeys: [SIGNER_A],
    };

    const result = splitDisconnectMultiSigTransaction(snapshot);

    expect(result.valid).toBe(true);
    expect(result.splits[0].signer.hint).toBe(SIGNER_A.slice(-4));
  });

  it("initialises each split's signedXdr to the base XDR", () => {
    const xdr = makeValidXdr();
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: xdr,
      signerPublicKeys: [SIGNER_A],
    };

    const result = splitDisconnectMultiSigTransaction(snapshot);

    expect(result.valid).toBe(true);
    expect(result.splits[0].signedXdr).toBe(xdr.trim());
    expect(result.splits[0].baseXdr).toBe(xdr.trim());
  });

  it("returns an error result for empty XDR", () => {
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: "",
      signerPublicKeys: [SIGNER_A],
    };

    const result = splitDisconnectMultiSigTransaction(snapshot);

    expect(result.valid).toBe(false);
    expect(result.error).not.toBeNull();
    expect(result.error).toMatch(/empty/i);
    expect(result.splits).toHaveLength(0);
    expect(result.signatureCount).toBe(0);
    expect(result.sourceAccount).toBeNull();
  });

  it("returns an error result for invalid base64 XDR", () => {
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: "!!!not-valid-base64!!!",
      signerPublicKeys: [SIGNER_A],
    };

    const result = splitDisconnectMultiSigTransaction(snapshot);

    expect(result.valid).toBe(false);
    expect(result.error).not.toBeNull();
    expect(result.splits).toHaveLength(0);
  });

  it("returns valid result with zero signers (empty splits array)", () => {
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: makeValidXdr(),
      signerPublicKeys: [],
    };

    const result = splitDisconnectMultiSigTransaction(snapshot);

    expect(result.valid).toBe(true);
    expect(result.splits).toHaveLength(0);
    expect(result.signatureCount).toBeGreaterThanOrEqual(1);
  });

  it("logs a console warning when parsing fails", () => {
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: "",
      signerPublicKeys: [SIGNER_A],
    };

    splitDisconnectMultiSigTransaction(snapshot);

    expect(warnSpy).toHaveBeenCalled();
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[wallet_disconnect_handler]");
    expect(logged).toContain("MULTI-SIG SPLIT FAILED");
  });

  it("does not log when parsing succeeds", () => {
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: makeValidXdr(),
      signerPublicKeys: [SIGNER_A],
    };

    splitDisconnectMultiSigTransaction(snapshot);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("handles whitespace-padded XDR by trimming", () => {
    const xdr = makeValidXdr();
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: `  ${xdr}  `,
      signerPublicKeys: [SIGNER_A],
    };

    const result = splitDisconnectMultiSigTransaction(snapshot);

    expect(result.valid).toBe(true);
    expect(result.splits[0].baseXdr).toBe(xdr.trim());
  });

  it("handles a single signer", () => {
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: makeValidXdr(),
      signerPublicKeys: [SIGNER_A],
    };

    const result = splitDisconnectMultiSigTransaction(snapshot);

    expect(result.valid).toBe(true);
    expect(result.splits).toHaveLength(1);
    expect(result.splits[0].signer.publicKey).toBe(SIGNER_A);
  });

  it("handles many signers", () => {
    const signers = Array.from(
      { length: 5 },
      (_, i) => `G${"ABCDEFGHIJKLMNOPQRSTUVWXYZ"[i]}${"X".repeat(53)}`,
    );
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: makeValidXdr(),
      signerPublicKeys: signers,
    };

    const result = splitDisconnectMultiSigTransaction(snapshot);

    expect(result.valid).toBe(true);
    expect(result.splits).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(result.splits[i].signer.publicKey).toBe(signers[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// validateDisconnectMultiSigSplits
// ---------------------------------------------------------------------------

describe("validateDisconnectMultiSigSplits (#239)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns valid for a well-formed set of splits with enough signers", () => {
    const xdr = makeValidXdr();
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: xdr,
      signerPublicKeys: [SIGNER_A, SIGNER_B],
    };

    const splitResult = splitDisconnectMultiSigTransaction(snapshot);
    expect(splitResult.valid).toBe(true);

    const validation = validateDisconnectMultiSigSplits(splitResult.splits);

    expect(validation.valid).toBe(true);
    expect(validation.error).toBeNull();
    expect(validation.uniqueSigners).toBe(2);
  });

  it("returns invalid when unique signers are below the default minimum", () => {
    const xdr = makeValidXdr();
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: xdr,
      signerPublicKeys: [SIGNER_A],
    };

    const splitResult = splitDisconnectMultiSigTransaction(snapshot);
    expect(splitResult.valid).toBe(true);

    const validation = validateDisconnectMultiSigSplits(splitResult.splits);

    expect(validation.valid).toBe(false);
    expect(validation.error).not.toBeNull();
    expect(validation.error).toMatch(/minimum required/i);
    expect(validation.uniqueSigners).toBe(0);
  });

  it("respects custom minRequired option", () => {
    const xdr = makeValidXdr();
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: xdr,
      signerPublicKeys: [SIGNER_A],
    };

    const splitResult = splitDisconnectMultiSigTransaction(snapshot);
    const validation = validateDisconnectMultiSigSplits(splitResult.splits, {
      minRequired: 1,
    });

    expect(validation.valid).toBe(true);
    expect(validation.uniqueSigners).toBe(1);
  });

  it("returns invalid for duplicate signers", () => {
    const xdr = makeValidXdr();
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: xdr,
      signerPublicKeys: [SIGNER_A, SIGNER_A],
    };

    const splitResult = splitDisconnectMultiSigTransaction(snapshot);
    const validation = validateDisconnectMultiSigSplits(splitResult.splits);

    expect(validation.valid).toBe(false);
    expect(validation.error).not.toBeNull();
    expect(validation.error).toMatch(/duplicate/i);
  });

  it("returns valid for empty splits array (vacuously valid, min=0)", () => {
    const validation = validateDisconnectMultiSigSplits([], {
      minRequired: 0,
    });

    expect(validation.valid).toBe(true);
    expect(validation.uniqueSigners).toBe(0);
  });

  it("logs a warning when validation fails", () => {
    const xdr = makeValidXdr();
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: xdr,
      signerPublicKeys: [SIGNER_A],
    };
    const splitResult = splitDisconnectMultiSigTransaction(snapshot);

    validateDisconnectMultiSigSplits(splitResult.splits);

    expect(warnSpy).toHaveBeenCalled();
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[wallet_disconnect_handler]");
    expect(logged).toContain("MULTI-SIG VALIDATION FAILED");
  });

  it("does not log when validation succeeds", () => {
    const xdr = makeValidXdr();
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: xdr,
      signerPublicKeys: [SIGNER_A, SIGNER_B],
    };
    const splitResult = splitDisconnectMultiSigTransaction(snapshot);

    validateDisconnectMultiSigSplits(splitResult.splits);

    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// prepareDisconnectMultiSigSplits (convenience wrapper)
// ---------------------------------------------------------------------------

describe("prepareDisconnectMultiSigSplits (#239)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns valid result when XDR parses and assembly validates", () => {
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: makeValidXdr(),
      signerPublicKeys: [SIGNER_A, SIGNER_B],
    };

    const result = prepareDisconnectMultiSigSplits(snapshot);

    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
    expect(result.splits).toHaveLength(2);
    expect(result.signatureCount).toBeGreaterThanOrEqual(1);
  });

  it("returns error when XDR parsing fails", () => {
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: "",
      signerPublicKeys: [SIGNER_A, SIGNER_B],
    };

    const result = prepareDisconnectMultiSigSplits(snapshot);

    expect(result.valid).toBe(false);
    expect(result.error).not.toBeNull();
    expect(result.splits).toHaveLength(0);
  });

  it("returns error when assembly validation fails (insufficient signers)", () => {
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: makeValidXdr(),
      signerPublicKeys: [SIGNER_A],
    };

    const result = prepareDisconnectMultiSigSplits(snapshot);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/minimum required/i);
    expect(result.splits).toHaveLength(1);
  });

  it("returns error when assembly validation fails (duplicate signers)", () => {
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: makeValidXdr(),
      signerPublicKeys: [SIGNER_A, SIGNER_A],
    };

    const result = prepareDisconnectMultiSigSplits(snapshot);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/duplicate/i);
  });

  it("respects custom assemblyOptions.minRequired", () => {
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: makeValidXdr(),
      signerPublicKeys: [SIGNER_A],
    };

    const result = prepareDisconnectMultiSigSplits(snapshot, undefined, {
      minRequired: 1,
    });

    expect(result.valid).toBe(true);
    expect(result.splits).toHaveLength(1);
  });

  it("preserves split metadata even when validation fails", () => {
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: makeValidXdr(),
      signerPublicKeys: [SIGNER_A],
    };

    const result = prepareDisconnectMultiSigSplits(snapshot);

    expect(result.valid).toBe(false);
    expect(result.splits).toHaveLength(1);
    expect(result.signatureCount).toBeGreaterThanOrEqual(1);
  });

  it("returns splits with correct signer order", () => {
    const snapshot: DisconnectMultiSigSnapshot = {
      baseXdr: makeValidXdr(),
      signerPublicKeys: [SIGNER_A, SIGNER_B],
    };

    const result = prepareDisconnectMultiSigSplits(snapshot);

    expect(result.valid).toBe(true);
    expect(result.splits[0].signer.publicKey).toBe(SIGNER_A);
    expect(result.splits[1].signer.publicKey).toBe(SIGNER_B);
  });
});
