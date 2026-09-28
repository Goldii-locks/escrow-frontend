import { act, renderHook } from "@testing-library/react";
import {
  Account,
  Asset,
  BASE_FEE,
  Keypair,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";
import { useFreighterMultiSigAssembly } from "@/app/hooks/useFreighterMultiSigAssembly";
import { WalletMultiSigStructureError } from "@/app/lib/wallet_state_context";
import {
  createFreighterMultiSigSplit,
  type FreighterMultiSigSplit,
} from "@/app/lib/freighter_connector";

const TEST_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

/**
 * Build a real, signed transaction envelope.
 *
 * The hook parses through the Stellar SDK, so base64 of arbitrary text is
 * rejected as a malformed envelope. These tests need an envelope that is
 * actually well-formed, and signed so the parser reports signature slots.
 */
function buildSignedEnvelopeXdr(): string {
  const keypair = Keypair.random();
  const account = new Account(keypair.publicKey(), "0");

  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: TEST_NETWORK_PASSPHRASE,
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

  transaction.sign(keypair);
  return transaction.toXDR();
}

describe("useFreighterMultiSigAssembly hook (#109)", () => {
  it("parseStructure parses a well-formed envelope without errors", () => {
    const { result } = renderHook(() =>
      useFreighterMultiSigAssembly(TEST_NETWORK_PASSPHRASE)
    );

    const xdr = buildSignedEnvelopeXdr();
    const shape = result.current.parseStructure(xdr);

    expect(shape.baseXdr).toBe(xdr);
    expect(shape.signatures).toBeGreaterThan(0);
    expect(shape.signatureSlotIndices.length).toBeGreaterThan(0);
  });

  it("parseStructure throws WalletMultiSigStructureError for empty input", () => {
    const { result } = renderHook(() =>
      useFreighterMultiSigAssembly(TEST_NETWORK_PASSPHRASE)
    );

    expect(() => result.current.parseStructure("")).toThrow(
      WalletMultiSigStructureError
    );
  });

  it("prepareTransaction deserializes a valid XDR", () => {
    const { result } = renderHook(() =>
      useFreighterMultiSigAssembly(TEST_NETWORK_PASSPHRASE)
    );

    const xdr = buildSignedEnvelopeXdr();
    const tx = result.current.prepareTransaction(xdr);
    expect(tx).toBeDefined();
  });

  it("prepareTransaction throws for empty XDR", () => {
    const { result } = renderHook(() =>
      useFreighterMultiSigAssembly(TEST_NETWORK_PASSPHRASE)
    );

    expect(() => result.current.prepareTransaction("")).toThrow(
      WalletMultiSigStructureError
    );
  });

  it("serializeTransaction converts a transaction back to XDR string", () => {
    const { result } = renderHook(() =>
      useFreighterMultiSigAssembly(TEST_NETWORK_PASSPHRASE)
    );

    const xdr = buildSignedEnvelopeXdr();
    const tx = result.current.prepareTransaction(xdr);
    const serialized = result.current.serializeTransaction(tx);
    expect(typeof serialized).toBe("string");
    expect(serialized.length).toBeGreaterThan(0);
  });

  it("signTransaction validates the XDR before calling the signing function", async () => {
    const { result } = renderHook(() =>
      useFreighterMultiSigAssembly(TEST_NETWORK_PASSPHRASE)
    );

    const xdr = buildSignedEnvelopeXdr();
    const signFn = vi.fn(async () => "signed-xdr");

    const signed = await result.current.signTransaction(xdr, signFn);

    expect(signed).toBe("signed-xdr");
    expect(signFn).toHaveBeenCalledWith(xdr);
  });

  it("signTransaction rejects invalid XDR before calling the signing function", async () => {
    const { result } = renderHook(() =>
      useFreighterMultiSigAssembly(TEST_NETWORK_PASSPHRASE)
    );

    const signFn = vi.fn(async () => "signed-xdr");

    await expect(
      result.current.signTransaction("", signFn)
    ).rejects.toThrow(WalletMultiSigStructureError);

    expect(signFn).not.toHaveBeenCalled();
  });

  it("createSplit builds a split seeded with the base XDR", () => {
    const { result } = renderHook(() =>
      useFreighterMultiSigAssembly(TEST_NETWORK_PASSPHRASE)
    );

    const xdr = buildSignedEnvelopeXdr();
    const split = result.current.createSplit(xdr, {
      publicKey: "GABC",
      hint: "abcd",
    });

    expect(split.baseXdr).toBe(xdr);
    expect(split.signedXdr).toBe(xdr);
    expect(split.signer).toEqual({ publicKey: "GABC", hint: "abcd" });
  });

  it("signSplit signs the split's XDR through the signing function", async () => {
    const { result } = renderHook(() =>
      useFreighterMultiSigAssembly(TEST_NETWORK_PASSPHRASE)
    );

    const xdr = buildSignedEnvelopeXdr();
    const split = createFreighterMultiSigSplit(xdr, {
      publicKey: "GABC",
      hint: "abcd",
    });
    const signFn = vi.fn(async () => "signed-by-freighter");

    const signed = await result.current.signSplit(split, signFn, 5_000);

    expect(signFn).toHaveBeenCalledWith(xdr);
    expect(signed.signedXdr).toBe("signed-by-freighter");
  });

  it("assemble validates a coherent multi-sig assembly", async () => {
    const { result } = renderHook(() =>
      useFreighterMultiSigAssembly(TEST_NETWORK_PASSPHRASE)
    );

    const xdr = buildSignedEnvelopeXdr();
    const splitA = result.current.createSplit(xdr, {
      publicKey: "GA",
      hint: "aaaa",
    });
    const splitB = result.current.createSplit(xdr, {
      publicKey: "GB",
      hint: "bbbb",
    });

    await result.current.signSplit(
      splitA,
      async () => "signed-a",
      5_000
    );
    await result.current.signSplit(
      splitB,
      async () => "signed-b",
      5_000
    );

    const assembleResult = result.current.assemble([splitA, splitB]);
    expect(assembleResult).toEqual({
      uniqueSigners: 2,
      splitsValidated: 2,
    });
  });

  it("assemble rejects duplicate signers", () => {
    const { result } = renderHook(() =>
      useFreighterMultiSigAssembly(TEST_NETWORK_PASSPHRASE)
    );

    const xdr = buildSignedEnvelopeXdr();
    const splitA: FreighterMultiSigSplit = createFreighterMultiSigSplit(xdr, {
      publicKey: "GA",
      hint: "aaaa",
    });
    const splitDup: FreighterMultiSigSplit = createFreighterMultiSigSplit(xdr, {
      publicKey: "GA",
      hint: "aaaa",
    });

    expect(() =>
      result.current.assemble([splitA, splitDup], { minRequired: 1 })
    ).toThrow(WalletMultiSigStructureError);
  });

  it("assemble rejects assemblies below the minimum signer threshold", () => {
    const { result } = renderHook(() =>
      useFreighterMultiSigAssembly(TEST_NETWORK_PASSPHRASE)
    );

    const xdr = buildSignedEnvelopeXdr();
    const splitA = result.current.createSplit(xdr, {
      publicKey: "GA",
      hint: "aaaa",
    });

    try {
      result.current.assemble([splitA]);
      throw new Error("expected assemble to throw");
    } catch (err) {
      expect((err as WalletMultiSigStructureError).code).toBe(
        "insufficient_signatures"
      );
    }
  });

  it("provides a stable interface across re-renders", () => {
    const { result, rerender } = renderHook(() =>
      useFreighterMultiSigAssembly(TEST_NETWORK_PASSPHRASE)
    );

    const firstRef = result.current;
    rerender();
    const secondRef = result.current;

    expect(firstRef.parseStructure).toBe(secondRef.parseStructure);
    expect(firstRef.prepareTransaction).toBe(secondRef.prepareTransaction);
    expect(firstRef.serializeTransaction).toBe(secondRef.serializeTransaction);
    expect(firstRef.signTransaction).toBe(secondRef.signTransaction);
    expect(firstRef.createSplit).toBe(secondRef.createSplit);
    expect(firstRef.signSplit).toBe(secondRef.signSplit);
    expect(firstRef.assemble).toBe(secondRef.assemble);
  });
  // Loading state (#307). `withLoading` counts in-flight operations rather
  // than holding a boolean, so overlapping signatures cannot clear the
  // spinner while one of them is still running.
  describe("isLoading", () => {
    it("is false before any operation runs", () => {
      const { result } = renderHook(() =>
        useFreighterMultiSigAssembly(TEST_NETWORK_PASSPHRASE)
      );
      expect(result.current.isLoading).toBe(false);
    });

    it("is true while a signature is in flight and false once it settles", async () => {
      const { result } = renderHook(() =>
        useFreighterMultiSigAssembly(TEST_NETWORK_PASSPHRASE)
      );

      let release: (value: string) => void = () => {};
      const signFn = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            release = resolve;
          })
      );

      let signing!: Promise<string>;
      await act(async () => {
        signing = result.current.signTransaction(buildSignedEnvelopeXdr(), signFn);
      });
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        release("signed-xdr");
        await signing;
      });
      expect(result.current.isLoading).toBe(false);
    });

    it("stays true until the last of two overlapping operations settles", async () => {
      const { result } = renderHook(() =>
        useFreighterMultiSigAssembly(TEST_NETWORK_PASSPHRASE)
      );

      const releases: Array<(value: string) => void> = [];
      const signFn = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            releases.push(resolve);
          })
      );

      const xdr = buildSignedEnvelopeXdr();
      let first!: Promise<string>;
      let second!: Promise<string>;
      await act(async () => {
        first = result.current.signTransaction(xdr, signFn);
        second = result.current.signTransaction(xdr, signFn);
      });
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        releases[0]("first");
        await first;
      });
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        releases[1]("second");
        await second;
      });
      expect(result.current.isLoading).toBe(false);
    });

    it("clears the loading state when the signing function rejects", async () => {
      const { result } = renderHook(() =>
        useFreighterMultiSigAssembly(TEST_NETWORK_PASSPHRASE)
      );

      const signFn = vi.fn(async () => {
        throw new Error("user rejected");
      });

      await act(async () => {
        await expect(
          result.current.signTransaction(buildSignedEnvelopeXdr(), signFn)
        ).rejects.toThrow("user rejected");
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
