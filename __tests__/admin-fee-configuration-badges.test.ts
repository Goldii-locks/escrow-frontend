import { describe, expect, it } from "vitest";
import { getFeeConfigBadge } from "@/app/lib/admin_fee_configuration_badges";

describe("admin_fee_configuration badges", () => {
  it("returns a distinct badge per state", () => {
    const states = ["active", "pending", "updating", "failed", "disabled"];
    const classes = states.map((s) => getFeeConfigBadge(s).className);
    expect(new Set(classes).size).toBe(states.length);
    expect(getFeeConfigBadge("active").label).toBe("Active");
    expect(getFeeConfigBadge("failed").className).toContain("red");
  });

  it("is case and whitespace tolerant", () => {
    expect(getFeeConfigBadge("  PENDING ").state).toBe("pending");
  });

  it("falls back to disabled for unknown or missing values", () => {
    expect(getFeeConfigBadge("bogus").state).toBe("disabled");
    expect(getFeeConfigBadge(undefined).state).toBe("disabled");
    expect(getFeeConfigBadge("toString").state).toBe("disabled");
  });
});
