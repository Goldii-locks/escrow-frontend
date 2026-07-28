import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import LedgerWalletWarningBanner from "@/app/components/LedgerWalletWarningBanner";
import {
  LEDGER_SETUP_INSTRUCTION,
  LEDGER_SETUP_URL,
  type LedgerAvailabilityState,
} from "@/app/lib/ledger_usb_bridge";

describe("LedgerWalletWarningBanner", () => {
  it("renders fallback setup instructions when transport is unavailable", () => {
    render(
      <LedgerWalletWarningBanner
        detector={() => ({ hasWebUsb: false, hasWebHid: false })}
      />
    );

    const banner = screen.getByTestId("ledger-wallet-warning-banner");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("role", "alert");
    expect(
      screen.getByTestId("ledger-wallet-setup-instruction")
    ).toHaveTextContent(LEDGER_SETUP_INSTRUCTION);
    expect(screen.getByTestId("ledger-wallet-setup-link")).toHaveAttribute(
      "href",
      LEDGER_SETUP_URL
    );
    expect(screen.getByTestId("ledger-wallet-setup-link")).toHaveTextContent(
      /Ledger connection guide/i
    );
  });

  it("does not render when WebUSB transport is available", () => {
    const { container } = render(
      <LedgerWalletWarningBanner
        detector={() => ({ hasWebUsb: true, hasWebHid: false })}
      />
    );

    expect(
      screen.queryByTestId("ledger-wallet-warning-banner")
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("does not render when only WebHID transport is available", () => {
    const { container } = render(
      <LedgerWalletWarningBanner
        detector={() => ({ hasWebUsb: false, hasWebHid: true })}
      />
    );

    expect(
      screen.queryByTestId("ledger-wallet-warning-banner")
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("does not render when both transports are available", () => {
    const { container } = render(
      <LedgerWalletWarningBanner
        detector={() => ({ hasWebUsb: true, hasWebHid: true })}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("uses a precomputed unavailable availability state", () => {
    const availability: LedgerAvailabilityState = {
      available: false,
      status: "unavailable",
      transportType: "none",
      setupInstruction: LEDGER_SETUP_INSTRUCTION,
      warningMessage: LEDGER_SETUP_INSTRUCTION,
    };

    render(<LedgerWalletWarningBanner availability={availability} />);

    expect(
      screen.getByTestId("ledger-wallet-setup-instruction")
    ).toHaveTextContent(/browser does not support/i);
  });

  it("uses a precomputed error status availability state", () => {
    const availability: LedgerAvailabilityState = {
      available: false,
      status: "error",
      transportType: "none",
      setupInstruction: LEDGER_SETUP_INSTRUCTION,
      warningMessage: `Unable to verify Ledger transport support. ${LEDGER_SETUP_INSTRUCTION}`,
    };

    render(<LedgerWalletWarningBanner availability={availability} />);

    expect(screen.getByRole("alert")).toHaveTextContent(LEDGER_SETUP_INSTRUCTION);
    expect(screen.getByTestId("ledger-wallet-setup-link")).toBeInTheDocument();
  });

  it("does not render when availability reports available", () => {
    const availability: LedgerAvailabilityState = {
      available: true,
      status: "available",
      transportType: "both",
      setupInstruction: null,
      warningMessage: null,
    };

    const { container } = render(
      <LedgerWalletWarningBanner availability={availability} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("does not show banner when transport is available but device is not plugged in (separate concern)", () => {
    const availability: LedgerAvailabilityState = {
      available: true,
      status: "available",
      transportType: "webusb",
      setupInstruction: null,
      warningMessage: null,
    };

    const { container } = render(
      <LedgerWalletWarningBanner availability={availability} />
    );

    expect(
      screen.queryByTestId("ledger-wallet-warning-banner")
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
