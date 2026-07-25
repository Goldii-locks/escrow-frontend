/**
 * Tests for Issue #159 – Multi-signature transaction helper hooks in
 * network_sync_checker.
 *
 * Covers:
 *   - createMultiSigAssembly  – validation and initial state
 *   - addSignerToAssembly     – happy path, duplicate prevention, ordering
 *   - isAssemblyComplete      – threshold logic
 *   - getFinalSignedXdr       – retrieval and InsufficientSignaturesError
 *   - validateAssemblyNetwork – passphrase validation
 *   - getAssemblySummary      – summary shape
 *   - useMultiSigAssembly hook – state management via renderHook
 */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createMultiSigAssembly,
  addSignerToAssembly,
  isAssemblyComplete,
  getFinalSignedXdr,
  validateAssemblyNetwork,
  getAssemblySummary,
  InsufficientSignaturesError,
  DuplicateSignerError,
  NetworkPassphraseMismatchError,
} from "@/app/lib/network_sync_checker_multisig";
import { useMultiSigAssembly } from "@/app/hooks/useMultiSigAssembly";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

const BASE_XDR = "AAAAAQAAAA=="; // minimal stub XDR string
const SIGNED_XDR_1 = "AAAASIGNER1==";
const SIGNED_XDR_2 = "AAAASIGNER2==";
const ADDR_1 = "GABC0000000000000000000000000000000000000001";
const ADDR_2 = "GABC0000000000000000000000000000000000000002";

// ---------------------------------------------------------------------------
// createMultiSigAssembly
// ---------------------------------------------------------------------------
describe("createMultiSigAssembly", () => {
  it("returns a valid assembly with correct initial fields", () => {
    const asm = createMultiSigAssembly(BASE_XDR, 2, TESTNET_PASSPHRASE);
    expect(asm.baseXdr).toBe(BASE_XDR);
    expect(asm.requiredSigners).toBe(2);
    expect(asm.networkPassphrase).toBe(TESTNET_PASSPHRASE);
    expect(asm.signers).toHaveLength(0);
  });

  it("throws RangeError when requiredSigners < 1", () => {
    expect(() => createMultiSigAssembly(BASE_XDR, 0, TESTNET_PASSPHRASE)).toThrow(
      RangeError
    );
  });

  it("throws TypeError for an empty baseXdr", () => {
    expect(() => createMultiSigAssembly("", 2, TESTNET_PASSPHRASE)).toThrow(TypeError);
  });

  it("uses app NETWORK_PASSPHRASE by default", async () => {
    const { NETWORK_PASSPHRASE } = await import("@/app/lib/contract");
    const asm = createMultiSigAssembly(BASE_XDR, 1);
    expect(asm.networkPassphrase).toBe(NETWORK_PASSPHRASE);
  });
});

// ---------------------------------------------------------------------------
// addSignerToAssembly
// ---------------------------------------------------------------------------
describe("addSignerToAssembly", () => {
  it("adds a signer and returns a new (immutable) assembly", () => {
    const asm = createMultiSigAssembly(BASE_XDR, 2, TESTNET_PASSPHRASE);
    const updated = addSignerToAssembly(asm, ADDR_1, SIGNED_XDR_1);
    expect(updated.signers).toHaveLength(1);
    expect(updated.signers[0].address).toBe(ADDR_1);
    expect(updated.signers[0].signedXdr).toBe(SIGNED_XDR_1);
    // Original is unchanged.
    expect(asm.signers).toHaveLength(0);
  });

  it("records a signedAt timestamp", () => {
    const before = Date.now();
    const asm = createMultiSigAssembly(BASE_XDR, 1, TESTNET_PASSPHRASE);
    const updated = addSignerToAssembly(asm, ADDR_1, SIGNED_XDR_1);
    expect(updated.signers[0].signedAt).toBeGreaterThanOrEqual(before);
  });

  it("throws DuplicateSignerError if the same address signs twice", () => {
    const asm = createMultiSigAssembly(BASE_XDR, 2, TESTNET_PASSPHRASE);
    const updated = addSignerToAssembly(asm, ADDR_1, SIGNED_XDR_1);
    expect(() => addSignerToAssembly(updated, ADDR_1, SIGNED_XDR_1)).toThrow(
      DuplicateSignerError
    );
  });

  it("throws TypeError for an empty signedXdr", () => {
    const asm = createMultiSigAssembly(BASE_XDR, 2, TESTNET_PASSPHRASE);
    expect(() => addSignerToAssembly(asm, ADDR_1, "")).toThrow(TypeError);
  });

  it("accumulates multiple signers in order", () => {
    let asm = createMultiSigAssembly(BASE_XDR, 2, TESTNET_PASSPHRASE);
    asm = addSignerToAssembly(asm, ADDR_1, SIGNED_XDR_1);
    asm = addSignerToAssembly(asm, ADDR_2, SIGNED_XDR_2);
    expect(asm.signers.map((s) => s.address)).toEqual([ADDR_1, ADDR_2]);
  });
});

// ---------------------------------------------------------------------------
// isAssemblyComplete
// ---------------------------------------------------------------------------
describe("isAssemblyComplete", () => {
  it("returns false before threshold is reached", () => {
    const asm = createMultiSigAssembly(BASE_XDR, 2, TESTNET_PASSPHRASE);
    const one = addSignerToAssembly(asm, ADDR_1, SIGNED_XDR_1);
    expect(isAssemblyComplete(one)).toBe(false);
  });

  it("returns true exactly when threshold is met", () => {
    let asm = createMultiSigAssembly(BASE_XDR, 2, TESTNET_PASSPHRASE);
    asm = addSignerToAssembly(asm, ADDR_1, SIGNED_XDR_1);
    asm = addSignerToAssembly(asm, ADDR_2, SIGNED_XDR_2);
    expect(isAssemblyComplete(asm)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getFinalSignedXdr
// ---------------------------------------------------------------------------
describe("getFinalSignedXdr", () => {
  it("returns the last signer's XDR when assembly is complete", () => {
    let asm = createMultiSigAssembly(BASE_XDR, 2, TESTNET_PASSPHRASE);
    asm = addSignerToAssembly(asm, ADDR_1, SIGNED_XDR_1);
    asm = addSignerToAssembly(asm, ADDR_2, SIGNED_XDR_2);
    expect(getFinalSignedXdr(asm)).toBe(SIGNED_XDR_2);
  });

  it("throws InsufficientSignaturesError when incomplete", () => {
    const asm = createMultiSigAssembly(BASE_XDR, 2, TESTNET_PASSPHRASE);
    const one = addSignerToAssembly(asm, ADDR_1, SIGNED_XDR_1);
    expect(() => getFinalSignedXdr(one)).toThrow(InsufficientSignaturesError);
  });

  it("InsufficientSignaturesError message includes required/provided counts", () => {
    const asm = createMultiSigAssembly(BASE_XDR, 3, TESTNET_PASSPHRASE);
    try {
      getFinalSignedXdr(asm);
    } catch (err) {
      expect(err).toBeInstanceOf(InsufficientSignaturesError);
      expect((err as Error).message).toMatch("3");
      expect((err as Error).message).toMatch("0");
    }
  });
});

// ---------------------------------------------------------------------------
// validateAssemblyNetwork
// ---------------------------------------------------------------------------
describe("validateAssemblyNetwork", () => {
  it("does not throw when network passphrase matches app network", async () => {
    const { NETWORK_PASSPHRASE } = await import("@/app/lib/contract");
    const asm = createMultiSigAssembly(BASE_XDR, 1, NETWORK_PASSPHRASE);
    expect(() => validateAssemblyNetwork(asm)).not.toThrow();
  });

  it("throws NetworkPassphraseMismatchError when network does not match", async () => {
    const { NETWORK_PASSPHRASE } = await import("@/app/lib/contract");
    const asm = createMultiSigAssembly(BASE_XDR, 1, MAINNET_PASSPHRASE);
    if (NETWORK_PASSPHRASE !== MAINNET_PASSPHRASE) {
      expect(() => validateAssemblyNetwork(asm)).toThrow(NetworkPassphraseMismatchError);
    }
  });
});

// ---------------------------------------------------------------------------
// getAssemblySummary
// ---------------------------------------------------------------------------
describe("getAssemblySummary", () => {
  it("returns correct summary for an incomplete assembly", () => {
    const asm = createMultiSigAssembly(BASE_XDR, 3, TESTNET_PASSPHRASE);
    const one = addSignerToAssembly(asm, ADDR_1, SIGNED_XDR_1);
    const summary = getAssemblySummary(one);
    expect(summary.collected).toBe(1);
    expect(summary.required).toBe(3);
    expect(summary.remaining).toBe(2);
    expect(summary.complete).toBe(false);
    expect(summary.signerAddresses).toEqual([ADDR_1]);
  });

  it("returns complete=true and remaining=0 when done", () => {
    let asm = createMultiSigAssembly(BASE_XDR, 2, TESTNET_PASSPHRASE);
    asm = addSignerToAssembly(asm, ADDR_1, SIGNED_XDR_1);
    asm = addSignerToAssembly(asm, ADDR_2, SIGNED_XDR_2);
    const summary = getAssemblySummary(asm);
    expect(summary.complete).toBe(true);
    expect(summary.remaining).toBe(0);
    expect(summary.signerAddresses).toEqual([ADDR_1, ADDR_2]);
  });
});

// ---------------------------------------------------------------------------
// useMultiSigAssembly hook
// ---------------------------------------------------------------------------
describe("useMultiSigAssembly hook", () => {
  it("starts with null assembly and no error", () => {
    const { result } = renderHook(() => useMultiSigAssembly());
    expect(result.current.state.assembly).toBeNull();
    expect(result.current.state.error).toBeNull();
    expect(result.current.isComplete).toBe(false);
    expect(result.current.summary).toBeNull();
  });

  it("startAssembly creates an assembly", () => {
    const { result } = renderHook(() => useMultiSigAssembly());
    act(() => result.current.startAssembly(BASE_XDR, 2));
    expect(result.current.state.assembly).not.toBeNull();
    expect(result.current.state.assembly!.requiredSigners).toBe(2);
    expect(result.current.state.error).toBeNull();
  });

  it("startAssembly sets error for invalid input", () => {
    const { result } = renderHook(() => useMultiSigAssembly());
    act(() => result.current.startAssembly("", 2));
    expect(result.current.state.assembly).toBeNull();
    expect(result.current.state.error).not.toBeNull();
  });

  it("addSignature adds a signer and updates isComplete", () => {
    const { result } = renderHook(() => useMultiSigAssembly());
    act(() => result.current.startAssembly(BASE_XDR, 1));
    act(() => result.current.addSignature(ADDR_1, SIGNED_XDR_1));
    expect(result.current.isComplete).toBe(true);
  });

  it("addSignature sets error on duplicate signer", () => {
    const { result } = renderHook(() => useMultiSigAssembly());
    act(() => result.current.startAssembly(BASE_XDR, 2));
    act(() => result.current.addSignature(ADDR_1, SIGNED_XDR_1));
    act(() => result.current.addSignature(ADDR_1, SIGNED_XDR_1));
    expect(result.current.state.error).toMatch(/already signed/i);
  });

  it("getFinalXdr returns the final XDR when complete", () => {
    const { result } = renderHook(() => useMultiSigAssembly());
    act(() => result.current.startAssembly(BASE_XDR, 1));
    act(() => result.current.addSignature(ADDR_1, SIGNED_XDR_1));
    let xdr: string | null = null;
    act(() => { xdr = result.current.getFinalXdr(); });
    expect(xdr).toBe(SIGNED_XDR_1);
  });

  it("getFinalXdr sets error when assembly is incomplete", () => {
    const { result } = renderHook(() => useMultiSigAssembly());
    act(() => result.current.startAssembly(BASE_XDR, 2));
    act(() => result.current.addSignature(ADDR_1, SIGNED_XDR_1));
    let xdr: string | null = null;
    act(() => { xdr = result.current.getFinalXdr(); });
    expect(xdr).toBeNull();
    expect(result.current.state.error).not.toBeNull();
  });

  it("getFinalXdr sets error when no assembly has been started", () => {
    const { result } = renderHook(() => useMultiSigAssembly());
    let xdr: string | null = null;
    act(() => { xdr = result.current.getFinalXdr(); });
    expect(xdr).toBeNull();
    expect(result.current.state.error).not.toBeNull();
  });

  it("reset clears the assembly and error", () => {
    const { result } = renderHook(() => useMultiSigAssembly());
    act(() => result.current.startAssembly(BASE_XDR, 2));
    act(() => result.current.reset());
    expect(result.current.state.assembly).toBeNull();
    expect(result.current.state.error).toBeNull();
  });

  it("summary reflects current progress", () => {
    const { result } = renderHook(() => useMultiSigAssembly());
    act(() => result.current.startAssembly(BASE_XDR, 2));
    act(() => result.current.addSignature(ADDR_1, SIGNED_XDR_1));
    expect(result.current.summary?.collected).toBe(1);
    expect(result.current.summary?.remaining).toBe(1);
    expect(result.current.summary?.complete).toBe(false);
  });
});
