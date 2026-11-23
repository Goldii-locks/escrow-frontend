/** Shared identities and job fixtures for the mocked-wallet specs. */
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

export const ADDRESSES = {
  client: `G${"C".repeat(55)}`,
  freelancer: `G${"F".repeat(55)}`,
  arbiter: `G${"B".repeat(55)}`,
} as const;

export const TOKEN_ADDRESS = `C${"T".repeat(55)}`;
export const CONTRACT_ID = `C${"D".repeat(55)}`;
export const JOB_ID = "job-e2e-000000000001";
export const TX_HASH = "e2e-transaction-hash";
export const UNSIGNED_XDR = "e2e-unsigned-transaction-xdr";

export type MilestoneStatus =
  | "Pending"
  | "Delivered"
  | "Released"
  | "PartiallyReleased"
  | "Disputed";

export interface E2EMilestone {
  index: number;
  amount: string;
  status: MilestoneStatus;
  releasedAmount?: string;
}

export interface E2EJob {
  id: string;
  client: string;
  freelancer: string;
  arbiter: string;
  funded: boolean;
  tokenSymbol: string;
  tokenDecimals: number;
  milestones: E2EMilestone[];
}

export function makeJob(overrides: Partial<E2EJob> = {}): E2EJob {
  return {
    id: JOB_ID,
    client: ADDRESSES.client,
    freelancer: ADDRESSES.freelancer,
    arbiter: ADDRESSES.arbiter,
    funded: true,
    tokenSymbol: "USDC",
    tokenDecimals: 7,
    milestones: [{ index: 0, amount: "100000000", status: "Pending" }],
    ...overrides,
  };
}
