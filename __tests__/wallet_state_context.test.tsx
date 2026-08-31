import { useState } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WalletProvider, useWallet } from "@/app/context/WalletContext";
import { ToastProvider } from "@/app/context/ToastContext";
import { isWalletLoading } from "@/app/lib/wallet_state_context";

const kitState = {
  getAddress: vi.fn(),
  authModal: vi.fn(),
  getNetwork: vi.fn(),
  signTransaction: vi.fn(),
  disconnect: vi.fn(),
  init: vi.fn(),
  setWallet: vi.fn(),
};

vi.mock("@creit.tech/stellar-wallets-kit", () => ({
  Networks: { TESTNET: "Test SDF Network ; September 2015" },
  StellarWalletsKit: {
    init: (...args: unknown[]) => kitState.init(...args),
    getAddress: (...args: unknown[]) => kitState.getAddress(...args),
    authModal: (...args: unknown[]) => kitState.authModal(...args),
    getNetwork: (...args: unknown[]) => kitState.getNetwork(...args),
    signTransaction: (...args: unknown[]) => kitState.signTransaction(...args),
    disconnect: (...args: unknown[]) => kitState.disconnect(...args),
    setWallet: (...args: unknown[]) => kitState.setWallet(...args),
  },
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/utils", () => ({
  defaultModules: vi.fn(() => []),
}));

vi.mock("@/app/lib/freighter_connector", () => ({
  freighterActiveAddress: {
    setActiveAddress: vi.fn(),
    clear: vi.fn(),
  },
  verifyAndRehydrateFreighterAddress: vi.fn(async () => null),
}));

vi.mock("@/app/lib/ledger_usb_bridge", () => ({
  ledgerActiveAddresses: {
    clear: vi.fn(),
  },
}));

function toBase64(text: string): string {
  return Buffer.from(text, "utf-8").toString("base64");
}

function WalletHarness() {
  const wallet = useWallet();
  const [multiSigResult, setMultiSigResult] = useState("idle");
  return (
    <div>
      <div data-testid="address">{wallet.address ?? "none"}</div>
      <div data-testid="is-connecting">{String(wallet.isConnecting)}</div>
      <div data-testid="multisig-result">{multiSigResult}</div>
      <button onClick={() => void wallet.connect()}>connect</button>
      <button onClick={() => wallet.disconnect()}>disconnect</button>
      <button
        onClick={() => {
          void wallet.signTransaction("some-xdr").catch(() => {});
        }}
      >
        sign
      </button>
      <button
        onClick={() => {
          const xdr = toBase64("x".repeat(200));
          wallet
            .assembleMultiSigTransaction([
              { baseXdr: xdr, signer: { publicKey: "GA", hint: "aaaa" }, signedXdr: xdr },
              { baseXdr: xdr, signer: { publicKey: "GB", hint: "bbbb" }, signedXdr: xdr },
            ])
            .then((result) =>
              setMultiSigResult(`ok:${result.uniqueSigners}:${result.splitsValidated}`)
            )
            .catch((err: Error) => setMultiSigResult(`error:${err.message}`));
        }}
      >
        assemble-multisig-ok
      </button>
      <button
        onClick={() => {
          const xdr = toBase64("x".repeat(200));
          wallet
            .assembleMultiSigTransaction([
              { baseXdr: xdr, signer: { publicKey: "GA", hint: "aaaa" }, signedXdr: xdr },
            ])
            .then((result) =>
              setMultiSigResult(`ok:${result.uniqueSigners}:${result.splitsValidated}`)
            )
            .catch((err: Error) => setMultiSigResult(`error:${err.message}`));
        }}
      >
        assemble-multisig-fail
      </button>
    </div>
  );
}

function renderWallet() {
  return render(
    <ToastProvider>
      <WalletProvider>
        <WalletHarness />
      </WalletProvider>
    </ToastProvider>
  );
}

describe("wallet_state_context / WalletContext (#122)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    kitState.getNetwork.mockResolvedValue({
      networkPassphrase: "Test SDF Network ; September 2015",
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("connect() sets the address on success", async () => {
    kitState.authModal.mockResolvedValue({ address: "GCONNECTED" });
    renderWallet();

    screen.getByText("connect").click();

    await waitFor(() => {
      expect(screen.getByTestId("address")).toHaveTextContent("GCONNECTED");
    });
  });

  it("connect() leaves the address unset and logs a warning block on failure", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = new Error("user rejected");
    kitState.authModal.mockRejectedValue(error);
    renderWallet();

    screen.getByText("connect").click();

    await waitFor(() => {
      expect(screen.getByTestId("address")).toHaveTextContent("none");
    });
    expect(warnSpy).toHaveBeenCalled();
    const logged = warnSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain("[wallet_state_context]");
    expect(logged).toContain("TX ERROR");
    expect(logged).toContain("Wallet connection failed");
    expect(logged).toContain(error.stack);
    expect(logged).toContain("--- stack trace ---");
    expect(logged).toContain("--- end stack ---");
    warnSpy.mockRestore();
  });

  it("tracks the wallet selector lifecycle with formatted warning blocks", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    kitState.authModal.mockResolvedValue({ address: "GCONNECTED" });
    renderWallet();

    screen.getByText("connect").click();

    await waitFor(() => {
      expect(screen.getByTestId("address")).toHaveTextContent("GCONNECTED");
    });

    const logged = warnSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain("phase: connecting");
    expect(logged).toContain("Opening wallet selector");
    expect(logged).toContain("phase: success");
    expect(logged).toContain("Wallet connected");
    expect(logged.match(/--- stack trace ---/g)).toHaveLength(2);
    warnSpy.mockRestore();
  });

  it("disconnect() clears the address", async () => {
    kitState.authModal.mockResolvedValue({ address: "GCONNECTED" });
    kitState.disconnect.mockResolvedValue(undefined);
    renderWallet();

    screen.getByText("connect").click();
    await waitFor(() => {
      expect(screen.getByTestId("address")).toHaveTextContent("GCONNECTED");
    });

    screen.getByText("disconnect").click();

    await waitFor(() => {
      expect(screen.getByTestId("address")).toHaveTextContent("none");
    });
  });

  it("signTransaction() throws when no wallet is connected", async () => {
    renderWallet();

    await act(async () => {
      screen.getByText("sign").click();
    });

    expect(kitState.signTransaction).not.toHaveBeenCalled();
  });

  it("toggles the wallet loader around connect()", async () => {
    let resolveAuth: (value: { address: string }) => void = () => {};
    kitState.authModal.mockReturnValue(
      new Promise((resolve) => {
        resolveAuth = resolve;
      })
    );
    renderWallet();

    expect(isWalletLoading()).toBe(false);
    screen.getByText("connect").click();

    await waitFor(() => {
      expect(isWalletLoading()).toBe(true);
    });

    resolveAuth({ address: "GCONNECTED" });

    await waitFor(() => {
      expect(isWalletLoading()).toBe(false);
    });
  });

  it("sets isConnecting true during connect() and false once settled", async () => {
    let resolveAuth: (value: { address: string }) => void = () => {};
    kitState.authModal.mockReturnValue(
      new Promise((resolve) => {
        resolveAuth = resolve;
      })
    );
    renderWallet();

    screen.getByText("connect").click();
    await waitFor(() => {
      expect(screen.getByTestId("is-connecting")).toHaveTextContent("true");
    });

    resolveAuth({ address: "GCONNECTED" });

    await waitFor(() => {
      expect(screen.getByTestId("is-connecting")).toHaveTextContent("false");
    });
  });

  it("assembleMultiSigTransaction resolves with the assembly summary for a valid split set", async () => {
    renderWallet();

    screen.getByText("assemble-multisig-ok").click();

    await waitFor(() => {
      expect(screen.getByTestId("multisig-result")).toHaveTextContent("ok:2:2");
    });
  });

  it("assembleMultiSigTransaction rejects and logs a warning block below the signer threshold", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderWallet();

    screen.getByText("assemble-multisig-fail").click();

    await waitFor(() => {
      expect(screen.getByTestId("multisig-result")).toHaveTextContent(
        "error:Multi-sig assembly has 1 unique signature(s); minimum required is 2."
      );
    });
    const logged = warnSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain("[wallet_state_context]");
    expect(logged).toContain("--- stack trace ---");
    warnSpy.mockRestore();
  });
});
