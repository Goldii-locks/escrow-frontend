import { renderHook, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WalletProvider, useWallet } from "@/app/context/WalletContext";
import type { ReactNode } from "react";

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/app/lib/contract", () => ({
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
}));

const mockInit = vi.fn();
const mockSetWallet = vi.fn();
const mockGetNetwork = vi.fn().mockResolvedValue({
  networkPassphrase: "Test SDF Network ; September 2015",
});
const mockSignTransaction = vi.fn();
const mockGetAddress = vi.fn();
const mockAuthModal = vi.fn();
const mockDisconnect = vi.fn();

vi.mock("@creit.tech/stellar-wallets-kit", () => ({
  Networks: { TESTNET: "Test SDF Network ; September 2015" },
  StellarWalletsKit: {
    init: (...args: unknown[]) => mockInit(...args),
    setWallet: (...args: unknown[]) => mockSetWallet(...args),
    getNetwork: (...args: unknown[]) => mockGetNetwork(...args),
    signTransaction: (...args: unknown[]) => mockSignTransaction(...args),
    getAddress: (...args: unknown[]) => mockGetAddress(...args),
    authModal: (...args: unknown[]) => mockAuthModal(...args),
    disconnect: (...args: unknown[]) => mockDisconnect(...args),
  },
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/utils", () => ({
  defaultModules: () => [],
}));

function wrapper({ children }: { children: ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}

async function setupConnectedWallet() {
  localStorage.setItem("milesto_wallet_connected", "true");
  mockGetAddress.mockResolvedValue({
    address: "GCONNECTEDADDRESS",
  });

  const { result } = renderHook(() => useWallet(), { wrapper });

  await waitFor(() => {
    expect(result.current.address).toBe("GCONNECTEDADDRESS");
  });

  return result;
}

describe("WalletContext loading states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetNetwork.mockResolvedValue({
      networkPassphrase: "Test SDF Network ; September 2015",
    });
    mockSignTransaction.mockResolvedValue({ signedTxXdr: "signed-tx" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults isSigning to false", () => {
    const { result } = renderHook(() => useWallet(), { wrapper });

    expect(result.current.isSigning).toBe(false);
  });

  it("sets isSigning to true during signTransaction execution", async () => {
    let resolveSign: (value: unknown) => void;
    mockSignTransaction.mockReturnValue(
      new Promise((resolve) => {
        resolveSign = resolve;
      })
    );

    const result = await setupConnectedWallet();

    let signPromise: Promise<string>;
    await act(async () => {
      signPromise = result.current.signTransaction("test-xdr");
    });

    await waitFor(() => {
      expect(result.current.isSigning).toBe(true);
    });

    await act(async () => {
      resolveSign!({ signedTxXdr: "signed-result" });
    });

    await act(async () => {
      await signPromise!;
    });

    expect(result.current.isSigning).toBe(false);
  });

  it("sets isSigning back to false when signTransaction throws", async () => {
    mockSignTransaction.mockRejectedValue(new Error("Signature rejected"));

    const result = await setupConnectedWallet();

    await act(async () => {
      await result.current.signTransaction("test-xdr").catch(() => {});
    });

    expect(result.current.isSigning).toBe(false);
  });

  it("sets isSigning to false when signTransaction succeeds", async () => {
    mockSignTransaction.mockResolvedValue({ signedTxXdr: "signed-tx" });

    const result = await setupConnectedWallet();

    await act(async () => {
      await result.current.signTransaction("test-xdr");
    });

    expect(result.current.isSigning).toBe(false);
  });
});
