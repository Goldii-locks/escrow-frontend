import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { WalletProvider, useWallet, SUPPORTED_WALLETS, STORAGE_KEY } from "@/app/context/WalletContext";
import { NETWORK_PASSPHRASE } from "@/app/lib/contract";
import { StellarWalletsKit } from "./__mocks__/@creit.tech/stellar-wallets-kit";

const mockShowToast = vi.fn();
vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

let localStorageStore: { [key: string]: string } = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    localStorageStore = {};
  }),
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

const ADDRESS = "GABCDEF";
const SIGNED_XDR = "SIGNED_XDR";
const UNSIGNED_XDR = "UNSIGNED_XDR";

describe("WalletContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    (StellarWalletsKit.getNetwork as ReturnType<typeof vi.fn>).mockResolvedValue({
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    (StellarWalletsKit.authModal as ReturnType<typeof vi.fn>).mockResolvedValue({ address: ADDRESS });
    (StellarWalletsKit.signTransaction as ReturnType<typeof vi.fn>).mockResolvedValue({ signedTxXdr: SIGNED_XDR });
  });

  it("initializes with no address and not connecting", () => {
    const { result } = renderHook(() => useWallet(), { wrapper: WalletProvider });

    expect(result.current.address).toBeNull();
    expect(result.current.isConnecting).toBe(false);
    expect(result.current.networkMismatch).toBe(false);
    expect(StellarWalletsKit.init).toHaveBeenCalledTimes(0);
  });

  it("connects wallet successfully", async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: WalletProvider });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.address).toBe(ADDRESS);
    expect(result.current.isConnecting).toBe(false);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(expect.any(String), "true");
    expect(StellarWalletsKit.init).toHaveBeenCalledOnce();
    expect(StellarWalletsKit.setWallet).toHaveBeenCalledWith(SUPPORTED_WALLETS[0].id);
    expect(StellarWalletsKit.authModal).toHaveBeenCalledOnce();
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it("disconnects wallet successfully", async () => {
    (StellarWalletsKit.getAddress as ReturnType<typeof vi.fn>).mockResolvedValue({ address: ADDRESS });
    localStorageMock.setItem(STORAGE_KEY, "true");

    const { result } = renderHook(() => useWallet(), { wrapper: WalletProvider });

    await act(async () => {
      await result.current.connect();
      await result.current.disconnect();
    });

    expect(result.current.address).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(expect.any(String));
    expect(StellarWalletsKit.disconnect).toHaveBeenCalledOnce();
  });

  it("handles network mismatch", async () => {
    (StellarWalletsKit.getNetwork as ReturnType<typeof vi.fn>).mockResolvedValue({
      networkPassphrase: "OTHER_NETWORK_PASSPHRASE",
    });

    const { result } = renderHook(() => useWallet(), { wrapper: WalletProvider });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.networkMismatch).toBe(true);
  });

  it("signs transaction successfully", async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: WalletProvider });

    await act(async () => {
      await result.current.connect();
    });

    await waitFor(() => expect(result.current.address).toBe(ADDRESS), { timeout: 5000 });

    await act(async () => {
      const signedXdr = await result.current.signTransaction(UNSIGNED_XDR);
      expect(signedXdr).toBe(SIGNED_XDR);
    });

    expect(StellarWalletsKit.signTransaction).toHaveBeenCalledWith(UNSIGNED_XDR, {
      address: ADDRESS,
      networkPassphrase: NETWORK_PASSPHRASE,
    });
  });

  it("logs error when checkNetwork fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (StellarWalletsKit.getNetwork as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useWallet(), { wrapper: WalletProvider });

    await act(async () => {
      await result.current.connect();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[NETWORK_SYNC_CHECKER_ERROR]: Failed to check network",
      expect.any(Error)
    );
    expect(result.current.networkMismatch).toBe(false);

    consoleErrorSpy.mockRestore();
  });

  it("logs error when wallet connection fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (StellarWalletsKit.authModal as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Connection failed"));

    const { result } = renderHook(() => useWallet(), { wrapper: WalletProvider });

    await act(async () => {
      await result.current.connect();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[NETWORK_SYNC_CHECKER_ERROR]: Wallet connection failed",
      expect.any(Error)
    );
    expect(mockShowToast).toHaveBeenCalledWith("Failed to connect wallet.", "error");

    consoleErrorSpy.mockRestore();
  });

  it("logs error when wallet disconnection fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (StellarWalletsKit.disconnect as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Disconnect failed"));

    // First connect to set up the state
    const { result } = renderHook(() => useWallet(), { wrapper: WalletProvider });
    await act(async () => {
      await result.current.connect();
    });

    // Now try to disconnect and expect an error
    await act(async () => {
      await result.current.disconnect();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[NETWORK_SYNC_CHECKER_ERROR]: Wallet disconnect failed",
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it("logs error when transaction signing fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (StellarWalletsKit.signTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Signing failed"));

    const { result } = renderHook(() => useWallet(), { wrapper: WalletProvider });

    await act(async () => {
      await result.current.connect();
    });

    await expect(async () => {
      await result.current.signTransaction(UNSIGNED_XDR);
    }).rejects.toThrow("Signing failed");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[NETWORK_SYNC_CHECKER_ERROR]: Transaction signing failed",
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it("shows gas estimation error warning banner for budget exceeded", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (StellarWalletsKit.signTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Transaction failed: fee budget exceeded"));

    const { result } = renderHook(() => useWallet(), { wrapper: WalletProvider });

    await act(async () => {
      await result.current.connect();
    });

    await expect(async () => {
      await result.current.signTransaction(UNSIGNED_XDR);
    }).rejects.toThrow("Transaction failed: fee budget exceeded");

    expect(mockShowToast).toHaveBeenCalledWith(
      "Gas estimation error: This transaction exceeds the Soroban resource budget. Try a smaller batch or wait for network conditions to improve.",
      "error"
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[NETWORK_SYNC_CHECKER_ERROR]: Transaction signing failed",
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it("shows insufficient balance error when message includes insufficient balance", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (StellarWalletsKit.signTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("insufficient balance to cover fees"));

    const { result } = renderHook(() => useWallet(), { wrapper: WalletProvider });

    await act(async () => {
      await result.current.connect();
    });

    await expect(async () => {
      await result.current.signTransaction(UNSIGNED_XDR);
    }).rejects.toThrow("insufficient balance to cover fees");

    expect(mockShowToast).toHaveBeenCalledWith(
      "Insufficient account balance. Your wallet may not have enough XLM to cover the transaction fees.",
      "error"
    );

    consoleErrorSpy.mockRestore();
  });

  it("shows generic gas warning for other fee-related errors", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (StellarWalletsKit.signTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("gas required exceeds allowance"));

    const { result } = renderHook(() => useWallet(), { wrapper: WalletProvider });

    await act(async () => {
      await result.current.connect();
    });

    await expect(async () => {
      await result.current.signTransaction(UNSIGNED_XDR);
    }).rejects.toThrow("gas required exceeds allowance");

    expect(mockShowToast).toHaveBeenCalledWith(
      "Gas estimation error: Your transaction might be too expensive. Review the operation and try again.",
      "error"
    );

    consoleErrorSpy.mockRestore();
  });

  it("does not initialize kit multiple times", async () => {
    const { result } = renderHook(() => useWallet(), { wrapper: WalletProvider });

    await act(async () => {
      await result.current.connect();
      await result.current.connect(); // Call connect again
    });

    expect(StellarWalletsKit.init).toHaveBeenCalledOnce();
  });

  it("reconnects previously connected wallet on mount", async () => {
    localStorageStore[STORAGE_KEY] = "true";
    (StellarWalletsKit.getAddress as ReturnType<typeof vi.fn>).mockResolvedValue({ address: ADDRESS });

    const { result } = renderHook(() => useWallet(), { wrapper: WalletProvider });

    await waitFor(() => expect(result.current.address).toBe(ADDRESS), { timeout: 10000, interval: 50 });
    expect(StellarWalletsKit.init).toHaveBeenCalledOnce();
    expect(StellarWalletsKit.getAddress).toHaveBeenCalledOnce();
    expect(result.current.networkMismatch).toBe(false);
  }, 15000);

  it("clears localStorage if previously connected wallet is no longer reachable", async () => {
    localStorageStore[STORAGE_KEY] = "true";
    (StellarWalletsKit.getAddress as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Wallet not found"));

    const { result } = renderHook(() => useWallet(), { wrapper: WalletProvider });

    await waitFor(() => expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY), { timeout: 10000, interval: 50 });
    expect(result.current.address).toBeNull();
    expect(StellarWalletsKit.init).toHaveBeenCalledOnce();
  }, 15000);
});