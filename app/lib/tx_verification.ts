/**
 * Checks that the transaction `POST /api/jobs/build-tx` returned is the call
 * the user asked for, before it reaches the wallet (#889).
 *
 * The backend builds and simulates the transaction, so the browser only gets
 * an XDR string back. Without this check, the backend, or anything between the
 * browser and it, could hand the wallet a different transaction (a token
 * `transfer` from the user, say) and the user would approve it believing it
 * was "Approve milestone": wallets show Soroban calls tersely and nobody
 * decodes XDR by hand.
 *
 * The prepared transaction must:
 *  - be a plain (not fee-bump) transaction whose source is `sourceAddress`;
 *  - contain exactly one operation, an `invokeHostFunction` with no other
 *    source account;
 *  - invoke `contractId`.`method` with exactly the requested arguments;
 *  - carry only authorisation entries whose root invocation is that same
 *    call (sub-invocations, such as the token transfer inside `fund`, are
 *    what the call itself needs and are left to the contract).
 *
 * The network passphrase isn't part of the transaction envelope; it is bound
 * in at signing time by the wallet, whose network is checked separately
 * (`assertWalletNetwork`). The envelope is parsed against the app's
 * passphrase so the hash the wallet signs is the app network's.
 */
import {
  Address,
  FeeBumpTransaction,
  TransactionBuilder,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE } from "@/app/lib/network_config";
import { PreparedTransactionMismatchError } from "@/app/lib/errors";

/** Same shape as `ContractArg` in `transactions.ts` (kept local to avoid a cycle). */
export interface ExpectedContractArg {
  type: string;
  value: unknown;
}

export interface ExpectedContractCall {
  contractId: string;
  method: string;
  args: ExpectedContractArg[];
  sourceAddress: string;
}

function mismatch(reason: string): never {
  throw new PreparedTransactionMismatchError(reason);
}

function asText(value: { toString(): string } | string): string {
  return typeof value === "string" ? value : value.toString();
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function toBigInt(value: unknown): bigint | null {
  try {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isInteger(value)) return BigInt(value);
    if (typeof value === "string" && value.trim() !== "") return BigInt(value.trim());
  } catch {
    // Not an integer.
  }
  return null;
}

function toBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function normaliseHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const hex = value.trim().toLowerCase().replace(/^0x/, "");
  return /^([0-9a-f]{2})*$/.test(hex) ? hex : null;
}

function isContractArg(value: unknown): value is ExpectedContractArg {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

function isSymbol(value: xdr.ScVal, name: string): boolean {
  return value.type === "scvSymbol" && asText(value.sym) === name;
}

const INTEGER_TYPES: Record<string, xdr.ScVal["type"]> = {
  u32: "scvU32",
  i32: "scvI32",
  u64: "scvU64",
  i64: "scvI64",
  u128: "scvU128",
  i128: "scvI128",
  u256: "scvU256",
  i256: "scvI256",
};

/**
 * Whether `actual` encodes `expected`. Unknown argument types fail closed:
 * a value the frontend can't check is a value it won't sign.
 */
export function scValMatchesArg(actual: xdr.ScVal, expected: ExpectedContractArg): boolean {
  const { type, value } = expected;

  if (type in INTEGER_TYPES) {
    if (actual.type !== INTEGER_TYPES[type]) return false;
    const want = toBigInt(value);
    if (want === null) return false;
    return toBigInt(scValToNative(actual)) === want;
  }

  switch (type) {
    case "address":
      return (
        actual.type === "scvAddress" &&
        typeof value === "string" &&
        Address.fromScAddress(actual.address).toString() === value
      );
    case "bool":
      return actual.type === "scvBool" && toBool(value) === actual.b;
    case "string":
      return (
        actual.type === "scvString" && typeof value === "string" && asText(actual.str) === value
      );
    case "symbol":
      return typeof value === "string" && isSymbol(actual, value);
    case "bytes": {
      const want = normaliseHex(value);
      return actual.type === "scvBytes" && want !== null && toHex(actual.bytes.value) === want;
    }
    case "vec": {
      if (actual.type !== "scvVec" || !Array.isArray(value)) return false;
      const items = actual.vec ?? [];
      return (
        items.length === value.length &&
        value.every((item, i) => isContractArg(item) && scValMatchesArg(items[i], item))
      );
    }
    case "struct": {
      // Soroban structs are maps keyed by field-name symbols.
      if (actual.type !== "scvMap" || typeof value !== "object" || value === null) return false;
      const fields = Object.entries(value as Record<string, unknown>);
      const entries = actual.map ?? [];
      if (entries.length !== fields.length) return false;
      return fields.every(([name, field]) => {
        const entry = entries.find((e) => isSymbol(e.key, name));
        return !!entry && isContractArg(field) && scValMatchesArg(entry.val, field);
      });
    }
    case "enum": {
      // A unit enum variant is a one-element vec holding the variant symbol.
      if (actual.type !== "scvVec" || typeof value !== "string") return false;
      const items = actual.vec ?? [];
      return items.length === 1 && isSymbol(items[0], value);
    }
    default:
      return false;
  }
}

/**
 * Decodes `preparedXdr` and throws {@link PreparedTransactionMismatchError}
 * unless it is exactly `expected`. Call before handing the XDR to a wallet.
 */
export function verifyPreparedTransaction(
  preparedXdr: string,
  expected: ExpectedContractCall,
  networkPassphrase: string = NETWORK_PASSPHRASE
): void {
  let tx: ReturnType<typeof TransactionBuilder.fromXDR>;
  try {
    tx = TransactionBuilder.fromXDR(preparedXdr, networkPassphrase);
  } catch {
    mismatch("the prepared transaction could not be decoded");
  }

  if (tx instanceof FeeBumpTransaction) mismatch("unexpected fee-bump transaction");
  if (tx.networkPassphrase !== networkPassphrase) mismatch("network passphrase differs");
  if (tx.source !== expected.sourceAddress) mismatch("transaction source differs");
  if (tx.operations.length !== 1) mismatch(`expected 1 operation, got ${tx.operations.length}`);

  const op = tx.operations[0];
  if (op.type !== "invokeHostFunction") mismatch(`unexpected operation type ${op.type}`);
  if (op.source !== undefined && op.source !== expected.sourceAddress) {
    mismatch("operation source differs");
  }

  if (op.func.type !== "hostFunctionTypeInvokeContract") {
    mismatch("operation is not a contract call");
  }
  const call = op.func.invokeContract;

  if (Address.fromScAddress(call.contractAddress).toString() !== expected.contractId) {
    mismatch("contract differs");
  }
  if (asText(call.functionName) !== expected.method) mismatch("function name differs");

  const args = call.args;
  if (args.length !== expected.args.length) {
    mismatch(`expected ${expected.args.length} arguments, got ${args.length}`);
  }
  expected.args.forEach((arg, i) => {
    if (!scValMatchesArg(args[i], arg)) mismatch(`argument ${i} (${arg.type}) differs`);
  });

  const callXdr = call.toXDR("base64");
  for (const entry of op.auth ?? []) {
    const root = entry.rootInvocation.function;
    if (
      root.type !== "sorobanAuthorizedFunctionTypeContractFn" ||
      root.contractFn.toXDR("base64") !== callXdr
    ) {
      mismatch("authorization entry is for a different call");
    }
  }
}
