import { describe, it, expect } from "vitest";
import {
  buildCancelEscrow,
  buildRevokeCancelApproval,
  buildExtendMilestoneDeadline,
  buildApplyDisputeArbitrationSplit,
  buildAdminOverrideRelease,
  buildAdminOverrideRefund,
  buildEmergencyUnpause,
  buildAdminPauseEscrow,
  buildAdminResumeEscrow,
  buildWithdraw,
  buildEscalateDispute,
  buildRequestRevision,
} from "@/app/lib/contract_actions";

const CALLER = "GABC...CALLER";

describe("contract_actions builders (#596, #817, #818, #819)", () => {
  it("buildCancelEscrow", () => {
    const { method, args } = buildCancelEscrow({ caller: CALLER });
    expect(method).toBe("cancel_escrow");
    expect(args).toEqual([{ type: "address", value: CALLER }]);
  });

  it("buildRevokeCancelApproval", () => {
    const { method, args } = buildRevokeCancelApproval({ caller: CALLER });
    expect(method).toBe("revoke_cancel_approval");
    expect(args).toEqual([{ type: "address", value: CALLER }]);
  });

  it("buildExtendMilestoneDeadline", () => {
    const { method, args } = buildExtendMilestoneDeadline({
      caller: CALLER,
      index: 2,
      extensionSeconds: 7 * 24 * 60 * 60,
    });
    expect(method).toBe("extend_milestone_deadline");
    expect(args).toEqual([
      { type: "address", value: CALLER },
      { type: "u32", value: "2" },
      { type: "i128", value: String(7 * 24 * 60 * 60) },
    ]);
  });

  it("buildApplyDisputeArbitrationSplit", () => {
    const { method, args } = buildApplyDisputeArbitrationSplit({
      caller: CALLER,
      index: 0,
      clientBps: 7000,
      freelancerBps: 3000,
    });
    expect(method).toBe("apply_dispute_arbitration_split");
    expect(args).toEqual([
      { type: "address", value: CALLER },
      { type: "u32", value: "0" },
      { type: "i128", value: "7000" },
      { type: "i128", value: "3000" },
    ]);
  });

  it("buildAdminOverrideRelease", () => {
    const { method, args } = buildAdminOverrideRelease({ caller: CALLER, index: 1 });
    expect(method).toBe("admin_override_release");
    expect(args).toEqual([
      { type: "address", value: CALLER },
      { type: "u32", value: "1" },
    ]);
  });

  it("buildAdminOverrideRefund", () => {
    const { method, args } = buildAdminOverrideRefund({ caller: CALLER, index: 1 });
    expect(method).toBe("admin_override_refund");
    expect(args).toEqual([
      { type: "address", value: CALLER },
      { type: "u32", value: "1" },
    ]);
  });

  it("buildEmergencyUnpause", () => {
    const { method, args } = buildEmergencyUnpause({ caller: CALLER });
    expect(method).toBe("emergency_unpause");
    expect(args).toEqual([{ type: "address", value: CALLER }]);
  });

  it("buildAdminPauseEscrow", () => {
    const { method } = buildAdminPauseEscrow({ caller: CALLER });
    expect(method).toBe("admin_pause_escrow");
  });

  it("buildAdminResumeEscrow", () => {
    const { method } = buildAdminResumeEscrow({ caller: CALLER });
    expect(method).toBe("admin_resume_escrow");
  });

  it("buildWithdraw (#817)", () => {
    const { method, args } = buildWithdraw({ caller: CALLER });
    expect(method).toBe("withdraw");
    expect(args).toEqual([{ type: "address", value: CALLER }]);
  });

  it("buildEscalateDispute (#818)", () => {
    const { method, args } = buildEscalateDispute({ caller: CALLER, index: 3 });
    expect(method).toBe("escalate_dispute");
    expect(args).toEqual([
      { type: "address", value: CALLER },
      { type: "u32", value: "3" },
    ]);
  });

  it("buildRequestRevision (#819)", () => {
    const { method, args } = buildRequestRevision({
      caller: CALLER,
      index: 0,
      noteHash: "deadbeef",
    });
    expect(method).toBe("request_revision");
    expect(args).toEqual([
      { type: "address", value: CALLER },
      { type: "u32", value: "0" },
      { type: "bytes", value: "deadbeef" },
    ]);
  });
});
