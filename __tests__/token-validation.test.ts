import { beforeEach, describe, expect, it, vi } from "vitest";
import { Transaction, nativeToScVal, xdr } from "@stellar/stellar-sdk";

const simulateTransaction = vi.fn();

vi.mock("@/app/lib/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/config")>()),
  createRpcServer: async () => ({ simulateTransaction }),
}));

import { validateTokenContract } from "@/app/lib/token_validation";

const TOKEN = "CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH";

function invokedFunction(tx: Transaction) {
  return tx.operations[0] as unknown as {
    func: xdr.HostFunction;
  };
}

describe("validateTokenContract (#668)", () => {
  beforeEach(() => {
    simulateTransaction.mockReset();
  });

  it("calls symbol() and decimals() with no arguments and returns the token info", async () => {
    simulateTransaction.mockImplementation(async (tx: Transaction) => {
      const call = invokedFunction(tx).func.invokeContract();
      expect(call.args()).toHaveLength(0);
      const method = call.functionName().toString();
      return {
        result: {
          retval:
            method === "symbol"
              ? nativeToScVal("USDC", { type: "string" })
              : nativeToScVal(7, { type: "u32" }),
        },
      };
    });

    await expect(validateTokenContract(TOKEN)).resolves.toEqual({
      valid: true,
      symbol: "USDC",
      decimals: 7,
    });
    expect(simulateTransaction).toHaveBeenCalledTimes(2);
  });

  it("reports a contract without the token interface as invalid", async () => {
    simulateTransaction.mockResolvedValue({ error: "HostError: non-existent function" });

    const result = await validateTokenContract(TOKEN);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Could not validate this contract as a token/);
  });

  it("rejects a non-numeric decimals result", async () => {
    simulateTransaction.mockResolvedValue({
      result: { retval: nativeToScVal("USDC", { type: "string" }) },
    });

    const result = await validateTokenContract(TOKEN);
    expect(result.valid).toBe(false);
  });
});
