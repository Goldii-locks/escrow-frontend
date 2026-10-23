// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import FreighterWalletWarningBanner from "@/app/components/FreighterWalletWarningBanner";
import {
  FREIGHTER_INSTALL_URL,
  FREIGHTER_SETUP_INSTRUCTION,
  type FreighterAvailabilityState,
} from "@/app/lib/freighter_connector";

describe("FreighterWalletWarningBanner (#103)", () => {
  it("renders fallback setup instructions when wallet is missing", () => {
    render(<FreighterWalletWarningBanner detector={() => false} />);

    const banner = screen.getByTestId("freighter-wallet-warning-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("role", "alert");
    expect(
      screen.getByTestId("freighter-wallet-setup-instruction")
    ).toHaveTextContent(FREIGHTER_SETUP_INSTRUCTION);
    expect(screen.getByTestId("freighter-wallet-install-link")).toHaveAttribute(
      "href",
      FREIGHTER_INSTALL_URL
    );
  });

  it("does not render when wallet is available", () => {
    const { container } = render(
      <FreighterWalletWarningBanner detector={() => true} />
    );

    expect(
      screen.queryByTestId("freighter-wallet-warning-banner")
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("uses a precomputed unavailable availability state", () => {
    const availability: FreighterAvailabilityState = {
      available: false,
      status: "unavailable",
      setupInstruction: FREIGHTER_SETUP_INSTRUCTION,
      warningMessage: FREIGHTER_SETUP_INSTRUCTION,
    };

    render(<FreighterWalletWarningBanner availability={availability} />);

    expect(
      screen.getByTestId("freighter-wallet-setup-instruction")
    ).toHaveTextContent(/Freighter wallet extension not detected/i);
  });

  it("does not render when availability reports available", () => {
    const availability: FreighterAvailabilityState = {
      available: true,
      status: "available",
      setupInstruction: null,
      warningMessage: null,
    };

    const { container } = render(
      <FreighterWalletWarningBanner availability={availability} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
