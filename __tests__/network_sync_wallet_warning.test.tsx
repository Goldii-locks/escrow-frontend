import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import NetworkSyncWalletWarningBanner from "@/app/components/NetworkSyncWalletWarningBanner";
import {
  WALLET_INSTALL_URL,
  WALLET_SETUP_INSTRUCTION,
  type WalletAvailabilityState,
} from "@/app/lib/network_sync_checker";

describe("NetworkSyncWalletWarningBanner (#153)", () => {
  it("renders fallback setup instructions when wallet is missing", () => {
    render(<NetworkSyncWalletWarningBanner detector={() => false} />);

    const banner = screen.getByTestId("network-sync-wallet-warning-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("role", "alert");
    expect(
      screen.getByTestId("network-sync-wallet-setup-instruction")
    ).toHaveTextContent(WALLET_SETUP_INSTRUCTION);
    expect(
      screen.getByTestId("network-sync-wallet-install-link")
    ).toHaveAttribute("href", WALLET_INSTALL_URL);
  });

  it("does not render when wallet is available", () => {
    const { container } = render(
      <NetworkSyncWalletWarningBanner detector={() => true} />
    );

    expect(
      screen.queryByTestId("network-sync-wallet-warning-banner")
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("uses a precomputed unavailable availability state", () => {
    const availability: WalletAvailabilityState = {
      available: false,
      status: "unavailable",
      setupInstruction: WALLET_SETUP_INSTRUCTION,
      warningMessage: WALLET_SETUP_INSTRUCTION,
    };

    render(<NetworkSyncWalletWarningBanner availability={availability} />);

    expect(
      screen.getByTestId("network-sync-wallet-setup-instruction")
    ).toHaveTextContent(/No wallet extension detected/i);
  });

  it("renders error-state instructions when availability check failed", () => {
    const availability: WalletAvailabilityState = {
      available: false,
      status: "error",
      setupInstruction: WALLET_SETUP_INSTRUCTION,
      warningMessage: `Unable to verify wallet availability. ${WALLET_SETUP_INSTRUCTION}`,
    };

    render(<NetworkSyncWalletWarningBanner availability={availability} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByTestId("network-sync-wallet-setup-instruction")
    ).toHaveTextContent(/Install a supported Stellar wallet/i);
  });

  it("does not render when availability reports available", () => {
    const availability: WalletAvailabilityState = {
      available: true,
      status: "available",
      setupInstruction: null,
      warningMessage: null,
    };

    const { container } = render(
      <NetworkSyncWalletWarningBanner availability={availability} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
