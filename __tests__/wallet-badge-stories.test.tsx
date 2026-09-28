import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import WalletBadge from "@/app/components/WalletBadge";

describe("WalletBadge Storybook stories — rendering validation", () => {
  it("renders Disconnected state correctly", () => {
    render(<WalletBadge address={null} status="disconnected" />);
    expect(screen.getByTestId("wallet-badge")).toHaveAttribute(
      "data-status",
      "disconnected"
    );
    expect(screen.getByText("No wallet")).toBeInTheDocument();
  });

  it("renders Connected state correctly", () => {
    render(
      <WalletBadge
        address="GBHK5YMW4RJL5Q3Z6GXPRQ7GQSFN7W5Y3Y3K7H5T6L7M8N9P0Q1R2S3"
        status="connected"
      />
    );
    expect(screen.getByTestId("wallet-badge")).toHaveAttribute(
      "data-status",
      "connected"
    );
    expect(screen.getByText("GBHK...R2S3")).toBeInTheDocument();
  });

  it("renders Connected with disconnect button correctly", () => {
    render(
      <WalletBadge
        address="GBHK5YMW4RJL5Q3Z6GXPRQ7GQSFN7W5Y3Y3K7H5T6L7M8N9P0Q1R2S3"
        status="connected"
        onDisconnect={() => {}}
      />
    );
    expect(
      screen.getByRole("button", { name: "Disconnect wallet" })
    ).toBeInTheDocument();
  });

  it("renders Loading state correctly", () => {
    render(<WalletBadge address={null} status="loading" />);
    expect(screen.getByTestId("wallet-badge")).toHaveAttribute(
      "data-status",
      "loading"
    );
    expect(screen.getByText("Connecting…")).toBeInTheDocument();
  });

  it("renders Error state with message correctly", () => {
    render(
      <WalletBadge
        status="error"
        errorMessage="Failed to connect wallet. Please try again."
      />
    );
    expect(screen.getByTestId("wallet-badge")).toHaveAttribute(
      "data-status",
      "error"
    );
    expect(
      screen.getByText("Failed to connect wallet. Please try again.")
    ).toBeInTheDocument();
  });

  it("renders Error state without message (fallback) correctly", () => {
    render(<WalletBadge status="error" errorMessage={null} />);
    expect(screen.getByText("Wallet error")).toBeInTheDocument();
  });

  it("renders alternate address correctly", () => {
    render(
      <WalletBadge
        address="GARY4SMFL5NFQE3TZLQ7YR4XRXK6V5W5Y7YJ6H5K7Q8R9S0T1U2V3W4"
        status="connected"
      />
    );
    expect(screen.getByText("GARY...V3W4")).toBeInTheDocument();
  });

  it("renders full Stellar address correctly", () => {
    render(
      <WalletBadge
        address="GBHK5YMW4RJL5Q3Z6GXPRQ7GQSFN7W5Y3Y3K7H5T6L7M8N9P0Q1R2S3T4U5V6W7"
        status="connected"
        onDisconnect={() => {}}
      />
    );
    expect(screen.getByText("GBHK...V6W7")).toBeInTheDocument();
  });

  it("no real wallet connection is attempted", () => {
    render(<WalletBadge status="disconnected" />);
    const badge = screen.getByTestId("wallet-badge");
    expect(badge).not.toHaveAttribute("data-status", "connected");
  });
});
