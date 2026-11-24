/**
 * Tests for issue #896: escrow_lock_state helpers.
 *
 * Covers classifyEscrowLock, getEscrowLockState, and all three lock kinds.
 */
import { describe, expect, it } from "vitest";
import {
  classifyEscrowLock,
  getEscrowLockState,
  type EscrowLockFlags,
} from "@/app/lib/escrow_lock_state";

describe("classifyEscrowLock", () => {
  it("returns none when all flags are absent", () => {
    expect(classifyEscrowLock({})).toBe("none");
  });

  it("returns none when all flags are false", () => {
    expect(
      classifyEscrowLock({ pausedByAdmin: false, pausedByEmergency: false, cancelLocked: false })
    ).toBe("none");
  });

  it("returns admin_pause when pausedByAdmin is true", () => {
    expect(classifyEscrowLock({ pausedByAdmin: true })).toBe("admin_pause");
  });

  it("returns emergency_pause when pausedByEmergency is true", () => {
    expect(classifyEscrowLock({ pausedByEmergency: true })).toBe("emergency_pause");
  });

  it("returns cancel_locked when cancelLocked is true", () => {
    expect(classifyEscrowLock({ cancelLocked: true })).toBe("cancel_locked");
  });

  it("cancel_locked takes priority over admin_pause", () => {
    expect(classifyEscrowLock({ cancelLocked: true, pausedByAdmin: true })).toBe("cancel_locked");
  });

  it("cancel_locked takes priority over emergency_pause", () => {
    expect(classifyEscrowLock({ cancelLocked: true, pausedByEmergency: true })).toBe(
      "cancel_locked"
    );
  });

  it("admin_pause takes priority over emergency_pause", () => {
    expect(classifyEscrowLock({ pausedByAdmin: true, pausedByEmergency: true })).toBe(
      "admin_pause"
    );
  });
});

describe("getEscrowLockState", () => {
  it("returns actionsDisabled: false and empty strings when kind is none", () => {
    const state = getEscrowLockState({});
    expect(state.kind).toBe("none");
    expect(state.actionsDisabled).toBe(false);
    expect(state.message).toBe("");
    expect(state.tooltip).toBe("");
  });

  it("admin_pause: actionsDisabled true, message mentions admin", () => {
    const state = getEscrowLockState({ pausedByAdmin: true });
    expect(state.kind).toBe("admin_pause");
    expect(state.actionsDisabled).toBe(true);
    expect(state.message).toMatch(/admin/i);
    expect(state.tooltip).toBeTruthy();
  });

  it("emergency_pause: actionsDisabled true, message mentions emergency", () => {
    const state = getEscrowLockState({ pausedByEmergency: true });
    expect(state.kind).toBe("emergency_pause");
    expect(state.actionsDisabled).toBe(true);
    expect(state.message).toMatch(/emergency/i);
    expect(state.tooltip).toBeTruthy();
  });

  it("cancel_locked: actionsDisabled true, message mentions cancel", () => {
    const state = getEscrowLockState({ cancelLocked: true });
    expect(state.kind).toBe("cancel_locked");
    expect(state.actionsDisabled).toBe(true);
    expect(state.message).toMatch(/cancel/i);
    expect(state.tooltip).toBeTruthy();
  });

  it("all flags undefined is the same as all false", () => {
    const a = getEscrowLockState({});
    const b = getEscrowLockState({
      pausedByAdmin: undefined,
      pausedByEmergency: undefined,
      cancelLocked: undefined,
    } as EscrowLockFlags);
    expect(a).toEqual(b);
  });
});
