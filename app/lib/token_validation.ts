import {
  Account,
  Contract,
  Keypair,
  TransactionBuilder,
  scValToNative,
} from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE, createRpcServer } from "@/app/lib/config";

/**
 * Validate a manually entered contract address as a SEP-41 token by simulating
 * the `symbol()` and `decimals()` invocations against the Soroban RPC. This
 * does not submit a transaction — it uses `server.simulateTransaction` which
 * is a read-only call.
 *
 * SEP-41 token contracts implement `symbol() -> String` and
 * `decimals() -> u32`. If either call fails, the address is not a token.
 */

export interface TokenValidationResult {
  /** true when the address is a SEP-41 token. */
  valid: boolean;
  /** Token symbol, e.g. "USDC". Present only when valid. */
  symbol?: string;
  /** Token decimals, e.g. 7. Present only when valid. */
  decimals?: number;
  /** Human-readable error when the address is not a token or the call failed. */
  error?: string;
}

/**
 * Simulate a zero-argument read (`symbol` / `decimals`) on the contract and
 * return its decoded value. Simulation never submits anything and does not
 * need the source account to exist, so a random key is enough.
 */
async function simulateTokenCall(tokenAddress: string, method: string): Promise<unknown> {
  const [server, { Api }] = await Promise.all([
    createRpcServer(),
    import("@stellar/stellar-sdk/rpc"),
  ]);
  const account = new Account(Keypair.random().publicKey(), "0");
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(tokenAddress).call(method))
    .setTimeout(30)
    .build();

  const response = await server.simulateTransaction(tx);

  if (Api.isSimulationError(response)) {
    throw new Error(response.error);
  }
  if (!response.result) {
    throw new Error("Simulation returned no result");
  }
  return scValToNative(response.result.retval);
}

/**
 * Validate a contract address as a SEP-41 token by simulating `symbol()` and
 * `decimals()` calls. Returns a structured result so the UI can show the
 * token info or an error.
 */
export async function validateTokenContract(tokenAddress: string): Promise<TokenValidationResult> {
  try {
    const [symbolResult, decimalsResult] = await Promise.all([
      simulateTokenCall(tokenAddress, "symbol"),
      simulateTokenCall(tokenAddress, "decimals"),
    ]);
    const decimals = Number(decimalsResult);

    if (
      typeof symbolResult !== "string" ||
      symbolResult === "" ||
      !Number.isInteger(decimals) ||
      decimals < 0
    ) {
      return {
        valid: false,
        error:
          "This contract does not implement the SEP-41 token interface (symbol/decimals not found).",
      };
    }

    return {
      valid: true,
      symbol: symbolResult,
      decimals,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      valid: false,
      error: `Could not validate this contract as a token: ${message}`,
    };
  }
}
