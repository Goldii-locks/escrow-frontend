import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { WalletProvider, useWallet } from "@/app/context/WalletContext";
import { FREIGHTER_STORAGE_KEY, FREIGHTER_STORAGE_VERSION } from "@/app/lib/walletPersistence";
import type { ReactNode } from "react";

const TEST_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const TEST_ADDRESS_2 = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

interface FreighterMock {
  requestAccess: ReturnType<typeof vi.fn>;
  getPublicKey: ReturnType<typeof vi.fn>;
  signTransaction: ReturnType<typeof vi.fn>;
}

function mockFreighter(): FreighterMock {
  const freighter = {
    requestAccess: vi.fn().mockResolvedValue(undefined),
    getPublicKey: vi.fn().mockResolvedValue(TEST_ADDRESS),
    signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: "signed-xdr-mock" }),
  };
  (window as unknown as { freighter: typeof freighter }).freighter = freighter;
  return freighter;
}

function clearFreighterMock() {
  delete (window as unknown as { freighter?: unknown }).freighter;
}

function wrapper({ children }: { children: ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}

describe("WalletProvider persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearFreighterMock();
    vi.clearAllMocks();
  });

  afterEach(() => {
    window.localStorage.clear();
    clearFreighterMock();
  });

  it("starts disconnected when no persisted state exists", async () => {
    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => {
      expect(result.current.address).toBeNull();
    });
  });

  it("restores address and network from valid persisted state on mount", async () => {
    window.localStorage.setItem(
      FREIGHTER_STORAGE_KEY,
      JSON.stringify({
        version: FREIGHTER_STORAGE_VERSION,
        address: TEST_ADDRESS_2,
        network: "testnet",
        connectedAt: Date.now(),
      }),
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => {
      expect(result.current.address).toBe(TEST_ADDRESS_2);
      expect(result.current.network).toBe("testnet");
    });
  });

  it("restores mainnet network from persisted state on mount", async () => {
    window.localStorage.setItem(
      FREIGHTER_STORAGE_KEY,
      JSON.stringify({
        version: FREIGHTER_STORAGE_VERSION,
        address: TEST_ADDRESS,
        network: "mainnet",
        connectedAt: Date.now(),
      }),
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => {
      expect(result.current.address).toBe(TEST_ADDRESS);
      expect(result.current.network).toBe("mainnet");
    });
  });

  it("starts disconnected safely when persisted state is corrupted JSON", async () => {
    window.localStorage.setItem(FREIGHTER_STORAGE_KEY, "this is not json");

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => {
      expect(result.current.address).toBeNull();
    });
    expect(window.localStorage.getItem(FREIGHTER_STORAGE_KEY)).toBeNull();
  });

  it("starts disconnected safely when persisted schema is invalid", async () => {
    window.localStorage.setItem(
      FREIGHTER_STORAGE_KEY,
      JSON.stringify({
        version: FREIGHTER_STORAGE_VERSION,
        address: "",
        network: "not-a-network",
      }),
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => {
      expect(result.current.address).toBeNull();
    });
    expect(window.localStorage.getItem(FREIGHTER_STORAGE_KEY)).toBeNull();
  });

  it("persists address on successful connect", async () => {
    mockFreighter();
    const { result } = renderHook(() => useWallet(), { wrapper });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.address).toBe(TEST_ADDRESS);

    const raw = window.localStorage.getItem(FREIGHTER_STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.address).toBe(TEST_ADDRESS);
    expect(parsed.network).toBe("testnet");
    expect(parsed.version).toBe(FREIGHTER_STORAGE_VERSION);
    expect(typeof parsed.connectedAt).toBe("number");
  });

  it("clears persisted state on disconnect", async () => {
    window.localStorage.setItem(
      FREIGHTER_STORAGE_KEY,
      JSON.stringify({
        version: FREIGHTER_STORAGE_VERSION,
        address: TEST_ADDRESS,
        network: "testnet",
        connectedAt: Date.now(),
      }),
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => {
      expect(result.current.address).toBe(TEST_ADDRESS);
    });

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.address).toBeNull();
    expect(window.localStorage.getItem(FREIGHTER_STORAGE_KEY)).toBeNull();
  });

  it("clears storage on disconnect even when restored from storage", async () => {
    window.localStorage.setItem(
      FREIGHTER_STORAGE_KEY,
      JSON.stringify({
        version: FREIGHTER_STORAGE_VERSION,
        address: TEST_ADDRESS_2,
        network: "testnet",
        connectedAt: Date.now(),
      }),
    );

    const { result } = renderHook(() => useWallet(), { wrapper });

    await waitFor(() => {
      expect(result.current.address).toBe(TEST_ADDRESS_2);
    });

    act(() => {
      result.current.disconnect();
    });

    expect(window.localStorage.getItem(FREIGHTER_STORAGE_KEY)).toBeNull();
  });
});

describe("WalletProvider with Navbar-ish consumer", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearFreighterMock();
  });

  afterEach(() => {
    window.localStorage.clear();
    clearFreighterMock();
  });

  it("renders a simple consumer with restored address", async () => {
    window.localStorage.setItem(
      FREIGHTER_STORAGE_KEY,
      JSON.stringify({
        version: FREIGHTER_STORAGE_VERSION,
        address: TEST_ADDRESS,
        network: "testnet",
        connectedAt: Date.now(),
      }),
    );

    function Consumer() {
      const { address } = useWallet();
      return <div data-testid="addr">{address ?? "none"}</div>;
    }

    render(
      <WalletProvider>
        <Consumer />
      </WalletProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("addr")).toHaveTextContent(TEST_ADDRESS);
    });
  });
});
