import type { xdr } from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE, createRpcServer } from "@/app/lib/config";

/**
 * Thrown when a read-only simulation fails. `contractErrorCode` carries the
 * contract's `Error` enum value when the RPC reported one
 * (`HostError: Error(Contract, #42)`), so callers can branch on it.
 */
export class ContractReadError extends Error {
  readonly contractErrorCode: number | null;

  constructor(message: string) {
    super(message);
    this.name = "ContractReadError";
    this.contractErrorCode = parseSimulationContractErrorCode(message);
  }
}

/**
 * Extracts the contract error code from a Soroban simulation error string,
 * e.g. `"HostError: Error(Contract, #42)"` → `42`. Returns null otherwise.
 */
export function parseSimulationContractErrorCode(message: string): number | null {
  const match = /Error\(Contract,\s*#(\d+)\)/.exec(message);
  if (!match) return null;
  const code = Number.parseInt(match[1], 10);
  return Number.isFinite(code) ? code : null;
}

/**
 * Simulates a contract call against the Soroban RPC and returns its decoded
 * return value. Nothing is signed or submitted: simulation runs in recording
 * auth mode, so a call that `require_auth`s an address (e.g. `sweep_excess`)
 * still reports what it would return. The source account does not need to
 * exist, so a random key is used (same approach as `token_validation.ts`).
 */
export async function simulateContractRead(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = []
): Promise<unknown> {
  // Loaded on demand so importing this module (e.g. from MilestoneCard via
  // arbiter_fee) doesn't pull the SDK into every bundle — see config.ts.
  const [server, { Api }, { Account, Contract, Keypair, TransactionBuilder, scValToNative }] =
    await Promise.all([
      createRpcServer(),
      import("@stellar/stellar-sdk/rpc"),
      import("@stellar/stellar-sdk"),
    ]);
  const account = new Account(Keypair.random().publicKey(), "0");
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  const response = await server.simulateTransaction(tx);

  if (Api.isSimulationError(response)) {
    throw new ContractReadError(response.error);
  }
  if (!response.result) {
    throw new ContractReadError("Simulation returned no result");
  }
  return scValToNative(response.result.retval);
}
