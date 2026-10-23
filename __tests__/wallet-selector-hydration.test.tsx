import { act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WalletProvider, useWallet } from "@/app/context/WalletContext";
import { walletStateStore } from "@/app/lib/wallet_state_store";

vi.mock("@creit.tech/stellar-wallets-kit", () => ({
  Networks: { TESTNET: "TESTNET" },
  StellarWalletsKit: {
    init: vi.fn(),
    setWallet: vi.fn(),
    // Keep rehydration pending so only the selector restore is exercised.
    getAddress: vi.fn(() => new Promise(() => {})),
    getNetwork: vi.fn(() => new Promise(() => {})),
    disconnect: vi.fn(),
  },
}));

vi.mock("@creit.tech/stellar-wallets-kit/modules/utils", () => ({
  defaultModules: vi.fn(() => []),
}));

vi.mock("@/app/lib/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/lib/config")>()),
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
}));

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/app/lib/freighter_connector", () => ({
  freighterActiveAddress: { clear: vi.fn(), setActiveAddress: vi.fn() },
  verifyAndRehydrateFreighterAddress: vi.fn(() => new Promise(() => {})),
}));

vi.mock("@/app/lib/ledger_usb_bridge", () => ({
  ledgerActiveAddresses: { clear: vi.fn() },
}));

function WalletSelect() {
  const { selectedWalletId, setSelectedWalletId } = useWallet();
  return (
    <select
      aria-label="Wallet provider"
      value={selectedWalletId}
      onChange={(e) => setSelectedWalletId(e.target.value as typeof selectedWalletId)}
    >
      <option value="freighter">Freighter</option>
      <option value="albedo">Albedo</option>
    </select>
  );
}

const app = (
  <WalletProvider>
    <WalletSelect />
  </WalletProvider>
);

let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  walletStateStore.setActiveState(null);
  localStorage.clear();
  vi.restoreAllMocks();
});

async function hydrate() {
  // Prerender happens without any persisted wallet, as at build time.
  const html = renderToString(app);
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

describe("wallet selector hydration", () => {
  it("hydrates without a mismatch and restores a persisted albedo choice", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const container = await hydrate();

    walletStateStore.setActiveState({
      address: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW",
      selectedWalletId: "albedo",
      networkPassphrase: "Test SDF Network ; September 2015",
      connectedAt: Date.now(),
    });

    const recoverable = vi.fn();
    await act(async () => {
      root = hydrateRoot(container, app, { onRecoverableError: recoverable });
    });

    expect(recoverable).not.toHaveBeenCalled();
    expect(errorSpy.mock.calls.some((args) => /hydrat/i.test(String(args[0])))).toBe(false);
    expect(container.querySelector("select")!.value).toBe("albedo");
  });

  it("keeps the default wallet when nothing is persisted", async () => {
    const container = await hydrate();
    const recoverable = vi.fn();
    await act(async () => {
      root = hydrateRoot(container, app, { onRecoverableError: recoverable });
    });

    expect(recoverable).not.toHaveBeenCalled();
    expect(container.querySelector("select")!.value).toBe("freighter");
  });
});
