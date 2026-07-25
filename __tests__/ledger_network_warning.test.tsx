import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import LedgerNetworkWarningBar from "@/app/components/LedgerNetworkWarningBar";

describe("LedgerNetworkWarningBar", () => {
  it("renders a warning bar when wallet and app networks differ", () => {
    render(
      <LedgerNetworkWarningBar walletNetwork="mainnet" appNetwork="testnet" />
    );

    const bar = screen.getByTestId("ledger-network-warning-bar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("role", "alert");
    expect(bar).toHaveTextContent(/Network mismatch/i);
    expect(bar).toHaveTextContent(/Mainnet/);
    expect(bar).toHaveTextContent(/Testnet/);
  });

  it("does not render when networks match", () => {
    const { container } = render(
      <LedgerNetworkWarningBar walletNetwork="testnet" appNetwork="testnet" />
    );

    expect(
      screen.queryByTestId("ledger-network-warning-bar")
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the inverse mismatch (testnet wallet on mainnet app)", () => {
    render(
      <LedgerNetworkWarningBar walletNetwork="testnet" appNetwork="mainnet" />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/Testnet/);
    expect(screen.getByRole("alert")).toHaveTextContent(/Mainnet/);
  });
});
