import { describe, expect, it } from "vitest";
import { buildInitializeArgs, toMilestoneAmounts } from "@/app/(app)/create/submit";

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

describe("buildInitializeArgs", () => {
  it("builds the initialize arguments in contract order", () => {
    expect(
      buildInitializeArgs({
        client: CLIENT,
        freelancer: FREELANCER,
        arbiter: ARBITER,
        token: TOKEN,
        autoReleaseDays: "7",
        milestones: [{ amount: "100" }, { amount: "250" }],
      })
    ).toEqual([
      { type: "address", value: CLIENT },
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
    ]);
  });
});
