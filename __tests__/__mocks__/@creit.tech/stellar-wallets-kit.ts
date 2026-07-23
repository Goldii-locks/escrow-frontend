import { vi } from "vitest";

export const StellarWalletsKit = {
  init: vi.fn(),
  setWallet: vi.fn(),
  getAddress: vi.fn(),
  authModal: vi.fn(),
  disconnect: vi.fn().mockResolvedValue(undefined),
  signTransaction: vi.fn(),
  getNetwork: vi.fn(),
};

export const Networks = {
  TESTNET: "Testnet",
  PUBLIC: "Public",
};