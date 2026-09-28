import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Account,
  Asset,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import {
  useWalletMultiSigAssembly,
  WalletMultiSigParseError,
} from "@/app/hooks/useWalletMultiSigAssembly";

const NETWORK = Networks.TESTNET;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildXdr(): { xdr: string; source: Keypair } {
  const source = Keypair.random();
  const account = new Account(source.publicKey(), "0");
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(
      Operation.payment({
        destination: Keypair.random().publicKey(),
        asset: Asset.native(),
        amount: "1",
      })
    )
    .setTimeout(30)
    .build();
  return { xdr: tx.toXDR(), source };
}

// ---------------------------------------------------------------------------
// parseStructure — the XDR validation gate
// ---------------------------------------------------------------------------

describe("useWalletMultiSigAssembly — parseStructure", () => {
  it("parses a valid XDR and returns structure metadata (albedo)", () => {
    const { xdr } = buildXdr();
    const { result } = renderHook(() =>
      useWalletMultiSigAssembly(NETWORK, "albedo")
    );
    const s = result.current.parseStructure(xdr);
    expect(s.operationCount).toBe(1);
    expect(typeof s.sourceAccount).toBe("string");
    expect(s.sourceAccount.length).toBeGreaterThan(0);
  });

  it("throws WalletMultiSigParseError for empty XDR (albedo)", () => {
    const { result } = renderHook(() =>
      useWalletMultiSigAssembly(NETWORK, "albedo")
    );
    expect(() => result.current.parseStructure("")).toThrow(
      WalletMultiSigParseError
    );
  });

  it("throws WalletMultiSigParseError for malformed XDR (albedo)", () => {
    const { result } = renderHook(() =>
      useWalletMultiSigAssembly(NETWORK, "albedo")
    );
    expect(() => result.current.parseStructure("not-valid-xdr")).toThrow(
      WalletMultiSigParseError
    );
  });

  it("parses a valid XDR (freighter)", () => {
    const { xdr } = buildXdr();
    const { result } = renderHook(() =>
      useWalletMultiSigAssembly(NETWORK, "freighter")
    );
    // freighter uses base-layer parseMultiSigEnvelope; structurePreview returned
    const s = result.current.parseStructure(xdr);
    expect(typeof s.operationCount).toBe("number");
  });

  it("throws WalletMultiSigParseError for empty XDR (freighter)", () => {
    const { result } = renderHook(() =>
      useWalletMultiSigAssembly(NETWORK, "freighter")
    );
    expect(() => result.current.parseStructure("")).toThrow(
      WalletMultiSigParseError
    );
  });

  it("parses a valid XDR (xbull)", () => {
    const { xdr } = buildXdr();
    const { result } = renderHook(() =>
      useWalletMultiSigAssembly(NETWORK, "xbull")
    );
    const s = result.current.parseStructure(xdr);
    expect(typeof s.operationCount).toBe("number");
  });

  it("parses a valid XDR (hana)", () => {
    const { xdr } = buildXdr();
    const { result } = renderHook(() =>
      useWalletMultiSigAssembly(NETWORK, "hana")
    );
    const s = result.current.parseStructure(xdr);
    expect(typeof s.operationCount).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// planAssembly
// ---------------------------------------------------------------------------

describe("useWalletMultiSigAssembly — planAssembly", () => {
  it("builds a plan with the correct pending signers (albedo)", () => {
    const { xdr } = buildXdr();
    const signers = [Keypair.random().publicKey(), Keypair.random().publicKey()];
    const { result } = renderHook(() =>
      useWalletMultiSigAssembly(NETWORK, "albedo")
    );
    const plan = result.current.planAssembly(xdr, signers);
    expect(plan.pendingSigners).toEqual(signers);
    expect(plan.baseXdr).toBe(xdr);
    expect(typeof plan.structure.operationCount).toBe("number");
  });

  it("builds a plan with the correct pending signers (freighter)", () => {
    const { xdr } = buildXdr();
    const signers = [Keypair.random().publicKey()];
    const { result } = renderHook(() =>
      useWalletMultiSigAssembly(NETWORK, "freighter")
    );
    const plan = result.current.planAssembly(xdr, signers);
    expect(plan.pendingSigners).toEqual(signers);
  });

  it("throws WalletMultiSigParseError for malformed base XDR (albedo)", () => {
    const signers = [Keypair.random().publicKey()];
    const { result } = renderHook(() =>
      useWalletMultiSigAssembly(NETWORK, "albedo")
    );
    expect(() =>
      result.current.planAssembly("bad-xdr", signers)
    ).toThrow(WalletMultiSigParseError);
  });
});

// ---------------------------------------------------------------------------
// missingSigners
// ---------------------------------------------------------------------------

describe("useWalletMultiSigAssembly — missingSigners", () => {
  it("returns keys that have not yet signed", () => {
    const { xdr } = buildXdr();
    const keyA = Keypair.random().publicKey();
    const keyB = Keypair.random().publicKey();
    const { result } = renderHook(() =>
      useWalletMultiSigAssembly(NETWORK, "albedo")
    );
    const plan = result.current.planAssembly(xdr, [keyA, keyB]);
    const missing = result.current.missingSigners(plan, [keyA]);
    expect(missing).toEqual([keyB]);
  });

  it("returns empty array when all signers have signed", () => {
    const { xdr } = buildXdr();
    const keyA = Keypair.random().publicKey();
    const { result } = renderHook(() =>
      useWalletMultiSigAssembly(NETWORK, "freighter")
    );
    const plan = result.current.planAssembly(xdr, [keyA]);
    const missing = result.current.missingSigners(plan, [keyA]);
    expect(missing).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// validateParts — structural validation of co-signer envelopes
// ---------------------------------------------------------------------------

describe("useWalletMultiSigAssembly — validateParts", () => {
  it("does not throw when all parts carry valid XDRs (albedo)", () => {
    const { xdr, source } = buildXdr();
    const tx = TransactionBuilder.fromXDR(xdr, NETWORK);
    tx.sign(source);
    const signedXdr = tx.toXDR();

    const { result } = renderHook(() =>
      useWalletMultiSigAssembly(NETWORK, "albedo")
    );
    expect(() =>
      result.current.validateParts([
        { signerPublicKey: source.publicKey(), signedXdr },
      ])
    ).not.toThrow();
  });

  it("throws WalletMultiSigParseError for a part with malformed XDR (albedo)", () => {
    const { result } = renderHook(() =>
      useWalletMultiSigAssembly(NETWORK, "albedo")
    );
    expect(() =>
      result.current.validateParts([
        { signerPublicKey: Keypair.random().publicKey(), signedXdr: "bad" },
      ])
    ).toThrow(WalletMultiSigParseError);
  });
});

// ---------------------------------------------------------------------------
// signTransaction
// ---------------------------------------------------------------------------

describe("useWalletMultiSigAssembly — signTransaction", () => {
  it("calls signFn with the trimmed XDR for albedo", async () => {
    const { xdr } = buildXdr();
    const { result } = renderHook(() =>
      useWalletMultiSigAssembly(NETWORK, "albedo")
    );
    const signFn = async (x: string) => `signed:${x}`;
    const signed = await result.current.signTransaction(xdr, signFn);
    expect(signed).toBe(`signed:${xdr}`);
  });

  it("calls signFn with the trimmed XDR for freighter", async () => {
    const { xdr } = buildXdr();
    const { result } = renderHook(() =>
      useWalletMultiSigAssembly(NETWORK, "freighter")
    );
    const signFn = async (x: string) => `signed:${x}`;
    const signed = await result.current.signTransaction(xdr, signFn);
    expect(signed).toBe(`signed:${xdr.trim()}`);
  });

  it("rejects with WalletMultiSigParseError for invalid XDR (freighter)", async () => {
    const { result } = renderHook(() =>
      useWalletMultiSigAssembly(NETWORK, "freighter")
    );
    await expect(
      result.current.signTransaction("bad-xdr", async (x) => x)
    ).rejects.toThrow(WalletMultiSigParseError);
  });

  it("propagates sign function errors (albedo)", async () => {
    const { xdr } = buildXdr();
    const { result } = renderHook(() =>
      useWalletMultiSigAssembly(NETWORK, "albedo")
    );
    await expect(
      result.current.signTransaction(xdr, async () => {
        throw new Error("user rejected");
      })
    ).rejects.toThrow("user rejected");
  });
});

// ---------------------------------------------------------------------------
// WalletMultiSigParseError class
// ---------------------------------------------------------------------------

describe("WalletMultiSigParseError", () => {
  it("has the correct name", () => {
    const err = new WalletMultiSigParseError("bad xdr");
    expect(err.name).toBe("WalletMultiSigParseError");
  });

  it("carries the message", () => {
    const err = new WalletMultiSigParseError("failed to parse");
    expect(err.message).toBe("failed to parse");
  });

  it("is an instance of Error", () => {
    expect(new WalletMultiSigParseError("x")).toBeInstanceOf(Error);
  });
});
