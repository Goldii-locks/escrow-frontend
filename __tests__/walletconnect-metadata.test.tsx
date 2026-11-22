// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  APP_DESCRIPTION,
  APP_ICON_URL,
  APP_NAME,
  APP_URL,
  WALLETCONNECT_METADATA,
} from "@/app/lib/app_metadata";
import { WalletProvider, useWallet } from "@/app/context/WalletContext";
import { ToastProvider } from "@/app/context/ToastContext";

const kitState = {
  init: vi.fn(),
  getAddress: vi.fn(),
  authModal: vi.fn(),
  getNetwork: vi.fn(),
  setWallet: vi.fn(),
  signTransaction: vi.fn(),
  disconnect: vi.fn(),
};

const walletConnectConstructor = vi.fn();

vi.mock("@creit.tech/stellar-wallets-kit", () => ({
  Networks: { TESTNET: "Testnet", PUBLIC: "Pubnet" },
  StellarWalletsKit: {
    init: (...args: unknown[]) => kitState.init(...args),
    getAddress: (...args: unknown[]) => kitState.getAddress(...args),
    authModal: (...args: unknown[]) => kitState.authModal(...args),
    getNetwork: (...args: unknown[]) => kitState.getNetwork(...args),
    setWallet: (...args: unknown[]) => kitState.setWallet(...args),
    signTransaction: (...args: unknown[]) => kitState.signTransaction(...args),
    disconnect: (...args: unknown[]) => kitState.disconnect(...args),
  },
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/utils", () => ({
  defaultModules: vi.fn(() => []),
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/wallet-connect", () => ({
  WalletConnectTargetChain: { PUBLIC: "stellar:pubnet", TESTNET: "stellar:testnet" },
  WalletConnectModule: class {
    constructor(params: unknown) {
      walletConnectConstructor(params);
    }
  },
}));

vi.mock("@/app/lib/wallet_session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/wallet_session")>()),
  freighterActiveAddress: {
    getActiveAddress: vi.fn(() => null),
    setActiveAddress: vi.fn(),
    clear: vi.fn(),
  },
  verifyAndRehydrateFreighterAddress: vi.fn(async () => null),
}));

function ConnectHarness() {
  const { connect } = useWallet();
  return <button onClick={() => void connect()}>connect</button>;
}

function renderProvider() {
  return render(
    <ToastProvider>
      <WalletProvider>
        <ConnectHarness />
      </WalletProvider>
    </ToastProvider>
  );
}

describe("WalletConnect metadata branding (issue #842)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "test-project-id");
    kitState.getNetwork.mockResolvedValue({ networkPassphrase: "Testnet" });
    kitState.authModal.mockResolvedValue({ address: "GTEST" });
    kitState.getAddress.mockResolvedValue({ address: undefined });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it("uses the shared app constants for name, description, URL and icon", () => {
    expect(WALLETCONNECT_METADATA).toEqual({
      name: APP_NAME,
      description: APP_DESCRIPTION,
      url: APP_URL,
      icons: [APP_ICON_URL],
    });
    expect(WALLETCONNECT_METADATA.name).toBe("Milestone");
    expect(WALLETCONNECT_METADATA.url).toBe("https://milestonepay.app");
    expect(WALLETCONNECT_METADATA.icons[0]).not.toContain("favicon.ico");
    expect(existsSync(resolve(__dirname, "../public/app-icon.svg"))).toBe(true);
  });

  it("passes the shared constant to the WalletConnect module", async () => {
    renderProvider();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "connect" }));
    });

    await waitFor(() => expect(walletConnectConstructor).toHaveBeenCalledTimes(1));
    expect(walletConnectConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: WALLETCONNECT_METADATA })
    );
  });
});
