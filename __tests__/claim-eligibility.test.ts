import { describe, expect, it } from "vitest";
import { computeAutoReleaseDeadlineMs, getClaimEligibility } from "@/app/lib/claimEligibility";

const DELIVERED_S = 1_700_000_000; // epoch seconds
const DELIVERED_MS = DELIVERED_S * 1000;
const WINDOW_S = 3_600;
const DEADLINE_MS = DELIVERED_MS + WINDOW_S * 1000;

describe("computeAutoReleaseDeadlineMs", () => {
  it("treats deliveredAt below 1e12 as seconds and above as milliseconds", () => {
    expect(
      computeAutoReleaseDeadlineMs({ deliveredAt: DELIVERED_S, autoReleaseSeconds: WINDOW_S })
    ).toBe(DEADLINE_MS);
    expect(
      computeAutoReleaseDeadlineMs({ deliveredAt: DELIVERED_MS, autoReleaseSeconds: WINDOW_S })
    ).toBe(DEADLINE_MS);
  });

  it("adds the extension to the window", () => {
    expect(
      computeAutoReleaseDeadlineMs({
        deliveredAt: DELIVERED_S,
        autoReleaseSeconds: WINDOW_S,
        extensionSeconds: 600,
      })
    ).toBe(DEADLINE_MS + 600_000);
  });

  it("ignores a non-finite extension", () => {
    expect(
      computeAutoReleaseDeadlineMs({
        deliveredAt: DELIVERED_S,
        autoReleaseSeconds: WINDOW_S,
        extensionSeconds: Number.NaN,
      })
    ).toBe(DEADLINE_MS);
  });

  it.each([
    ["missing", undefined],
    ["null", null],
    ["zero", 0],
    ["negative", -1],
    ["NaN", Number.NaN],
  ])("returns null when deliveredAt is %s", (_label, deliveredAt) => {
    expect(computeAutoReleaseDeadlineMs({ deliveredAt, autoReleaseSeconds: WINDOW_S })).toBeNull();
  });

  it.each([
    ["missing", undefined],
    ["negative", -1],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("returns null when autoReleaseSeconds is %s", (_label, autoReleaseSeconds) => {
    expect(
      computeAutoReleaseDeadlineMs({ deliveredAt: DELIVERED_S, autoReleaseSeconds })
    ).toBeNull();
  });

  it("accepts a zero-length window", () => {
    expect(computeAutoReleaseDeadlineMs({ deliveredAt: DELIVERED_S, autoReleaseSeconds: 0 })).toBe(
      DELIVERED_MS
    );
  });
});

describe("getClaimEligibility", () => {
  const onChain = { deliveredAt: DELIVERED_S, autoReleaseSeconds: WINDOW_S };

  it("prefers the backend deadline over the computed one", () => {
    const backendDeadlineMs = DEADLINE_MS + 60_000;
    expect(getClaimEligibility({ ...onChain, backendDeadlineMs, now: DEADLINE_MS })).toEqual({
      show: false,
      deadlineMs: backendDeadlineMs,
      deadlineUnknown: false,
    });
  });

  it("falls back to the computed deadline when the backend has none", () => {
    expect(getClaimEligibility({ ...onChain, backendDeadlineMs: null, now: 0 })).toEqual({
      show: false,
      deadlineMs: DEADLINE_MS,
      deadlineUnknown: false,
    });
  });

  it("shows the button exactly at the deadline, not a millisecond before", () => {
    expect(getClaimEligibility({ ...onChain, now: DEADLINE_MS - 1 }).show).toBe(false);
    expect(getClaimEligibility({ ...onChain, now: DEADLINE_MS }).show).toBe(true);
    expect(getClaimEligibility({ ...onChain, now: DEADLINE_MS + 1 }).show).toBe(true);
  });

  it("moves the boundary by the extension", () => {
    const input = { ...onChain, extensionSeconds: 60 };
    expect(getClaimEligibility({ ...input, now: DEADLINE_MS }).show).toBe(false);
    expect(getClaimEligibility({ ...input, now: DEADLINE_MS + 60_000 }).show).toBe(true);
  });

  it("shows the button with an unknown deadline when deliveredAt is missing", () => {
    expect(getClaimEligibility({ autoReleaseSeconds: WINDOW_S, now: 0 })).toEqual({
      show: true,
      deadlineMs: null,
      deadlineUnknown: true,
    });
  });
});
