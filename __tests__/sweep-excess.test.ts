import { beforeEach, describe, expect, it, vi } from "vitest";

const simulateContractRead = vi.fn();

vi.mock("@/app/lib/contract_read", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/contract_read")>()),
  simulateContractRead: (...args: unknown[]) => simulateContractRead(...args),
}));

import { ContractReadError, parseSimulationContractErrorCode } from "@/app/lib/contract_read";
import {
  buildSweepExcessArgs,
  interpretSweepPreview,
  previewSweepExcess,
  validateSweepTokenInput,
} from "@/app/lib/sweep_excess";
import { ERROR_MESSAGES } from "@/app/lib/errors";

const ESCROW = "CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH";
const CLIENT = "GAODBHVR63Z56MVQRBEJSYM2H5423LJ4WAPUUBOFG4JYY72S6ROKVZRX";
const TOKEN = "CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH";

describe("sweep_excess helpers (#898)", () => {
  // Braces matter: a function returned from beforeEach is run as teardown,
  // and mockReset() returns the mock itself.
  beforeEach(() => {
    simulateContractRead.mockReset();
  });

  it("reads the contract error code from a simulation error", () => {
    expect(parseSimulationContractErrorCode("HostError: Error(Contract, #42)")).toBe(42);
    expect(parseSimulationContractErrorCode("network down")).toBeNull();
  });

  it("treats a positive surplus as available and zero as nothing", () => {
    expect(interpretSweepPreview(BigInt(5))).toEqual({ status: "available", amount: BigInt(5) });
    expect(interpretSweepPreview(BigInt(0))).toEqual({ status: "nothing" });
    expect(interpretSweepPreview("oops").status).toBe("error");
  });

  it("previews by simulating sweep_excess(client, token)", async () => {
    simulateContractRead.mockResolvedValue(BigInt(1_234));
    await expect(previewSweepExcess(ESCROW, CLIENT, TOKEN)).resolves.toEqual({
      status: "available",
      amount: BigInt(1_234),
    });
    expect(simulateContractRead).toHaveBeenCalledWith(ESCROW, "sweep_excess", expect.any(Array));
  });

  it("maps NothingToSweep (42) to 'nothing', which hides the button", async () => {
    simulateContractRead.mockRejectedValue(
      new ContractReadError("HostError: Error(Contract, #42)")
    );
    await expect(previewSweepExcess(ESCROW, CLIENT, TOKEN)).resolves.toEqual({ status: "nothing" });
  });

  it("reports other failures as errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    simulateContractRead.mockRejectedValue(new Error("rpc down"));
    const result = await previewSweepExcess(ESCROW, CLIENT, TOKEN);
    expect(result.status).toBe("error");
  });

  it("validates the token address field", () => {
    expect(validateSweepTokenInput("")).toMatch(/Enter a token/);
    expect(validateSweepTokenInput(CLIENT)).toMatch(/valid token contract/);
    expect(validateSweepTokenInput(` ${TOKEN} `)).toBeNull();
  });

  it("builds sweep_excess(caller, token) arguments", () => {
    expect(buildSweepExcessArgs(CLIENT, ` ${TOKEN}`)).toEqual([
      { type: "address", value: CLIENT },
      { type: "address", value: TOKEN },
    ]);
  });

  it("has a friendly message for a NothingToSweep revert", () => {
    expect(ERROR_MESSAGES[42]).toMatch(/nothing to recover/);
  });
});
