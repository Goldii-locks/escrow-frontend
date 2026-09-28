import { describe, expect, it } from "vitest";
import {
  CLIENT_REFUND_SKELETON_ARIA,
  CLIENT_REFUND_SKELETON_FRAMES,
  getClientRefundSkeleton,
} from "@/app/lib/client_refund_panel_skeleton";

describe("client_refund_panel loading skeletons (#501)", () => {
  it("returns structured placeholder wireframe frames when loading is true", () => {
    const frames = getClientRefundSkeleton(true);
    expect(frames).toHaveLength(CLIENT_REFUND_SKELETON_FRAMES.length);
    expect(frames.some((f) => f.kind === "title")).toBe(true);
    expect(frames.some((f) => f.kind === "form-field")).toBe(true);
    expect(frames.some((f) => f.kind === "list-item")).toBe(true);
  });

  it("returns empty array when loading has finished", () => {
    expect(getClientRefundSkeleton(false)).toEqual([]);
  });

  it("defines standard accessibility ARIA attributes for the placeholder loader", () => {
    expect(CLIENT_REFUND_SKELETON_ARIA.role).toBe("status");
    expect(CLIENT_REFUND_SKELETON_ARIA["aria-busy"]).toBe(true);
    expect(CLIENT_REFUND_SKELETON_ARIA["aria-label"]).toBe(
      "Loading client refund panel",
    );
  });
});
