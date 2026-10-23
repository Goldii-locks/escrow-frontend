// @vitest-environment jsdom
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
  assembleMultiSigTransaction,
  createMultiSigAssemblyPlan,
  parseLedgerTransactionStructure,
  splitMultiSigTransactionParts,
  validateMultiSigParts,
} from "@/app/lib/ledger_usb_bridge";
import { useLedgerMultiSigAssembly } from "@/app/hooks/useLedgerMultiSigAssembly";

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

describe("ledger_usb_bridge multi-signature assembly", () => {
  it("parses transaction structures without errors", () => {
    const { tx } = buildSampleTransaction();
    const structure = parseLedgerTransactionStructure(tx.toXDR(), NETWORK);

    expect(structure.operationCount).toBe(1);
    expect(structure.signatureCount).toBe(0);
    expect(structure.fee).toBe(BASE_FEE);
    expect(structure.sourceAccount).toMatch(/^G/);
  });

  it("creates an assembly plan with pending signers", () => {
    const { tx, source } = buildSampleTransaction();
    const cosigner = Keypair.random().publicKey();
    const plan = createMultiSigAssemblyPlan(tx.toXDR(), [source.publicKey(), cosigner], NETWORK);

    expect(plan.baseXdr).toBe(tx.toXDR());
    expect(plan.pendingSigners).toEqual([source.publicKey(), cosigner]);
    expect(plan.structure.operationCount).toBe(1);
  });

  it("merges co-signer envelopes into one multi-sig XDR", () => {
    const { tx, source } = buildSampleTransaction();
    const cosigner = Keypair.random();
    const baseXdr = tx.toXDR();

    const first = TransactionBuilder.fromXDR(baseXdr, NETWORK);
    first.sign(source);
    const second = TransactionBuilder.fromXDR(baseXdr, NETWORK);
    second.sign(cosigner);

    const mergedXdr = assembleMultiSigTransaction(
      baseXdr,
      [
        { signerPublicKey: source.publicKey(), signedXdr: first.toXDR() },
        { signerPublicKey: cosigner.publicKey(), signedXdr: second.toXDR() },
      ],
      NETWORK
    );

    const merged = parseLedgerTransactionStructure(mergedXdr, NETWORK);
    expect(merged.signatureCount).toBe(2);
    expect(validateMultiSigParts(
      [
        { signerPublicKey: source.publicKey(), signedXdr: first.toXDR() },
        { signerPublicKey: cosigner.publicKey(), signedXdr: second.toXDR() },
      ],
      NETWORK
    )).toHaveLength(2);
  });

  it("splits signer metadata for Ledger co-signing flows", () => {
    const { tx, source } = buildSampleTransaction();
    tx.sign(source);
    const parts = splitMultiSigTransactionParts(
      tx.toXDR(),
      [source.publicKey()],
      NETWORK
    );

    expect(parts).toHaveLength(1);
    expect(parts[0].signerPublicKey).toBe(source.publicKey());
    expect(parts[0].signedXdr).toBe(tx.toXDR());
  });
});

describe("useLedgerMultiSigAssembly hook", () => {
  it("exposes parse and assemble helpers bound to the network passphrase", () => {
    const { tx, source } = buildSampleTransaction();
    const cosigner = Keypair.random();
    const baseXdr = tx.toXDR();

    const first = TransactionBuilder.fromXDR(baseXdr, NETWORK);
    first.sign(source);
    const second = TransactionBuilder.fromXDR(baseXdr, NETWORK);
    second.sign(cosigner);

    const { result } = renderHook(() => useLedgerMultiSigAssembly(NETWORK));

    const structure = result.current.parseStructure(baseXdr);
    expect(structure.operationCount).toBe(1);

    const mergedXdr = result.current.assemble(baseXdr, [
      { signerPublicKey: source.publicKey(), signedXdr: first.toXDR() },
      { signerPublicKey: cosigner.publicKey(), signedXdr: second.toXDR() },
    ]);

    expect(result.current.parseStructure(mergedXdr).signatureCount).toBe(2);

    const plan = result.current.planAssembly(baseXdr, [source.publicKey()]);
    expect(plan.pendingSigners).toHaveLength(1);
  });
});
