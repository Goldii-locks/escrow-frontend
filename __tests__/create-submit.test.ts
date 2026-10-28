import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCreateEscrowArgs,
  randomSaltHex,
  toMilestoneAmounts,
} from "@/app/(app)/create/submit";

const CLIENT = "G" + "A".repeat(55);
const FREELANCER = "G" + "B".repeat(55);
const ARBITER = "G" + "C".repeat(55);
const TOKEN = "C" + "A".repeat(55);

describe("toMilestoneAmounts", () => {
  it("converts decimal token amounts to base units at 7 decimals (#574)", () => {
    expect(toMilestoneAmounts([{ amount: " 150 " }, { amount: "12.5" }])).toEqual([
      "1500000000",
      "125000000",
    ]);
  });

  it("keeps values beyond Number.MAX_SAFE_INTEGER exact", () => {
    expect(toMilestoneAmounts([{ amount: "9007199254740993" }])).toEqual([
      "90071992547409930000000",
    ]);
  });

  it.each(["", "  ", "-3", "1.12345678"])("throws on %j", (amount) => {
    expect(() => toMilestoneAmounts([{ amount }])).toThrow("Invalid milestone amount");
  });
});

const PARAMS = {
  client: CLIENT,
  freelancer: FREELANCER,
  arbiter: ARBITER,
  token: TOKEN,
  autoReleaseDays: "7",
  milestones: [{ amount: "100" }, { amount: "250" }],
};
const SALT = "ab".repeat(32);

describe("buildCreateEscrowArgs", () => {
  it("builds escrow-factory create_escrow arguments in contract order", () => {
    expect(buildCreateEscrowArgs(PARAMS, SALT)).toEqual([
      { type: "address", value: CLIENT },
      { type: "address", value: FREELANCER },
      { type: "address", value: ARBITER },
      { type: "address", value: TOKEN },
      { type: "u64", value: String(7 * 24 * 60 * 60) },
      {
        type: "vec",
        value: [
          { type: "i128", value: "1000000000" },
          { type: "i128", value: "2500000000" },
        ],
      },
      {
        type: "vec",
        value: [
          { type: "bytes", value: "00".repeat(32) },
          { type: "bytes", value: "00".repeat(32) },
        ],
      },
      {
        type: "struct",
        value: {
          funding_mode: { type: "enum", value: "Upfront" },
          dispute_timeout_seconds: { type: "u64", value: String(30 * 24 * 60 * 60) },
          arbiter_fee_bps: { type: "u32", value: 0 },
        },
      },
      { type: "bytes", value: SALT },
    ]);
  });
});

describe("randomSaltHex", () => {
  it("returns 32 random bytes as hex, different each call", () => {
    const a = randomSaltHex();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(randomSaltHex()).not.toBe(a);
  });
});

describe("submitCreateJob", () => {
  afterEach(() => {
    vi.doUnmock("@/app/lib/transactions");
    vi.resetModules();
  });

  async function loadWithFactory(factoryId: string) {
    const submitContractTransaction = vi.fn().mockResolvedValue("tx-hash");
    vi.resetModules();
    vi.doMock("@/app/lib/transactions", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/app/lib/transactions")>()),
      FACTORY_CONTRACT_ID: factoryId,
      submitContractTransaction,
    }));
    const { submitCreateJob, FACTORY_NOT_CONFIGURED } = await import("@/app/(app)/create/submit");
    return { submitCreateJob, FACTORY_NOT_CONFIGURED, submitContractTransaction };
  }

  it("calls create_escrow on the configured factory, signed by the client", async () => {
    const factory = "C" + "F".repeat(55);
    const { submitCreateJob, submitContractTransaction } = await loadWithFactory(factory);

    await expect(
      submitCreateJob(PARAMS, { signTransaction: vi.fn(), onPhase: vi.fn() })
    ).resolves.toBe("tx-hash");

    expect(submitContractTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: factory,
        method: "create_escrow",
        sourceAddress: CLIENT,
      })
    );
    const { args } = submitContractTransaction.mock.calls[0][0];
    expect(args).toHaveLength(9);
    expect(args[8]).toEqual({ type: "bytes", value: expect.stringMatching(/^[0-9a-f]{64}$/) });
  });

  it("fails with a clear message when no factory is configured", async () => {
    const { submitCreateJob, FACTORY_NOT_CONFIGURED, submitContractTransaction } =
      await loadWithFactory("");

    await expect(
      submitCreateJob(PARAMS, { signTransaction: vi.fn(), onPhase: vi.fn() })
    ).rejects.toThrow(FACTORY_NOT_CONFIGURED);
    expect(submitContractTransaction).not.toHaveBeenCalled();
  });
});
