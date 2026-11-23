import { describe, it, expect } from "vitest";
import { validateMilestoneAmount } from "../app/lib/milestone_amount_validation";

describe("validateMilestoneAmount", () => {
  it.each(["0", "-1", "1e7", "abc", "0.0", "1.12345678"])("rejects %s", (v) => {
    expect(validateMilestoneAmount(v)).not.toBeNull();
  });

  it.each(["1", "10000000", "1.5", "0.0000001"])("accepts %s", (v) => {
    expect(validateMilestoneAmount(v)).toBeNull();
  });
});
