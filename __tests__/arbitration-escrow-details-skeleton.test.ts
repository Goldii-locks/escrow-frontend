import { describe, expect, it } from "vitest";
import {
  ARBITRATION_SKELETON_ARIA,
  ARBITRATION_SKELETON_FRAMES,
  getArbitrationSkeleton,
} from "@/app/lib/arbitration_escrow_details_skeleton";

describe("arbitration_escrow_details loading skeletons (#481)", () => {
  it("returns structured placeholder wireframe frames when loading is true", () => {
    const frames = getArbitrationSkeleton(true);
    expect(frames).toHaveLength(ARBITRATION_SKELETON_FRAMES.length);
    expect(frames.some((f) => f.kind === "header")).toBe(true);
    expect(frames.some((f) => f.kind === "grid-cell")).toBe(true);
    expect(frames.some((f) => f.kind === "action-bar")).toBe(true);
  });

  it("returns empty array when loading has finished", () => {
    expect(getArbitrationSkeleton(false)).toEqual([]);
  });

  it("defines standard accessibility ARIA attributes for the placeholder loader", () => {
    expect(ARBITRATION_SKELETON_ARIA.role).toBe("status");
    expect(ARBITRATION_SKELETON_ARIA["aria-busy"]).toBe(true);
    expect(ARBITRATION_SKELETON_ARIA["aria-label"]).toBe(
      "Loading locked escrow details",
    );
  });
});
