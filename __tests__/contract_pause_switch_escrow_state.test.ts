import { describe, it, expect } from "vitest";
import { mapEscrowStateToPauseState } from "@/app/lib/contract_pause_switch";

const env = (paused: unknown) => ({ success: true, data: { result: { paused } } });

describe("mapEscrowStateToPauseState (#874)", () => {
  it("maps both flags from get_escrow_state", () => {
    const s = mapEscrowStateToPauseState(env({ admin: true, emergency: false }), "C1");
    expect(s).toMatchObject({ paused: true, adminPaused: true, emergencyPaused: false });
  });
  it("is paused when only emergency is set", () => {
    expect(mapEscrowStateToPauseState(env({ admin: false, emergency: true }), "C1")?.paused).toBe(true);
  });
  it("is active when neither flag is set", () => {
    expect(mapEscrowStateToPauseState(env({ admin: false, emergency: false }), "C1")?.paused).toBe(false);
  });
  it("returns null for missing or malformed flags", () => {
    expect(mapEscrowStateToPauseState(env({ admin: true }), "C1")).toBeNull();
    expect(mapEscrowStateToPauseState({ paused: false }, "C1")).toBeNull();
  });
});
