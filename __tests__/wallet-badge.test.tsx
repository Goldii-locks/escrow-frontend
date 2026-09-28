import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import WalletBadge from "@/app/components/WalletBadge";

const SAMPLE_ADDRESS = "GBHK5YMW4RJL5Q3Z6GXPRQ7GQSFN7W5Y3Y3K7H5T6L7M8N9P0Q1R2S3";

describe("WalletBadge", () => {
  describe("disconnected state", () => {
    it("renders 'No wallet' text when disconnected", () => {
      render(<WalletBadge status="disconnected" />);
      expect(screen.getByText("No wallet")).toBeInTheDocument();
    });

    it("sets data-status to disconnected", () => {
      render(<WalletBadge status="disconnected" />);
      expect(screen.getByTestId("wallet-badge")).toHaveAttribute(
        "data-status",
        "disconnected"
      );
    });

    it("renders disconnected status when no address provided", () => {
      render(<WalletBadge />);
      expect(screen.getByTestId("wallet-badge")).toHaveAttribute(
        "data-status",
        "disconnected"
      );
    });
  });

  describe("connected state", () => {
    it("renders truncated address when connected", () => {
      render(<WalletBadge address={SAMPLE_ADDRESS} status="connected" />);
      expect(screen.getByText("GBHK...R2S3")).toBeInTheDocument();
    });

    it("sets data-status to connected", () => {
      render(<WalletBadge address={SAMPLE_ADDRESS} status="connected" />);
      expect(screen.getByTestId("wallet-badge")).toHaveAttribute(
        "data-status",
        "connected"
      );
    });

    it("includes aria-label with full address", () => {
      render(<WalletBadge address={SAMPLE_ADDRESS} status="connected" />);
      expect(screen.getByLabelText(`Connected wallet ${SAMPLE_ADDRESS}`)).toBeInTheDocument();
    });

    it("renders disconnect button when onDisconnect is provided", () => {
      const onDisconnect = vi.fn();
      render(
        <WalletBadge
          address={SAMPLE_ADDRESS}
          status="connected"
          onDisconnect={onDisconnect}
        />
      );
      expect(screen.getByRole("button", { name: "Disconnect wallet" })).toBeInTheDocument();
    });

    it("does not render disconnect button when onDisconnect is not provided", () => {
      render(<WalletBadge address={SAMPLE_ADDRESS} status="connected" />);
      expect(screen.queryByRole("button", { name: "Disconnect wallet" })).not.toBeInTheDocument();
    });

    it("calls onDisconnect when disconnect button is clicked", async () => {
      const user = userEvent.setup();
      const onDisconnect = vi.fn();
      render(
        <WalletBadge
          address={SAMPLE_ADDRESS}
          status="connected"
          onDisconnect={onDisconnect}
        />
      );
      await user.click(screen.getByRole("button", { name: "Disconnect wallet" }));
      expect(onDisconnect).toHaveBeenCalledOnce();
    });
  });

  describe("loading state", () => {
    it("renders 'Connecting…' text when loading", () => {
      render(<WalletBadge status="loading" />);
      expect(screen.getByText("Connecting…")).toBeInTheDocument();
    });

    it("sets data-status to loading", () => {
      render(<WalletBadge status="loading" />);
      expect(screen.getByTestId("wallet-badge")).toHaveAttribute(
        "data-status",
        "loading"
      );
    });

    it("renders a spinner", () => {
      const { container } = render(<WalletBadge status="loading" />);
      expect(container.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("renders error message when provided", () => {
      render(
        <WalletBadge status="error" errorMessage="Connection failed" />
      );
      expect(screen.getByText("Connection failed")).toBeInTheDocument();
    });

    it("renders fallback text when no error message", () => {
      render(<WalletBadge status="error" errorMessage={null} />);
      expect(screen.getByText("Wallet error")).toBeInTheDocument();
    });

    it("sets data-status to error", () => {
      render(<WalletBadge status="error" errorMessage="fail" />);
      expect(screen.getByTestId("wallet-badge")).toHaveAttribute(
        "data-status",
        "error"
      );
    });

    it("sets title attribute for error tooltip", () => {
      render(
        <WalletBadge status="error" errorMessage="Network mismatch" />
      );
      expect(screen.getByTestId("wallet-badge")).toHaveAttribute(
        "title",
        "Network mismatch"
      );
    });
  });

  describe("design tokens", () => {
    it("applies custom className", () => {
      render(<WalletBadge status="disconnected" className="mt-4" />);
      expect(screen.getByTestId("wallet-badge").className).toContain("mt-4");
    });

    it("uses design token classes for connected state", () => {
      render(<WalletBadge address={SAMPLE_ADDRESS} status="connected" />);
      const badge = screen.getByTestId("wallet-badge");
      expect(badge.className).toContain("bg-surface-field");
      expect(badge.className).toContain("text-text-primary");
      expect(badge.className).toContain("border-border-subtle");
    });

    it("uses design token classes for error state", () => {
      render(<WalletBadge status="error" errorMessage="fail" />);
      const badge = screen.getByTestId("wallet-badge");
      expect(badge.className).toContain("text-danger-soft");
      expect(badge.className).toContain("border-danger");
    });

    it("uses design token classes for loading state", () => {
      render(<WalletBadge status="loading" />);
      const badge = screen.getByTestId("wallet-badge");
      expect(badge.className).toContain("text-text-muted");
      expect(badge.className).toContain("bg-surface-field");
    });

    it("uses design token classes for disconnected state", () => {
      render(<WalletBadge status="disconnected" />);
      const badge = screen.getByTestId("wallet-badge");
      expect(badge.className).toContain("text-text-muted");
      expect(badge.className).toContain("bg-surface-field");
    });
  });
});
