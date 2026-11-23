import type { ContractPauseState, ContractPauseTransition } from "@/app/lib/contract_pause_switch";

export const MOCK_CONTRACT_PAUSE_STATE: ContractPauseState = {
  contractId: "CDD5WKK3WT3QVKXMXTJNDIXE4T73FK6GGXDSD6UTJAH6YYZU52SQ4MUH",
  paused: true,
  updatedAt: "2026-09-24T18:42:00Z",
  updatedBy: "GADMIN3XQ7LKZP4V2M6YB9WDHRTC5FJN8AUE2HSVG6KCDY",
  reason: "Payout indexer reports duplicate release events for milestone 3.",
};

export const MOCK_CONTRACT_PAUSE_TRANSITIONS: ContractPauseTransition[] = [
  {
    id: "pause-002",
    at: "2026-09-24T18:42:00Z",
    by: "GADMIN3XQ7LKZP4V2M6YB9WDHRTC5FJN8AUE2HSVG6KCDY",
    to: "frozen",
    reason: "Payout indexer reports duplicate release events for milestone 3.",
  },
  {
    id: "pause-001",
    at: "2026-09-21T07:15:00Z",
    by: "GADMIN3XQ7LKZP4V2M6YB9WDHRTC5FJN8AUE2HSVG6KCDY",
    to: "frozen",
    reason: "Scheduled upgrade of the dispute escrow entrypoint.",
  },
  {
    id: "pause-000",
    at: "2026-09-18T11:03:00Z",
    by: "GADMIN3XQ7LKZP4V2M6YB9WDHRTC5FJN8AUE2HSVG6KCDY",
    to: "active",
    reason: "Freeze lifted after the entrypoint upgrade completed.",
  },
];
