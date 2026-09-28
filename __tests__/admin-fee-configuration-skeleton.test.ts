import { describe, expect, it } from "vitest";
import {
  FEE_CONFIG_SKELETON_ARIA,
  FEE_CONFIG_SKELETON_FRAMES,
  getFeeConfigSkeleton,
} from "@/app/lib/admin_fee_configuration_skeleton";

describe("admin_fee_configuration skeleton", () => {
  it("returns placeholder frames while loading", () => {
    expect(getFeeConfigSkeleton(true)).toBe(FEE_CONFIG_SKELETON_FRAMES);
    expect(getFeeConfigSkeleton(true).some((f) => f.kind === "input")).toBe(true);
  });
  it("returns nothing once loaded", () => {
    expect(getFeeConfigSkeleton(false)).toEqual([]);
  });
  it("has unique frame ids and busy aria state", () => {
    const ids = FEE_CONFIG_SKELETON_FRAMES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(FEE_CONFIG_SKELETON_ARIA["aria-busy"]).toBe(true);
  });
});
