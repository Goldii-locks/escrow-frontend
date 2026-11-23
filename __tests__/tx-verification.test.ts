// @vitest-environment node
import {
  Account,
  Address,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PreparedTransactionMismatchError } from "@/app/lib/errors";
import { submitContractTransaction } from "@/app/lib/transactions";
import {
  scValMatchesArg,
  verifyPreparedTransaction,
  type ExpectedContractCall,
} from "@/app/lib/tx_verification";

const PASSPHRASE = Networks.TESTNET;
const SOURCE = Keypair.random().publicKey();
const OTHER_ACCOUNT = Keypair.random().publicKey();
const CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 1));
const OTHER_CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 2));

const EXPECTED: ExpectedContractCall = {
  contractId: CONTRACT,
  method: "approve_milestone",
  args: [
    { type: "address", value: SOURCE },
    { type: "u32", value: "2" },
  ],
  sourceAddress: SOURCE,
};

function approveArgs(index = 2): xdr.ScVal[] {
  return [new Address(SOURCE).toScVal(), xdr.ScVal.scvU32(index)];
}

function invokeArgs(contract: string, fn: string, args: xdr.ScVal[]): xdr.InvokeContractArgs {
  return new xdr.InvokeContractArgs({
    contractAddress: new Address(contract).toScAddress(),
    functionName: fn,
    args,
  });
}

function authFor(call: xdr.InvokeContractArgs): xdr.SorobanAuthorizationEntry {
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
    rootInvocation: new xdr.SorobanAuthorizedInvocation({
      function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(call),
      subInvocations: [],
    }),
  });
}

function buildXdr({
  source = SOURCE,
  contract = CONTRACT,
  fn = "approve_milestone",
  args = approveArgs(),
  auth,
  extraOperation = false,
}: {
  source?: string;
  contract?: string;
  fn?: string;
  args?: xdr.ScVal[];
  auth?: xdr.SorobanAuthorizationEntry[];
  extraOperation?: boolean;
} = {}): string {
  const builder = new TransactionBuilder(new Account(source, "1"), {
    fee: "100",
    networkPassphrase: PASSPHRASE,
  }).addOperation(
    Operation.invokeContractFunction({
      contract,
      function: fn,
      args,
      auth: auth ?? [authFor(invokeArgs(contract, fn, args))],
    })
  );
  if (extraOperation) {
    builder.addOperation(
      Operation.invokeContractFunction({
        contract: OTHER_CONTRACT,
        function: "transfer",
        args: [
          new Address(SOURCE).toScVal(),
          new Address(OTHER_ACCOUNT).toScVal(),
          nativeToScVal(BigInt("1000000000"), { type: "i128" }),
        ],
      })
    );
  }
  return builder.setTimeout(30).build().toXDR();
}

function reasonOf(fn: () => void): string {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(PreparedTransactionMismatchError);
    expect((err as Error).message).toBe("The prepared transaction didn't match your request.");
    return (err as PreparedTransactionMismatchError).reason;
  }
  throw new Error("expected a mismatch");
}

describe("verifyPreparedTransaction (#889)", () => {
  it("accepts a transaction that matches the requested call", () => {
    expect(() => verifyPreparedTransaction(buildXdr(), EXPECTED, PASSPHRASE)).not.toThrow();
  });

  it("rejects a swapped function name", () => {
    const xdrString = buildXdr({ fn: "approve_partial" });
    expect(reasonOf(() => verifyPreparedTransaction(xdrString, EXPECTED, PASSPHRASE))).toMatch(
      /function name/
    );
  });

  it("rejects an extra operation", () => {
    const xdrString = buildXdr({ extraOperation: true });
    expect(reasonOf(() => verifyPreparedTransaction(xdrString, EXPECTED, PASSPHRASE))).toMatch(
      /expected 1 operation/
    );
  });

  it("rejects a different contract", () => {
    const xdrString = buildXdr({ contract: OTHER_CONTRACT });
    expect(reasonOf(() => verifyPreparedTransaction(xdrString, EXPECTED, PASSPHRASE))).toMatch(
      /contract differs/
    );
  });

  it("rejects a different source account", () => {
    const xdrString = buildXdr({ source: OTHER_ACCOUNT });
    expect(reasonOf(() => verifyPreparedTransaction(xdrString, EXPECTED, PASSPHRASE))).toMatch(
      /source differs/
    );
  });

  it("rejects a different argument value", () => {
    const xdrString = buildXdr({ args: approveArgs(3) });
    expect(reasonOf(() => verifyPreparedTransaction(xdrString, EXPECTED, PASSPHRASE))).toMatch(
      /argument 1/
    );
  });

  it("rejects a different argument count", () => {
    const xdrString = buildXdr({ args: [...approveArgs(), xdr.ScVal.scvU32(9)] });
    expect(reasonOf(() => verifyPreparedTransaction(xdrString, EXPECTED, PASSPHRASE))).toMatch(
      /expected 2 arguments/
    );
  });

  it("rejects an authorization entry for a different call", () => {
    const transfer = invokeArgs(OTHER_CONTRACT, "transfer", [
      new Address(SOURCE).toScVal(),
      new Address(OTHER_ACCOUNT).toScVal(),
      nativeToScVal(BigInt("1"), { type: "i128" }),
    ]);
    const xdrString = buildXdr({
      auth: [authFor(invokeArgs(CONTRACT, "approve_milestone", approveArgs())), authFor(transfer)],
    });
    expect(reasonOf(() => verifyPreparedTransaction(xdrString, EXPECTED, PASSPHRASE))).toMatch(
      /authorization entry/
    );
  });

  it("rejects XDR that can't be decoded", () => {
    expect(reasonOf(() => verifyPreparedTransaction("not-xdr", EXPECTED, PASSPHRASE))).toMatch(
      /could not be decoded/
    );
  });
});

describe("scValMatchesArg", () => {
  it("matches the argument shapes the app sends", () => {
    expect(
      scValMatchesArg(nativeToScVal(BigInt("5000000"), { type: "i128" }), {
        type: "i128",
        value: "5000000",
      })
    ).toBe(true);
    expect(
      scValMatchesArg(nativeToScVal(BigInt("86400"), { type: "u64" }), {
        type: "u64",
        value: "86400",
      })
    ).toBe(true);
    expect(scValMatchesArg(xdr.ScVal.scvBool(true), { type: "bool", value: true })).toBe(true);
    expect(
      scValMatchesArg(xdr.ScVal.scvBytes(Buffer.alloc(32, 0xab)), {
        type: "bytes",
        value: "ab".repeat(32),
      })
    ).toBe(true);
    expect(
      scValMatchesArg(
        xdr.ScVal.scvVec([
          nativeToScVal(BigInt("1"), { type: "i128" }),
          nativeToScVal(BigInt("2"), { type: "i128" }),
        ]),
        {
          type: "vec",
          value: [
            { type: "i128", value: "1" },
            { type: "i128", value: "2" },
          ],
        }
      )
    ).toBe(true);
    expect(
      scValMatchesArg(
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("arbiter_fee_bps"),
            val: xdr.ScVal.scvU32(0),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("funding_mode"),
            val: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Upfront")]),
          }),
        ]),
        {
          type: "struct",
          value: {
            funding_mode: { type: "enum", value: "Upfront" },
            arbiter_fee_bps: { type: "u32", value: 0 },
          },
        }
      )
    ).toBe(true);
  });

  it("rejects mismatched types, values and unknown types", () => {
    expect(scValMatchesArg(xdr.ScVal.scvU32(1), { type: "u64", value: "1" })).toBe(false);
    expect(
      scValMatchesArg(nativeToScVal(BigInt("2"), { type: "i128" }), { type: "i128", value: "1" })
    ).toBe(false);
    expect(scValMatchesArg(xdr.ScVal.scvBool(false), { type: "bool", value: true })).toBe(false);
    expect(scValMatchesArg(xdr.ScVal.scvU32(1), { type: "mystery", value: 1 })).toBe(false);
  });
});

describe("submitContractTransaction verifies before signing (#889)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubBuildTx(preparedXdr: string) {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, xdr: preparedXdr }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("never calls signTransaction when build-tx returns a different call", async () => {
    const fetchMock = stubBuildTx(buildXdr({ fn: "transfer" }));
    const signTransaction = vi.fn(async () => "signed");

    await expect(
      submitContractTransaction({ ...EXPECTED, signTransaction })
    ).rejects.toBeInstanceOf(PreparedTransactionMismatchError);

    expect(signTransaction).not.toHaveBeenCalled();
    // Only build-tx was called; nothing was submitted.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
