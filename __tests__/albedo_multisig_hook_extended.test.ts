import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  Account,
  Asset,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { AlbedoTransactionAssemblyError } from "@/app/lib/albedo_connector";
import { useAlbedoMultiSigAssembly } from "@/app/hooks/useAlbedoMultiSigAssembly";

const NETWORK = Networks.TESTNET;

function buildSampleTransaction() {
  const source = Keypair.random();
  const destination = Keypair.random();
  const account = new Account(source.publicKey(), "0");
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK,
  })
    .addOperation(
      Operation.payment({
        destination: destination.publicKey(),
        asset: Asset.native(),
        amount: "1",
      })
    )
    .setTimeout(30)
    .build();

  return { tx, source, destination };
}

describe("useAlbedoMultiSigAssembly — extended lifecycle", () => {
  describe("prepareTransaction", () => {
    it("deserializes a valid XDR into a Transaction object", () => {
      const { tx } = buildSampleTransaction();
      const { result } = renderHook(() => useAlbedoMultiSigAssembly(NETWORK));

      const prepared = result.current.prepareTransaction(tx.toXDR());
      expect(prepared).toBeDefined();
      expect(typeof prepared.toXDR).toBe("function");
    });

    it("throws on empty XDR", () => {
      const { result } = renderHook(() => useAlbedoMultiSigAssembly(NETWORK));
      expect(() => result.current.prepareTransaction("")).toThrow(
        AlbedoTransactionAssemblyError
      );
    });

    it("throws on malformed XDR", () => {
      const { result } = renderHook(() => useAlbedoMultiSigAssembly(NETWORK));
      expect(() =>
        result.current.prepareTransaction("not-valid-xdr")
      ).toThrow(AlbedoTransactionAssemblyError);
    });

    it("throws on whitespace-only XDR", () => {
      const { result } = renderHook(() => useAlbedoMultiSigAssembly(NETWORK));
      expect(() => result.current.prepareTransaction("   ")).toThrow(
        AlbedoTransactionAssemblyError
      );
    });
  });

  describe("serializeTransaction", () => {
    it("serializes a Transaction back to XDR string", () => {
      const { tx } = buildSampleTransaction();
      const { result } = renderHook(() => useAlbedoMultiSigAssembly(NETWORK));

      const prepared = result.current.prepareTransaction(tx.toXDR());
      const xdr = result.current.serializeTransaction(prepared);
      expect(typeof xdr).toBe("string");
      expect(xdr.length).toBeGreaterThan(0);
    });

    it("round-trips XDR through prepare → serialize", () => {
      const { tx } = buildSampleTransaction();
      const { result } = renderHook(() => useAlbedoMultiSigAssembly(NETWORK));

      const originalXdr = tx.toXDR();
      const prepared = result.current.prepareTransaction(originalXdr);
      const serialized = result.current.serializeTransaction(prepared);

      const originalStructure = result.current.parseStructure(originalXdr);
      const roundTrippedStructure = result.current.parseStructure(serialized);

      expect(roundTrippedStructure.operationCount).toBe(
        originalStructure.operationCount
      );
      expect(roundTrippedStructure.sourceAccount).toBe(
        originalStructure.sourceAccount
      );
      expect(roundTrippedStructure.fee).toBe(originalStructure.fee);
    });
  });

  describe("signTransaction", () => {
    it("validates XDR before calling the sign function", async () => {
      const { result } = renderHook(() => useAlbedoMultiSigAssembly(NETWORK));
      const signFn = vi.fn().mockResolvedValue("signed-xdr");

      await expect(
        result.current.signTransaction("bad-xdr", signFn)
      ).rejects.toThrow(AlbedoTransactionAssemblyError);
      expect(signFn).not.toHaveBeenCalled();
    });

    it("calls sign function with valid XDR", async () => {
      const { tx } = buildSampleTransaction();
      const { result } = renderHook(() => useAlbedoMultiSigAssembly(NETWORK));
      const signFn = vi.fn().mockResolvedValue("signed-xdr");

      const xdr = await result.current.signTransaction(tx.toXDR(), signFn);
      expect(xdr).toBe("signed-xdr");
      expect(signFn).toHaveBeenCalledWith(tx.toXDR());
    });

    it("propagates signing errors", async () => {
      const { tx } = buildSampleTransaction();
      const { result } = renderHook(() => useAlbedoMultiSigAssembly(NETWORK));
      const signFn = vi
        .fn()
        .mockRejectedValue(new Error("user rejected signature"));

      await expect(
        result.current.signTransaction(tx.toXDR(), signFn)
      ).rejects.toThrow("user rejected signature");
    });
  });

  describe("assemble — multi-signature flow", () => {
    it("merges multiple signed XDRs while preserving existing signatures", () => {
      const { tx, source } = buildSampleTransaction();
      const cosigner = Keypair.random();
      const baseXdr = tx.toXDR();

      const first = TransactionBuilder.fromXDR(baseXdr, NETWORK);
      first.sign(source);
      const second = TransactionBuilder.fromXDR(baseXdr, NETWORK);
      second.sign(cosigner);

      const { result } = renderHook(() => useAlbedoMultiSigAssembly(NETWORK));

      const mergedXdr = result.current.assemble(baseXdr, [
        { signerPublicKey: source.publicKey(), signedXdr: first.toXDR() },
        { signerPublicKey: cosigner.publicKey(), signedXdr: second.toXDR() },
      ]);

      const structure = result.current.parseStructure(mergedXdr);
      expect(structure.signatureCount).toBe(2);
    });

    it("produces valid XDR that parses without errors", () => {
      const { tx, source } = buildSampleTransaction();
      const cosigner = Keypair.random();
      const baseXdr = tx.toXDR();

      const first = TransactionBuilder.fromXDR(baseXdr, NETWORK);
      first.sign(source);
      const second = TransactionBuilder.fromXDR(baseXdr, NETWORK);
      second.sign(cosigner);

      const { result } = renderHook(() => useAlbedoMultiSigAssembly(NETWORK));

      const mergedXdr = result.current.assemble(baseXdr, [
        { signerPublicKey: source.publicKey(), signedXdr: first.toXDR() },
        { signerPublicKey: cosigner.publicKey(), signedXdr: second.toXDR() },
      ]);

      expect(() => result.current.parseStructure(mergedXdr)).not.toThrow();
    });
  });

  describe("full lifecycle — build → prepare → sign → assemble → validate", () => {
    it("completes the entire multi-sig flow without errors", () => {
      const { tx, source } = buildSampleTransaction();
      const cosigner = Keypair.random();
      const baseXdr = tx.toXDR();

      const { result } = renderHook(() => useAlbedoMultiSigAssembly(NETWORK));

      // Step 1: Parse structure
      const structure = result.current.parseStructure(baseXdr);
      expect(structure.operationCount).toBe(1);

      // Step 2: Create assembly plan
      const plan = result.current.planAssembly(baseXdr, [
        source.publicKey(),
        cosigner.publicKey(),
      ]);
      expect(plan.pendingSigners).toHaveLength(2);

      // Step 3: Sign (simulated)
      const first = TransactionBuilder.fromXDR(baseXdr, NETWORK);
      first.sign(source);
      const second = TransactionBuilder.fromXDR(baseXdr, NETWORK);
      second.sign(cosigner);

      // Step 4: Split parts from a signed XDR (requires at least one signature)
      const parts = result.current.splitParts(
        first.toXDR(),
        [source.publicKey(), cosigner.publicKey()]
      );
      expect(parts).toHaveLength(2);

      // Step 5: Assemble
      const mergedXdr = result.current.assemble(baseXdr, [
        { signerPublicKey: source.publicKey(), signedXdr: first.toXDR() },
        { signerPublicKey: cosigner.publicKey(), signedXdr: second.toXDR() },
      ]);

      // Step 6: Validate assembled result
      const mergedStructure = result.current.parseStructure(mergedXdr);
      expect(mergedStructure.signatureCount).toBe(2);

      // Step 7: Check missing signers
      const missing = result.current.missingSigners(plan, [
        source.publicKey(),
        cosigner.publicKey(),
      ]);
      expect(missing).toHaveLength(0);
    });
  });
});
