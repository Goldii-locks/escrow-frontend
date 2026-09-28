import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WalletBadge, {
  formatAddress,
  isValidStellarAddress,
} from "@/app/components/WalletBadge";

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

describe("isValidStellarAddress helper", () => {
  it("returns true for a valid 56-character Stellar G-address", () => {
    const validGAddress = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
    expect(isValidStellarAddress(validGAddress)).toBe(true);
  });

  it("returns false for malformed addresses or invalid characters", () => {
    expect(isValidStellarAddress("G123")).toBe(false);
    expect(isValidStellarAddress("INVALID_ADDRESS")).toBe(false);
    expect(isValidStellarAddress("")).toBe(false);
    expect(isValidStellarAddress(null)).toBe(false);
    expect(isValidStellarAddress(undefined)).toBe(false);
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

describe("WalletBadge — validation field errors & indicators", () => {
  it("renders field error indicator and error message when error prop is provided", () => {
    render(
      <WalletBadge
        address="GABC123456789012345678901234567890123456789012345678901234"
        error="Invalid secret key format"
      />
    );

    const badge = screen.getByTestId("wallet-badge");
    expect(badge).toHaveAttribute("aria-invalid", "true");

    const fieldError = screen.getByTestId("wallet-field-error");
    expect(fieldError).toBeInTheDocument();

    const errorText = screen.getByTestId("wallet-error-text");
    expect(errorText).toHaveTextContent("Invalid secret key format");

    const dot = screen.getByTestId("wallet-status-dot");
    expect(dot).toHaveAttribute("data-status", "error");
    expect(dot.className).toContain("bg-red-500");
  });

  it("renders field error indicator when fieldError prop is supplied", () => {
    render(
      <WalletBadge
        address="GABC123456789012345678901234567890123456789012345678901234"
        fieldError="Address checksum failed"
      />
    );

    expect(screen.getByTestId("wallet-field-error")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-error-text")).toHaveTextContent("Address checksum failed");
  });

  it("triggers address format validation when validateAddress is true and address is invalid", () => {
    render(<WalletBadge address="G123INVALID" validateAddress={true} />);

    const badge = screen.getByTestId("wallet-badge");
    expect(badge).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("wallet-field-error")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-error-text")).toHaveTextContent("Invalid Stellar address");
  });

  it("toggles error text elements off when validation errors are cleared", () => {
    const { rerender } = render(
      <WalletBadge
        address="GABC123456789012345678901234567890123456789012345678901234"
        error="Config error"
      />
    );

    expect(screen.getByTestId("wallet-field-error")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-error-text")).toBeInTheDocument();

    // Rerender with error cleared
    rerender(
      <WalletBadge
        address="GABC123456789012345678901234567890123456789012345678901234"
        error={null}
      />
    );

    expect(screen.queryByTestId("wallet-field-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wallet-error-text")).not.toBeInTheDocument();
    expect(screen.getByTestId("wallet-badge")).not.toHaveAttribute("aria-invalid");
  });
});

describe("WalletBadge — alerts", () => {
  it("renders alert badge and text when alert prop is passed", () => {
    render(
      <WalletBadge
        address="GABC123456789012345678901234567890123456789012345678901234"
        alert="Wallet session expiring soon"
      />
    );

    const alertBadge = screen.getByTestId("wallet-alert-badge");
    expect(alertBadge).toBeInTheDocument();

    const alertText = screen.getByTestId("wallet-alert-text");
    expect(alertText).toHaveTextContent("Wallet session expiring soon");

    const dot = screen.getByTestId("wallet-status-dot");
    expect(dot).toHaveAttribute("data-status", "alert");
    expect(dot.className).toContain("bg-amber-500");
  });

  it("toggles alert elements off when alert prop is cleared", () => {
    const { rerender } = render(
      <WalletBadge
        address="GABC123456789012345678901234567890123456789012345678901234"
        alert="Warning text"
      />
    );

    expect(screen.getByTestId("wallet-alert-badge")).toBeInTheDocument();

    rerender(
      <WalletBadge
        address="GABC123456789012345678901234567890123456789012345678901234"
        alert={null}
      />
    );

    expect(screen.queryByTestId("wallet-alert-badge")).not.toBeInTheDocument();
  });

  it("prioritizes validation error state over alert state when both are present", () => {
    render(
      <WalletBadge
        address="GABC123456789012345678901234567890123456789012345678901234"
        error="Critical configuration error"
        alert="Low balance alert"
      />
    );

    expect(screen.getByTestId("wallet-field-error")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-error-text")).toHaveTextContent("Critical configuration error");
    expect(screen.queryByTestId("wallet-alert-badge")).not.toBeInTheDocument();
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

describe("WalletBadge — empty data states & placeholder elements", () => {
  it("renders descriptive placeholder elements when address is an empty string or whitespace", () => {
    render(<WalletBadge address="" />);

    const badge = screen.getByTestId("wallet-badge");
    expect(badge).toHaveAttribute("data-empty-state", "true");

    const addressNode = screen.getByTestId("wallet-address-text");
    expect(addressNode).toHaveTextContent("Not Connected");
    expect(addressNode.className).toContain("italic");

    const placeholderBadge = screen.getByTestId("wallet-badge-placeholder");
    expect(placeholderBadge).toBeInTheDocument();
    expect(placeholderBadge).toHaveTextContent("Empty");
  });

  it("renders empty list placeholder tag when accounts is an empty array []", () => {
    render(
      <WalletBadge
        address="GABC123456789012345678901234567890123456789012345678901234"
        accounts={[]}
      />
    );

    const badge = screen.getByTestId("wallet-badge");
    expect(badge).toHaveAttribute("data-empty-state", "true");

    const emptyListTag = screen.getByTestId("wallet-empty-list-placeholder");
    expect(emptyListTag).toBeInTheDocument();
    expect(emptyListTag).toHaveTextContent("No active accounts");
  });

  it("renders empty list placeholder tag when wallets is an empty array []", () => {
    render(<WalletBadge wallets={[]} />);

    const emptyListTag = screen.getByTestId("wallet-empty-list-placeholder");
    expect(emptyListTag).toBeInTheDocument();
    expect(emptyListTag).toHaveTextContent("No wallets available");
  });

  it("renders empty list placeholder tag when items is an empty array []", () => {
    render(<WalletBadge items={[]} />);

    const emptyListTag = screen.getByTestId("wallet-empty-list-placeholder");
    expect(emptyListTag).toBeInTheDocument();
    expect(emptyListTag).toHaveTextContent("No items available");
  });

  it("renders custom emptyText in placeholder element when provided", () => {
    render(<WalletBadge address={null} emptyText="No Address Provided" />);

    expect(screen.getByTestId("wallet-address-text")).toHaveTextContent("No Address Provided");
    expect(screen.getByTestId("wallet-badge-placeholder")).toHaveTextContent("No Address Provided");
  });

  it("renders custom emptyPlaceholder node when emptyPlaceholder prop is passed", () => {
    render(
      <WalletBadge
        address=""
        emptyPlaceholder={<span data-testid="custom-placeholder-node">Select a Wallet</span>}
      />
    );

    expect(screen.getByTestId("wallet-badge-placeholder-custom")).toBeInTheDocument();
    expect(screen.getByTestId("custom-placeholder-node")).toHaveTextContent("Select a Wallet");
  });

  it("renders empty state placeholder when showEmptyPlaceholder is set to true", () => {
    render(
      <WalletBadge
        address="GABC123456789012345678901234567890123456789012345678901234"
        showEmptyPlaceholder={true}
      />
    );

    const badge = screen.getByTestId("wallet-badge");
    expect(badge).toHaveAttribute("data-empty-state", "true");
    expect(screen.getByTestId("wallet-badge-placeholder")).toBeInTheDocument();
  });

  it("includes accessible empty state description in aria-label", () => {
    render(<WalletBadge accounts={[]} emptyText="No accounts configured" />);

    const badge = screen.getByTestId("wallet-badge");
    expect(badge).toHaveAttribute(
      "aria-label",
      "Wallet placeholder state: No accounts configured"
    );
  });
});


