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
import {
  AlbedoTransactionAssemblyError,
  assembleAlbedoMultiSigTransaction,
  createAlbedoMultiSigAssemblyPlan,
  findMissingAlbedoSigners,
  parseAlbedoTransactionStructure,
  splitAlbedoMultiSigTransactionParts,
  validateAlbedoMultiSigParts,
} from "@/app/lib/albedo_connector";
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

describe("albedo_connector multi-signature assembly", () => {
  it("parses transaction structures without errors", () => {
    const { tx } = buildSampleTransaction();
    const structure = parseAlbedoTransactionStructure(tx.toXDR(), NETWORK);

    expect(structure.operationCount).toBe(1);
    expect(structure.signatureCount).toBe(0);
    expect(structure.fee).toBe(BASE_FEE);
    expect(structure.sourceAccount).toMatch(/^G/);
  });

  it("rejects missing or invalid transaction XDR", () => {
    expect(() => parseAlbedoTransactionStructure("", NETWORK)).toThrow(
      AlbedoTransactionAssemblyError
    );
    expect(() =>
      parseAlbedoTransactionStructure("not-valid-xdr", NETWORK)
    ).toThrow(AlbedoTransactionAssemblyError);
  });

  it("creates an assembly plan with pending signers", () => {
    const { tx, source } = buildSampleTransaction();
    const cosigner = Keypair.random().publicKey();
    const plan = createAlbedoMultiSigAssemblyPlan(
      tx.toXDR(),
      [source.publicKey(), cosigner],
      NETWORK
    );

    expect(plan.baseXdr).toBe(tx.toXDR());
    expect(plan.pendingSigners).toEqual([source.publicKey(), cosigner]);
    expect(plan.structure.operationCount).toBe(1);
  });

  it("rejects assembly plans without signers", () => {
    const { tx } = buildSampleTransaction();
    expect(() =>
      createAlbedoMultiSigAssemblyPlan(tx.toXDR(), [], NETWORK)
    ).toThrow(/signer public key/i);
  });

  it("merges co-signer envelopes into one multi-sig XDR", () => {
    const { tx, source } = buildSampleTransaction();
    const cosigner = Keypair.random();
    const baseXdr = tx.toXDR();

    const first = TransactionBuilder.fromXDR(baseXdr, NETWORK);
    first.sign(source);
    const second = TransactionBuilder.fromXDR(baseXdr, NETWORK);
    second.sign(cosigner);

    const mergedXdr = assembleAlbedoMultiSigTransaction(
      baseXdr,
      [
        { signerPublicKey: source.publicKey(), signedXdr: first.toXDR() },
        { signerPublicKey: cosigner.publicKey(), signedXdr: second.toXDR() },
      ],
      NETWORK
    );

    const merged = parseAlbedoTransactionStructure(mergedXdr, NETWORK);
    expect(merged.signatureCount).toBe(2);
    expect(
      validateAlbedoMultiSigParts(
        [
          { signerPublicKey: source.publicKey(), signedXdr: first.toXDR() },
          { signerPublicKey: cosigner.publicKey(), signedXdr: second.toXDR() },
        ],
        NETWORK
      )
    ).toHaveLength(2);
  });

  it("preserves existing single-signature behavior", () => {
    const { tx, source } = buildSampleTransaction();
    const baseXdr = tx.toXDR();
    const signed = TransactionBuilder.fromXDR(baseXdr, NETWORK);
    signed.sign(source);

    const mergedXdr = assembleAlbedoMultiSigTransaction(
      baseXdr,
      [{ signerPublicKey: source.publicKey(), signedXdr: signed.toXDR() }],
      NETWORK
    );

    expect(parseAlbedoTransactionStructure(mergedXdr, NETWORK).signatureCount).toBe(
      1
    );
  });

  it("detects missing signatures against an assembly plan", () => {
    const { tx, source } = buildSampleTransaction();
    const cosigner = Keypair.random().publicKey();
    const plan = createAlbedoMultiSigAssemblyPlan(
      tx.toXDR(),
      [source.publicKey(), cosigner],
      NETWORK
    );

    expect(findMissingAlbedoSigners(plan, [source.publicKey()])).toEqual([
      cosigner,
    ]);
    expect(
      findMissingAlbedoSigners(plan, [source.publicKey(), cosigner])
    ).toEqual([]);
  });

  it("rejects empty / incomplete multi-sig parts", () => {
    expect(() => validateAlbedoMultiSigParts([], NETWORK)).toThrow(
      AlbedoTransactionAssemblyError
    );
    expect(() =>
      validateAlbedoMultiSigParts(
        [{ signerPublicKey: "", signedXdr: "x" }],
        NETWORK
      )
    ).toThrow(/Missing signer/);
  });

  it("surfaces signing-failure style assembly errors when XDR is bad", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { tx, source } = buildSampleTransaction();

    expect(() =>
      assembleAlbedoMultiSigTransaction(
        tx.toXDR(),
        [{ signerPublicKey: source.publicKey(), signedXdr: "bad-xdr" }],
        NETWORK
      )
    ).toThrow(AlbedoTransactionAssemblyError);

    warnSpy.mockRestore();
  });

  it("splits signer metadata for Albedo co-signing flows", () => {
    const { tx, source } = buildSampleTransaction();
    tx.sign(source);
    const parts = splitAlbedoMultiSigTransactionParts(
      tx.toXDR(),
      [source.publicKey()],
      NETWORK
    );

    expect(parts).toHaveLength(1);
    expect(parts[0].signerPublicKey).toBe(source.publicKey());
    expect(parts[0].signedXdr).toBe(tx.toXDR());
  });
});

describe("useAlbedoMultiSigAssembly hook", () => {
  it("exposes parse and assemble helpers bound to the network passphrase", () => {
    const { tx, source } = buildSampleTransaction();
    const cosigner = Keypair.random();
    const baseXdr = tx.toXDR();

    const first = TransactionBuilder.fromXDR(baseXdr, NETWORK);
    first.sign(source);
    const second = TransactionBuilder.fromXDR(baseXdr, NETWORK);
    second.sign(cosigner);

    const { result } = renderHook(() => useAlbedoMultiSigAssembly(NETWORK));

    const structure = result.current.parseStructure(baseXdr);
    expect(structure.operationCount).toBe(1);

    const mergedXdr = result.current.assemble(baseXdr, [
      { signerPublicKey: source.publicKey(), signedXdr: first.toXDR() },
      { signerPublicKey: cosigner.publicKey(), signedXdr: second.toXDR() },
    ]);

    expect(result.current.parseStructure(mergedXdr).signatureCount).toBe(2);

    const plan = result.current.planAssembly(baseXdr, [source.publicKey()]);
    expect(plan.pendingSigners).toHaveLength(1);
    expect(
      result.current.missingSigners(plan, [])
    ).toEqual([source.publicKey()]);
  });
});
