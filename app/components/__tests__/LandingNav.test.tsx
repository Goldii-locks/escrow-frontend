/**
 * LandingNav regression tests.
 *
 * LandingNav is the public marketing nav and matches design/landing-reference.html:
 * logo, network badge, four links, one CTA. The notification bell and the wallet
 * controls moved to Navbar (see Navbar.test.tsx) because they belong to the
 * signed-in app, not to a marketing page. The negative assertions below exist so
 * a future merge cannot quietly put them back.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LandingNav from "../LandingNav";

vi.mock("@/app/lib/contract", () => ({
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
}));

describe("LandingNav is marketing chrome only", () => {
  it("renders the brand lockup and the network badge", () => {
    render(<LandingNav />);
    expect(screen.getByRole("link", { name: "Milestone home" })).toHaveAttribute("href", "/");
    expect(screen.getByText("TESTNET")).toBeInTheDocument();
  });

  it("renders the four reference marketing links", () => {
    render(<LandingNav />);
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute(
      "href",
      "#how-it-works",
    );
    expect(screen.getByRole("link", { name: "Product" })).toHaveAttribute("href", "#product");
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute("href", "#security");
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/Goldii-locks",
    );
  });

  it("Launch App points at /dashboard", () => {
    render(<LandingNav />);
    const links = screen.getAllByRole("link", { name: /launch app/i });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/dashboard");
  });

  it("the marketing menu button is a real button with expanded state", () => {
    render(<LandingNav />);
    const menu = screen.getByRole("button", { name: /open menu/i });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menu);
    expect(screen.getByRole("button", { name: /close menu/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("does not mount the notification bell", () => {
    render(<LandingNav />);
    expect(screen.queryByRole("button", { name: /notification/i })).toBeNull();
  });

  it("does not mount the wallet selector or Connect Wallet", () => {
    render(<LandingNav />);
    expect(screen.queryByRole("combobox", { name: "Wallet provider" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Connect Wallet" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Disconnect" })).toBeNull();
  });
});
