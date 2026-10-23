// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import FreighterNetworkWarningBar from "@/app/components/FreighterNetworkWarningBar";

describe("FreighterNetworkWarningBar (#106)", () => {
  it("renders a warning bar when the wallet network does not match the app network", () => {
    render(
      <FreighterNetworkWarningBar walletNetwork="mainnet" appNetwork="testnet" />
    );

    const bar = screen.getByTestId("freighter-network-warning-bar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("role", "alert");
    expect(bar).toHaveTextContent(/Network mismatch/i);
    expect(bar).toHaveTextContent(/Mainnet/);
    expect(bar).toHaveTextContent(/Testnet/);
  });

  it("does not render when the wallet network matches the app network", () => {
    const { container } = render(
      <FreighterNetworkWarningBar walletNetwork="testnet" appNetwork="testnet" />
    );

    expect(
      screen.queryByTestId("freighter-network-warning-bar")
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
