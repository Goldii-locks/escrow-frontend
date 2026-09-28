import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import WalletSelectorModal from "@/app/components/WalletSelectorModal";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock("@/app/lib/freighter_connector", () => ({
  checkFreighterAvailability: vi.fn(() => ({
    available: true,
    setupInstruction: "",
  })),
  FREIGHTER_INSTALL_URL: "https://freighter.app",
  FREIGHTER_SETUP_INSTRUCTION: "Install Freighter",
  isFreighterUserRejected: vi.fn(() => false),
}));

vi.mock("@/app/context/WalletContext", () => ({
  SUPPORTED_WALLETS: [
    { id: "freighter", label: "Freighter" },
    { id: "albedo", label: "Albedo" },
    { id: "xbull", label: "xBull" },
    { id: "hana", label: "Hana" },
  ],
}));

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

// ---------------------------------------------------------------------------
// Network mismatch warning bar — pure helper unit tests
// ---------------------------------------------------------------------------

import {
  checkNetworkMismatch,
  buildWalletSelectorMismatchMessage,
} from "@/app/lib/wallet_selector_modal";

describe("wallet_selector_modal network mismatch detection (#task-1)", () => {
  it("checkNetworkMismatch returns mismatched=false when networks match", () => {
    const result = checkNetworkMismatch(TESTNET_PASSPHRASE, TESTNET_PASSPHRASE);
    expect(result.mismatched).toBe(false);
    expect(result.warningMessage).toBeNull();
  });

  it("checkNetworkMismatch returns mismatched=true when networks differ", () => {
    const result = checkNetworkMismatch(MAINNET_PASSPHRASE, TESTNET_PASSPHRASE);
    expect(result.mismatched).toBe(true);
    expect(result.warningMessage).not.toBeNull();
    expect(result.warningMessage).toContain("Network mismatch detected");
    expect(result.warningMessage).toContain("switch");
  });

  it("checkNetworkMismatch returns mismatched=false when walletNetwork is empty", () => {
    const result = checkNetworkMismatch("", TESTNET_PASSPHRASE);
    expect(result.mismatched).toBe(false);
    expect(result.warningMessage).toBeNull();
  });

  it("checkNetworkMismatch returns mismatched=false when expectedNetwork is empty", () => {
    const result = checkNetworkMismatch(TESTNET_PASSPHRASE, "");
    expect(result.mismatched).toBe(false);
    expect(result.warningMessage).toBeNull();
  });

  it("checkNetworkMismatch returns mismatched=false when both are empty", () => {
    const result = checkNetworkMismatch("", "");
    expect(result.mismatched).toBe(false);
    expect(result.warningMessage).toBeNull();
  });

  it("checkNetworkMismatch truncates long network names in the warning", () => {
    const longNetwork = "A".repeat(60);
    const result = checkNetworkMismatch(longNetwork, TESTNET_PASSPHRASE);
    expect(result.mismatched).toBe(true);
    // The warning message should exist and contain a truncated form
    expect(result.warningMessage).not.toContain(longNetwork);
  });

  it("buildWalletSelectorMismatchMessage returns null when networks match", () => {
    const msg = buildWalletSelectorMismatchMessage(
      "freighter",
      TESTNET_PASSPHRASE,
      TESTNET_PASSPHRASE,
    );
    expect(msg).toBeNull();
  });

  it("buildWalletSelectorMismatchMessage returns a friendly message on mismatch", () => {
    const msg = buildWalletSelectorMismatchMessage(
      "freighter",
      MAINNET_PASSPHRASE,
      TESTNET_PASSPHRASE,
    );
    expect(msg).not.toBeNull();
    expect(msg).toContain("Freighter");
    expect(msg).toContain("mismatch");
    expect(msg).toContain("⚠️");
  });

  it("buildWalletSelectorMismatchMessage capitalizes the wallet name", () => {
    const msg = buildWalletSelectorMismatchMessage(
      "albedo",
      MAINNET_PASSPHRASE,
      TESTNET_PASSPHRASE,
    );
    expect(msg).toContain("Albedo");
  });

  it("APP_NETWORK_PASSPHRASES has known testnet and mainnet entries", async () => {
    const { APP_NETWORK_PASSPHRASES } = await import("@/app/lib/wallet_selector_modal");
    expect(APP_NETWORK_PASSPHRASES.testnet).toBe(TESTNET_PASSPHRASE);
    expect(APP_NETWORK_PASSPHRASES.mainnet).toBe(MAINNET_PASSPHRASE);
  });
});

// ---------------------------------------------------------------------------
// WalletSelectorModal component — renders network mismatch warning bar
// ---------------------------------------------------------------------------

describe("WalletSelectorModal network mismatch warning bar (#task-1)", () => {
  it("does not render the warning bar when networks match", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
        walletNetwork={TESTNET_PASSPHRASE}
        appNetwork={TESTNET_PASSPHRASE}
      />,
    );
    expect(
      screen.queryByTestId("wallet-selector-network-warning"),
    ).not.toBeInTheDocument();
  });

  it("renders the warning bar when wallet network differs from app network", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
        walletNetwork={MAINNET_PASSPHRASE}
        appNetwork={TESTNET_PASSPHRASE}
      />,
    );
    const warning = screen.getByTestId("wallet-selector-network-warning");
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveAttribute("role", "alert");
    expect(warning).toHaveTextContent(/mismatch/i);
    expect(warning).toHaveTextContent(/switch/i);
  });

  it("renders the warning bar with the correct wallet name", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
        walletNetwork={MAINNET_PASSPHRASE}
        appNetwork={TESTNET_PASSPHRASE}
        selectedWalletId="albedo"
      />,
    );
    expect(screen.getByTestId("wallet-selector-network-warning")).toHaveTextContent(
      /Albedo/,
    );
  });

  it("does not render the warning bar when walletNetwork is null", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
        walletNetwork={null}
        appNetwork={TESTNET_PASSPHRASE}
      />,
    );
    expect(
      screen.queryByTestId("wallet-selector-network-warning"),
    ).not.toBeInTheDocument();
  });

  it("does not render the modal at all when isOpen is false", () => {
    const { container } = render(
      <WalletSelectorModal
        isOpen={false}
        onClose={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
        walletNetwork={MAINNET_PASSPHRASE}
        appNetwork={TESTNET_PASSPHRASE}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the modal with all wallet options", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />,
    );
    expect(screen.getByTestId("wallet-selector-option-freighter")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-selector-option-albedo")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-selector-option-xbull")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-selector-option-hana")).toBeInTheDocument();
  });

  it("renders the modal with aria attributes", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Select Wallet");
  });
});
