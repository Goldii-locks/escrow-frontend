// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import NetworkSyncNetworkWarningBar from "@/app/components/NetworkSyncNetworkWarningBar";

describe("NetworkSyncNetworkWarningBar", () => {
  it("renders a warning bar when wallet and app networks do not match", () => {
    render(<NetworkSyncNetworkWarningBar walletNetwork="mainnet" appNetwork="testnet" />);

    const banner = screen.getByTestId("network-sync-network-warning-bar");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveTextContent(/Network out of sync/i);
    expect(banner).toHaveTextContent(/Mainnet/);
    expect(banner).toHaveTextContent(/Testnet/);
  });

  it("does not render when networks match", () => {
    const { container } = render(
      <NetworkSyncNetworkWarningBar walletNetwork="testnet" appNetwork="testnet" />
    );

    expect(screen.queryByTestId("network-sync-network-warning-bar")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
