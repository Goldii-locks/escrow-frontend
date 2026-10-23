// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AlbedoNetworkWarningBar from "@/app/components/AlbedoNetworkWarningBar";

describe("AlbedoNetworkWarningBar (#126)", () => {
  it("renders a warning bar when wallet and app networks differ", () => {
    render(
      <AlbedoNetworkWarningBar walletNetwork="mainnet" appNetwork="testnet" />
    );

    const bar = screen.getByTestId("albedo-network-warning-bar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("role", "alert");
    expect(bar).toHaveTextContent(/Network mismatch/i);
    expect(bar).toHaveTextContent(/Mainnet/);
    expect(bar).toHaveTextContent(/Testnet/);
  });

  it("does not render when networks match", () => {
    const { container } = render(
      <AlbedoNetworkWarningBar walletNetwork="testnet" appNetwork="testnet" />
    );

    expect(
      screen.queryByTestId("albedo-network-warning-bar")
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the inverse mismatch (testnet wallet on mainnet app)", () => {
    render(
      <AlbedoNetworkWarningBar walletNetwork="testnet" appNetwork="mainnet" />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/Testnet/);
    expect(screen.getByRole("alert")).toHaveTextContent(/Mainnet/);
  });

  it("appends a custom className onto the default classes", () => {
    render(
      <AlbedoNetworkWarningBar
        walletNetwork="mainnet"
        appNetwork="testnet"
        className="custom-class"
      />
    );

    expect(screen.getByTestId("albedo-network-warning-bar")).toHaveClass(
      "custom-class"
    );
  });
});
