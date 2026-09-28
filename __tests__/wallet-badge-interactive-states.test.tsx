import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import WalletBadge from "@/app/components/WalletBadge";

const SAMPLE_ADDRESS = "GBHK5YMW4RJL5Q3Z6GXPRQ7GQSFN7W5Y3Y3K7H5T6L7M8N9P0Q1R2S3";

const badge = () => screen.getByTestId("wallet-badge");

describe("WalletBadge — interactive state styling", () => {
  // -------------------------------------------------------------------------
  // Non-interactive default
  // -------------------------------------------------------------------------

  describe("non-interactive badge", () => {
    it("renders a span when no onClick is provided", () => {
      render(<WalletBadge status="disconnected" />);
      expect(badge().tagName).toBe("SPAN");
    });

    it("does not apply interactive hover utilities", () => {
      render(<WalletBadge status="disconnected" />);
      expect(badge().className).not.toContain("hover:bg-surface-card");
    });

    it("keeps the shared transition utility", () => {
      render(<WalletBadge status="disconnected" />);
      expect(badge().className).toContain("transition-colors");
    });
  });

  // -------------------------------------------------------------------------
  // Hover
  // -------------------------------------------------------------------------

  describe("hover state", () => {
    it("applies hover background and border utilities when actionable", () => {
      render(<WalletBadge status="disconnected" onClick={() => {}} />);
      expect(badge().className).toContain("hover:bg-surface-card");
      expect(badge().className).toContain("hover:border-accent-soft");
    });

    it("shows a pointer cursor when actionable", () => {
      render(<WalletBadge status="disconnected" onClick={() => {}} />);
      expect(badge().className).toContain("cursor-pointer");
    });

    it("styles the disconnect control on hover", () => {
      render(
        <WalletBadge
          address={SAMPLE_ADDRESS}
          status="connected"
          onDisconnect={() => {}}
        />
      );
      const disconnect = screen.getByRole("button", {
        name: "Disconnect wallet",
      });
      expect(disconnect.className).toContain("hover:text-danger-soft-hover");
      expect(disconnect.className).toContain("hover:bg-danger/30");
    });

    it("responds to a hover interaction by firing pointer events", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<WalletBadge status="disconnected" onClick={onClick} />);
      await user.hover(badge());
      await user.click(badge());
      expect(onClick).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Focus-visible
  // -------------------------------------------------------------------------

  describe("focus-visible state", () => {
    it("applies a focus-visible ring when actionable", () => {
      render(<WalletBadge status="disconnected" onClick={() => {}} />);
      const className = badge().className;
      expect(className).toContain("focus-visible:outline-none");
      expect(className).toContain("focus-visible:ring-2");
      expect(className).toContain("focus-visible:ring-accent");
      expect(className).toContain("focus-visible:ring-offset-2");
      expect(className).toContain("focus-visible:ring-offset-surface-page");
    });

    it("applies a focus-visible ring to the disconnect control", () => {
      render(
        <WalletBadge
          address={SAMPLE_ADDRESS}
          status="connected"
          onDisconnect={() => {}}
        />
      );
      const className = screen.getByRole("button", {
        name: "Disconnect wallet",
      }).className;
      expect(className).toContain("focus-visible:ring-2");
      expect(className).toContain("focus-visible:ring-accent");
    });

    it("receives keyboard focus when actionable", async () => {
      const user = userEvent.setup();
      render(<WalletBadge status="disconnected" onClick={() => {}} />);
      await user.tab();
      expect(badge()).toHaveFocus();
    });

    it("activates on Enter once focused", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<WalletBadge status="disconnected" onClick={onClick} />);
      await user.tab();
      await user.keyboard("{Enter}");
      expect(onClick).toHaveBeenCalledOnce();
    });

    it("is not focusable when the badge is not actionable", async () => {
      const user = userEvent.setup();
      render(<WalletBadge status="disconnected" />);
      await user.tab();
      expect(badge()).not.toHaveFocus();
    });
  });

  // -------------------------------------------------------------------------
  // Disabled
  // -------------------------------------------------------------------------

  describe("disabled state", () => {
    it("applies disabled opacity and cursor utilities", () => {
      render(<WalletBadge status="disconnected" onClick={() => {}} disabled />);
      const className = badge().className;
      expect(className).toContain("disabled:opacity-50");
      expect(className).toContain("disabled:cursor-not-allowed");
    });

    it("neutralises the hover utilities while disabled", () => {
      render(<WalletBadge status="disconnected" onClick={() => {}} disabled />);
      const className = badge().className;
      expect(className).toContain("disabled:hover:bg-surface-field");
      expect(className).toContain("disabled:hover:border-border-subtle");
    });

    it("sets the disabled attribute on the actionable badge", () => {
      render(<WalletBadge status="disconnected" onClick={() => {}} disabled />);
      expect(badge()).toBeDisabled();
    });

    it("exposes data-disabled for styling hooks", () => {
      render(<WalletBadge status="disconnected" onClick={() => {}} disabled />);
      expect(badge()).toHaveAttribute("data-disabled", "true");
    });

    it("does not fire onClick while disabled", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(
        <WalletBadge status="disconnected" onClick={onClick} disabled />
      );
      await user.click(badge());
      expect(onClick).not.toHaveBeenCalled();
    });

    it("is skipped by keyboard focus while disabled", async () => {
      const user = userEvent.setup();
      render(<WalletBadge status="disconnected" onClick={() => {}} disabled />);
      await user.tab();
      expect(badge()).not.toHaveFocus();
    });

    it("auto-disables the badge action while loading", () => {
      render(<WalletBadge status="loading" onClick={() => {}} />);
      expect(badge()).toBeDisabled();
      expect(badge()).toHaveAttribute("data-disabled", "true");
    });

    it("marks a non-interactive badge with aria-disabled while loading", () => {
      render(<WalletBadge status="loading" />);
      expect(badge()).toHaveAttribute("aria-disabled", "true");
    });

    it("does not mark an enabled badge as aria-disabled", () => {
      render(<WalletBadge status="disconnected" />);
      expect(badge()).not.toHaveAttribute("aria-disabled");
    });

    it("disables the disconnect control when the badge is disabled", () => {
      render(
        <WalletBadge
          address={SAMPLE_ADDRESS}
          status="connected"
          onDisconnect={() => {}}
          disabled
        />
      );
      expect(
        screen.getByRole("button", { name: "Disconnect wallet" })
      ).toBeDisabled();
    });

    it("does not fire onDisconnect while disabled", async () => {
      const user = userEvent.setup();
      const onDisconnect = vi.fn();
      render(
        <WalletBadge
          address={SAMPLE_ADDRESS}
          status="connected"
          onDisconnect={onDisconnect}
          disabled
        />
      );
      await user.click(
        screen.getByRole("button", { name: "Disconnect wallet" })
      );
      expect(onDisconnect).not.toHaveBeenCalled();
    });

    it("applies disabled utilities to the disconnect control", () => {
      render(
        <WalletBadge
          address={SAMPLE_ADDRESS}
          status="connected"
          onDisconnect={() => {}}
        />
      );
      const className = screen.getByRole("button", {
        name: "Disconnect wallet",
      }).className;
      expect(className).toContain("disabled:opacity-50");
      expect(className).toContain("disabled:cursor-not-allowed");
      expect(className).toContain("disabled:hover:text-text-muted");
    });
  });

  // -------------------------------------------------------------------------
  // Composition with the existing states
  // -------------------------------------------------------------------------

  describe("composition", () => {
    it("keeps the status design tokens on an actionable badge", () => {
      render(
        <WalletBadge
          address={SAMPLE_ADDRESS}
          status="connected"
          onClick={() => {}}
        />
      );
      expect(badge().className).toContain("bg-surface-field");
      expect(badge().className).toContain("text-text-primary");
    });

    it("renders both the badge action and the disconnect control", () => {
      render(
        <WalletBadge
          address={SAMPLE_ADDRESS}
          status="connected"
          onClick={() => {}}
          onDisconnect={() => {}}
        />
      );
      expect(badge().tagName).toBe("BUTTON");
      expect(
        screen.getByRole("button", { name: "Disconnect wallet" })
      ).toBeInTheDocument();
    });

    it("still applies a custom className to an actionable badge", () => {
      render(
        <WalletBadge status="disconnected" onClick={() => {}} className="mt-4" />
      );
      expect(badge().className).toContain("mt-4");
    });

    it("falls back to the disconnected visuals when connected without an address", () => {
      render(<WalletBadge status="connected" address={null} />);
      expect(badge()).toHaveAttribute("data-status", "disconnected");
      expect(screen.getByText("No wallet")).toBeInTheDocument();
    });

    it("keeps the error title on an actionable badge", () => {
      render(
        <WalletBadge
          status="error"
          errorMessage="Network mismatch"
          onClick={() => {}}
        />
      );
      expect(badge()).toHaveAttribute("title", "Network mismatch");
    });
  });
});
