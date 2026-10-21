import { describe, expect, it } from "vitest";
import { buildInitializeArgs, toMilestoneAmounts } from "@/app/(app)/create/submit";

const CLIENT = "G" + "A".repeat(55);
const FREELANCER = "G" + "B".repeat(55);
const ARBITER = "G" + "C".repeat(55);
const TOKEN = "C" + "A".repeat(55);

describe("toMilestoneAmounts", () => {
  it("trims amounts and keeps values beyond Number.MAX_SAFE_INTEGER exact", () => {
    expect(toMilestoneAmounts([{ amount: " 100 " }, { amount: "90071992547409930" }])).toEqual([
      "100",
      "90071992547409930",
    ]);
  });

  it.each(["", "  ", "1.5", "-3"])("throws on %j", (amount) => {
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
          { type: "i128", value: "100" },
          { type: "i128", value: "250" },
        ],
      },
    ]);
  });
});
