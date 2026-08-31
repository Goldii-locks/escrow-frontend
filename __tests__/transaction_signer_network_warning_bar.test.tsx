import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import TransactionSignerNetworkWarningBar from "@/app/components/TransactionSignerNetworkWarningBar";

describe("TransactionSignerNetworkWarningBar (#216)", () => {
  it("renders a warning bar when the wallet network does not match the app network", () => {
    render(
      <TransactionSignerNetworkWarningBar
        walletNetwork="mainnet"
        appNetwork="testnet"
      />
    );

    const bar = screen.getByTestId("transaction-signer-network-warning-bar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("role", "alert");
    expect(bar).toHaveTextContent(/Network mismatch/i);
    expect(bar).toHaveTextContent(/Mainnet/);
    expect(bar).toHaveTextContent(/Testnet/);
  });

  it("does not render when the wallet network matches the app network", () => {
    const { container } = render(
      <TransactionSignerNetworkWarningBar
        walletNetwork="testnet"
        appNetwork="testnet"
      />
    );

    expect(
      screen.queryByTestId("transaction-signer-network-warning-bar")
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the reverse mismatch (testnet wallet, mainnet app)", () => {
    render(
      <TransactionSignerNetworkWarningBar
        walletNetwork="testnet"
        appNetwork="mainnet"
      />
    );

    const bar = screen.getByTestId("transaction-signer-network-warning-bar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveTextContent(/Network mismatch/i);
    expect(bar).toHaveTextContent(/Testnet/);
    expect(bar).toHaveTextContent(/Mainnet/);
  });

  it("applies additional className when provided", () => {
    render(
      <TransactionSignerNetworkWarningBar
        walletNetwork="mainnet"
        appNetwork="testnet"
        className="mt-4"
      />
    );

    const bar = screen.getByTestId("transaction-signer-network-warning-bar");
    expect(bar.className).toContain("mt-4");
  });

  it("uses role=alert for accessibility", () => {
    render(
      <TransactionSignerNetworkWarningBar
        walletNetwork="mainnet"
        appNetwork="testnet"
      />
    );

    const bar = screen.getByRole("alert");
    expect(bar).toHaveTextContent(/Network mismatch/i);
  });
});
