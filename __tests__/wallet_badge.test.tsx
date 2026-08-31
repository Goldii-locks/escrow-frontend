import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WalletBadge, { formatAddress } from "@/app/components/WalletBadge";

describe("formatAddress helper", () => {
  it("truncates standard Stellar public address to G...1234 format", () => {
    const fullAddress = "GABC123456789012345678901234567890123456789012345678901234";
    expect(formatAddress(fullAddress)).toBe("GABC...1234");
  });

  it("returns input address as-is if shorter than combined prefix/suffix length", () => {
    expect(formatAddress("G123")).toBe("G123");
  });

  it("handles custom prefix and suffix lengths", () => {
    const fullAddress = "GABC1234567890XYZ";
    expect(formatAddress(fullAddress, 2, 3)).toBe("GA...XYZ");
  });

  it("returns empty string when given empty or null-like address", () => {
    expect(formatAddress("")).toBe("");
  });
});

describe("WalletBadge — layout & node rendering", () => {
  it("renders container node with default testid and status role", () => {
    render(<WalletBadge address="GABC123456789012345678901234567890123456789012345678901234" />);

    const badge = screen.getByTestId("wallet-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("role", "status");
  });

  it("supports custom data-testid prop", () => {
    render(
      <WalletBadge
        data-testid="custom-header-badge"
        address="GABC123456789012345678901234567890123456789012345678901234"
      />
    );

    expect(screen.getByTestId("custom-header-badge")).toBeInTheDocument();
  });

  it("applies custom className alongside default design token classes", () => {
    render(
      <WalletBadge
        address="GABC123456789012345678901234567890123456789012345678901234"
        className="my-custom-class header-badge-layout"
      />
    );

    const badge = screen.getByTestId("wallet-badge");
    expect(badge.className).toContain("my-custom-class");
    expect(badge.className).toContain("header-badge-layout");
    expect(badge.className).toContain("font-mono");
    expect(badge.className).toContain("rounded-full");
  });
});

describe("WalletBadge — connection states", () => {
  it("renders connected state with formatted address and active green dot", () => {
    const fullAddress = "GABC123456789012345678901234567890123456789012345678901234";
    render(<WalletBadge address={fullAddress} isConnected={true} />);

    const badge = screen.getByTestId("wallet-badge");
    expect(badge).toHaveAttribute("aria-label", `Connected wallet ${fullAddress}`);

    const addressNode = screen.getByTestId("wallet-address-text");
    expect(addressNode).toHaveTextContent("GABC...1234");

    const dot = screen.getByTestId("wallet-status-dot");
    expect(dot).toHaveAttribute("data-status", "connected");
    expect(dot.className).toContain("bg-emerald-400");
  });

  it("renders connecting state with spinner/pulse indicator and Connecting... label", () => {
    render(<WalletBadge isConnecting={true} />);

    const badge = screen.getByTestId("wallet-badge");
    expect(badge).toHaveAttribute("aria-label", "Wallet connecting");

    const addressNode = screen.getByTestId("wallet-address-text");
    expect(addressNode).toHaveTextContent("Connecting...");

    const dot = screen.getByTestId("wallet-status-dot");
    expect(dot).toHaveAttribute("data-status", "connecting");
    expect(dot.className).toContain("bg-amber-400");
    expect(dot.className).toContain("animate-pulse");
  });

  it("renders disconnected state when no address is provided", () => {
    render(<WalletBadge address={null} />);

    const badge = screen.getByTestId("wallet-badge");
    expect(badge).toHaveAttribute("aria-label", "Wallet not connected");

    const addressNode = screen.getByTestId("wallet-address-text");
    expect(addressNode).toHaveTextContent("Not Connected");

    const dot = screen.getByTestId("wallet-status-dot");
    expect(dot).toHaveAttribute("data-status", "disconnected");
    expect(dot.className).toContain("bg-gray-500");
  });

  it("renders network mismatch state when networkMismatch prop is present", () => {
    const fullAddress = "GABC123456789012345678901234567890123456789012345678901234";
    render(
      <WalletBadge
        address={fullAddress}
        networkMismatch="Network mismatch: App expects Testnet"
      />
    );

    const badge = screen.getByTestId("wallet-badge");
    expect(badge).toHaveAttribute(
      "aria-label",
      `Wallet network mismatch ${fullAddress}`
    );

    const dot = screen.getByTestId("wallet-status-dot");
    expect(dot).toHaveAttribute("data-status", "mismatch");
    expect(dot.className).toContain("bg-rose-400");
  });
});

describe("WalletBadge — provider tag & status dot options", () => {
  it("renders active wallet provider tag when providerName is provided", () => {
    render(
      <WalletBadge
        address="GABC123456789012345678901234567890123456789012345678901234"
        providerName="Freighter"
      />
    );

    const providerTag = screen.getByTestId("wallet-provider-tag");
    expect(providerTag).toBeInTheDocument();
    expect(providerTag).toHaveTextContent("Freighter");
  });

  it("omits provider tag when providerName is not supplied", () => {
    render(
      <WalletBadge address="GABC123456789012345678901234567890123456789012345678901234" />
    );

    expect(screen.queryByTestId("wallet-provider-tag")).not.toBeInTheDocument();
  });

  it("hides status dot when showStatusDot is set to false", () => {
    render(
      <WalletBadge
        address="GABC123456789012345678901234567890123456789012345678901234"
        showStatusDot={false}
      />
    );

    expect(screen.queryByTestId("wallet-status-dot")).not.toBeInTheDocument();
  });
});

describe("WalletBadge — interactions", () => {
  it("renders disconnect button when onDisconnect is provided while connected", () => {
    const handleDisconnect = vi.fn();
    render(
      <WalletBadge
        address="GABC123456789012345678901234567890123456789012345678901234"
        onDisconnect={handleDisconnect}
      />
    );

    const disconnectBtn = screen.getByTestId("wallet-disconnect-btn");
    expect(disconnectBtn).toBeInTheDocument();

    fireEvent.click(disconnectBtn);
    expect(handleDisconnect).toHaveBeenCalledTimes(1);
  });

  it("invokes onClick callback when badge is clicked", () => {
    const handleClick = vi.fn();
    render(
      <WalletBadge
        address="GABC123456789012345678901234567890123456789012345678901234"
        onClick={handleClick}
      />
    );

    const badge = screen.getByTestId("wallet-badge");
    fireEvent.click(badge);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
