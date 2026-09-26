import { describe, expect, it } from "vitest";
import {
  CONTRACT_PAUSE_SKELETON_BLOCKS,
  CONTRACT_PAUSE_SKELETON_LABEL,
  getContractPauseSkeletonA11y,
  shouldShowContractPauseSkeleton,
} from "../app/lib/contract_pause_switch_skeleton";

describe("contract_pause_switch skeleton", () => {
  it("defines placeholder frames for title, status, toggle and meta", () => {
    expect(CONTRACT_PAUSE_SKELETON_BLOCKS.map((b) => b.kind)).toEqual([
      "title",
      "status",
      "toggle",
      "meta",
    ]);
  });

  it("uses unique keys and pulse animation", () => {
    const keys = CONTRACT_PAUSE_SKELETON_BLOCKS.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const b of CONTRACT_PAUSE_SKELETON_BLOCKS) {
      expect(b.className).toContain("animate-pulse");
    }
  });

  it("shows placeholders while loading without data", () => {
    expect(shouldShowContractPauseSkeleton({ isLoading: true, hasData: false })).toBe(true);
  });

  it("hides placeholders once data is present or loading ends", () => {
    expect(shouldShowContractPauseSkeleton({ isLoading: true, hasData: true })).toBe(false);
    expect(shouldShowContractPauseSkeleton({ isLoading: false, hasData: false })).toBe(false);
  });

  it("exposes busy status semantics", () => {
    expect(getContractPauseSkeletonA11y()).toEqual({
      role: "status",
      "aria-busy": true,
      "aria-label": CONTRACT_PAUSE_SKELETON_LABEL,
    });
  });
});
