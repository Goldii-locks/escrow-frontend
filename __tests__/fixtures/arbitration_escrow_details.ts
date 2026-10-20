import type { ArbitrationEscrowDetailsRecord } from "@/app/lib/arbitration_escrow_details";

export const MOCK_ARBITRATION_ESCROW_DETAILS: ArbitrationEscrowDetailsRecord = {
  escrowId: "ESC-000000000000000000000000000000000000000000000042",
  disputeId: "DIS-000000000000000000000000000000000000000000000117",
  status: "under_review",
  lockedAt: "2026-09-23T09:12:00Z",
  lockedAmount: "500.00 USDC",
  token: "USDC",
  clientAddress: "GCLIENT7HQ2WKM4XPL6TFV3ZB9DCNR8YASEK5",
  freelancerAddress: "GFREELANCER3NZ8WQ6LK2VH5CJB0DTXR4MASEK9",
  arbiterAddress: "GARBITER5PD3XCW8QL0NR6ZTKM2VBHJF4SASEK2",
  reason: "Freelancer marked the milestone delivered; client disputes acceptance.",
};
