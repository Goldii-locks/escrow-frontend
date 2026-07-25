import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import RabeNetworkWarningBar from "@/app/components/RabeNetworkWarningBar";

describe("RabeNetworkWarningBar", () => {
  it("renders a warning bar when wallet and app networks differ", () => {
    render(
      <RabeNetworkWarningBar walletNetwork="mainnet" appNetwork="testnet" />
    );

    const bar = screen.getByTestId("rabe-network-warning-bar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("role", "alert");
    expect(bar).toHaveTextContent(/Network mismatch/i);
    expect(bar).toHaveTextContent(/Mainnet/);
    expect(bar).toHaveTextContent(/Testnet/);
  });

  it("does not render when networks match", () => {
    const { container } = render(
      <RabeNetworkWarningBar walletNetwork="testnet" appNetwork="testnet" />
    );

    expect(
      screen.queryByTestId("rabe-network-warning-bar")
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the inverse mismatch (testnet wallet on mainnet app)", () => {
    render(
      <RabeNetworkWarningBar walletNetwork="testnet" appNetwork="mainnet" />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/Testnet/);
    expect(screen.getByRole("alert")).toHaveTextContent(/Mainnet/);
  });
});
