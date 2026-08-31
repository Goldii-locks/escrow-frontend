/**
 * Unit tests for `dark_mode_switcher` (App dark/light theme toggle).
 *
 * Verifies correct node rendering and behavior:
 *  - renders as `role="switch"` with an accessible name
 *  - exposes the current state via `aria-checked`
 *  - toggles theme (and the document root class) on activation
 *  - toggles the accessible label to announce the next state
 *  - keyboard operable (Enter / Space activate the switch)
 *  - persists the chosen theme to localStorage
 *  - restores a persisted theme and reflects it in `aria-checked`
 *  - honors the OS color-scheme preference when nothing is stored
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DarkModeSwitcher from "@/app/components/dark_mode_switcher";

function clearTheme() {
  window.localStorage.removeItem("escrow-theme");
}

describe("dark_mode_switcher — node rendering", () => {
  beforeEach(() => {
    clearTheme();
  });

  it("renders a switch with an accessible name", () => {
    render(<DarkModeSwitcher />);
    expect(
      screen.getByRole("switch", { name: "Switch to dark mode" })
    ).toBeInTheDocument();
  });

  it("renders a single interactive control", () => {
    render(<DarkModeSwitcher />);
    expect(screen.getAllByRole("switch")).toHaveLength(1);
  });

  it("defaults to dark when the OS prefers dark and nothing is stored", () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never;
    try {
      render(<DarkModeSwitcher />);
      expect(
        screen.getByRole("switch", { name: "Switch to light mode" })
      ).toBeInTheDocument();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});

describe("dark_mode_switcher — aria state", () => {
  beforeEach(() => {
    clearTheme();
  });

  it("exposes the current theme via aria-checked", () => {
    render(<DarkModeSwitcher />);
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("flips aria-checked when toggled", () => {
    render(<DarkModeSwitcher />);
    const sw = screen.getByRole("switch");
    fireEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("updates its accessible label to announce the next mode after toggling", () => {
    render(<DarkModeSwitcher />);
    const sw = screen.getByRole("switch");
    fireEvent.click(sw);
    expect(
      screen.getByRole("switch", { name: "Switch to light mode" })
    ).toBeInTheDocument();
  });
});

describe("dark_mode_switcher — theme application", () => {
  beforeEach(() => {
    clearTheme();
    document.documentElement.classList.remove("dark");
    delete document.documentElement.dataset.theme;
  });

  it("applies the 'dark' class to the document root when enabled", async () => {
    render(<DarkModeSwitcher />);
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(true)
    );
  });

  it("removes the 'dark' class when toggled back off", async () => {
    render(<DarkModeSwitcher />);
    const sw = screen.getByRole("switch");
    fireEvent.click(sw);
    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(true)
    );
    fireEvent.click(sw);
    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(false)
    );
  });

  it("sets the data-theme attribute on the root", async () => {
    render(<DarkModeSwitcher />);
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("dark")
    );
  });
});

describe("dark_mode_switcher — keyboard operation", () => {
  beforeEach(() => {
    clearTheme();
  });

  it("activates the switch with the Enter key", () => {
    render(<DarkModeSwitcher />);
    const sw = screen.getByRole("switch");
    // A native button activation with Enter dispatches a click event.
    fireEvent.keyDown(sw, { key: "Enter" });
    fireEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("activates the switch with the Space key", () => {
    render(<DarkModeSwitcher />);
    const sw = screen.getByRole("switch");
    // A native button activation with Space dispatches a click event.
    fireEvent.keyDown(sw, { key: " " });
    fireEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });
});

describe("dark_mode_switcher — persistence", () => {
  beforeEach(() => {
    clearTheme();
  });

  it("persists the chosen theme to localStorage", async () => {
    render(<DarkModeSwitcher />);
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() =>
      expect(window.localStorage.getItem("escrow-theme")).toBe("dark")
    );
  });

  it("restores a persisted theme and reflects it in aria-checked", () => {
    window.localStorage.setItem("escrow-theme", "dark");
    render(<DarkModeSwitcher />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("switch", { name: "Switch to light mode" })
    ).toBeInTheDocument();
  });
});
