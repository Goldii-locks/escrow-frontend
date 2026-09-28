/**
 * WalletBadge – mobile viewport overlay / clickability tests
 *
 * Issue #259: wallet_badge interactive elements must remain clickable at
 * mobile viewport heights and must not be obscured by stacking-context issues.
 *
 * jsdom does not do real CSS layout or z-index painting, so we verify:
 *  - the interactive element is rendered and present in the DOM at any viewport
 *  - pointer-events are not explicitly disabled on the element (style check)
 *  - click handlers fire correctly at a simulated mobile viewport size
 *  - desktop viewport rendering is unchanged (regression)
 *
 * The viewport height is simulated by resizing window.innerHeight before
 * rendering, matching common culprit heights for mobile "short viewport" bugs
 * (iPhone SE: 568px, iPhone 8: 667px).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WalletBadge from "../WalletBadge";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: height,
  });
}

const MOBILE_VIEWPORTS = [
  { label: "iPhone SE (375×568)", width: 375, height: 568 },
  { label: "iPhone 8 (375×667)", width: 375, height: 667 },
  { label: "iPhone 8 Plus (414×736)", width: 414, height: 736 },
] as const;

const TEST_ADDRESS = "GBHK5YMW4RJL5Q3Z6GXPRQ7GQSFN7W5Y3Y3K7H5T6L7M8N9P0Q1R2S3";

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("WalletBadge – mobile viewport overlay/clickability (Issue #259)", () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
  });

  afterEach(() => {
    setViewport(originalInnerWidth, originalInnerHeight);
  });

  // ── 1. Interactive element present + pointer-events not disabled ──────────

  describe("interactive element presence at mobile viewport heights", () => {
    MOBILE_VIEWPORTS.forEach(({ label, width, height }) => {
      it(`disconnect button is in the DOM at ${label}`, () => {
        setViewport(width, height);
        const onDisconnect = vi.fn();
        render(
          <WalletBadge
            address={TEST_ADDRESS}
            status="connected"
            onDisconnect={onDisconnect}
          />
        );
        const btn = screen.getByRole("button", { name: /disconnect wallet/i });
        expect(btn).toBeInTheDocument();
      });

      it(`disconnect button does not have pointer-events: none at ${label}`, () => {
        setViewport(width, height);
        const onDisconnect = vi.fn();
        render(
          <WalletBadge
            address={TEST_ADDRESS}
            status="connected"
            onDisconnect={onDisconnect}
          />
        );
        const btn = screen.getByRole("button", { name: /disconnect wallet/i });
        // jsdom computes inline styles; Tailwind class-based styles are not
        // applied by jsdom, but we can assert no inline override exists.
        expect(btn).not.toHaveStyle({ pointerEvents: "none" });
      });
    });
  });

  // ── 2. Click handler fires at mobile viewport heights ────────────────────

  describe("click handler fires at mobile viewport heights", () => {
    MOBILE_VIEWPORTS.forEach(({ label, width, height }) => {
      it(`onDisconnect fires when disconnect button is clicked at ${label}`, () => {
        setViewport(width, height);
        const onDisconnect = vi.fn();
        render(
          <WalletBadge
            address={TEST_ADDRESS}
            status="connected"
            onDisconnect={onDisconnect}
          />
        );
        const btn = screen.getByRole("button", { name: /disconnect wallet/i });
        fireEvent.click(btn);
        expect(onDisconnect).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ── 3. Desktop regression – existing behavior unchanged ──────────────────

  describe("desktop viewport rendering (regression)", () => {
    beforeEach(() => {
      // Standard desktop: 1280×800
      setViewport(1280, 800);
    });

    it("renders the wallet-badge element", () => {
      render(
        <WalletBadge address={TEST_ADDRESS} status="connected" />
      );
      expect(screen.getByTestId("wallet-badge")).toBeInTheDocument();
    });

    it("shows truncated address", () => {
      render(
        <WalletBadge address={TEST_ADDRESS} status="connected" />
      );
      expect(screen.getByTestId("wallet-badge")).toHaveTextContent("GBHK...R2S3");
    });

    it("renders disconnect button when onDisconnect is provided", () => {
      const onDisconnect = vi.fn();
      render(
        <WalletBadge
          address={TEST_ADDRESS}
          status="connected"
          onDisconnect={onDisconnect}
        />
      );
      expect(
        screen.getByRole("button", { name: /disconnect wallet/i })
      ).toBeInTheDocument();
    });

    it("does not render disconnect button when onDisconnect is omitted", () => {
      render(
        <WalletBadge address={TEST_ADDRESS} status="connected" />
      );
      expect(
        screen.queryByRole("button", { name: /disconnect wallet/i })
      ).not.toBeInTheDocument();
    });

    it("onDisconnect fires on click at desktop size", () => {
      const onDisconnect = vi.fn();
      render(
        <WalletBadge
          address={TEST_ADDRESS}
          status="connected"
          onDisconnect={onDisconnect}
        />
      );
      fireEvent.click(screen.getByRole("button", { name: /disconnect wallet/i }));
      expect(onDisconnect).toHaveBeenCalledTimes(1);
    });

    it("renders loading state", () => {
      render(<WalletBadge status="loading" />);
      const badge = screen.getByTestId("wallet-badge");
      expect(badge).toHaveAttribute("data-status", "loading");
      expect(badge).toHaveTextContent(/connecting/i);
    });

    it("renders error state with message", () => {
      render(
        <WalletBadge status="error" errorMessage="Failed to connect" />
      );
      const badge = screen.getByTestId("wallet-badge");
      expect(badge).toHaveAttribute("data-status", "error");
      expect(badge).toHaveTextContent("Failed to connect");
    });

    it("renders error state with fallback text when no errorMessage", () => {
      render(<WalletBadge status="error" />);
      expect(screen.getByTestId("wallet-badge")).toHaveTextContent(
        /wallet error/i
      );
    });

    it("renders disconnected state", () => {
      render(<WalletBadge status="disconnected" />);
      const badge = screen.getByTestId("wallet-badge");
      expect(badge).toHaveAttribute("data-status", "disconnected");
      expect(badge).toHaveTextContent(/no wallet/i);
    });
  });
});
