import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, vi } from "vitest";
import DarkModeSwitcher from "@/app/components/DarkModeSwitcher";
import { ThemeProvider, useTheme } from "@/app/context/ThemeContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWithTheme(ui: React.ReactNode) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

// Expose current theme for assertions
function ThemeDisplay() {
  const { theme } = useTheme();
  return <span data-testid="current-theme">{theme}</span>;
}

// ---------------------------------------------------------------------------
// localStorage mock (jsdom resets between tests via beforeEach)
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  // Reset <html> classes
  document.documentElement.classList.remove("dark", "light");
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// ThemeContext
// ---------------------------------------------------------------------------

describe("ThemeContext", () => {
  it("defaults to dark when no localStorage value and no system preference", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);

    renderWithTheme(<ThemeDisplay />);
    expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
  });

  it("defaults to dark when system prefers dark", () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);

    renderWithTheme(<ThemeDisplay />);
    expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
  });

  it("restores theme from localStorage", () => {
    localStorage.setItem("theme", "light");
    renderWithTheme(<ThemeDisplay />);
    expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
  });

  it("adds .dark class to <html> when theme is dark", () => {
    localStorage.setItem("theme", "dark");
    renderWithTheme(<ThemeDisplay />);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes .dark class from <html> when theme is light", () => {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "light");
    renderWithTheme(<ThemeDisplay />);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("persists toggled theme to localStorage", async () => {
    localStorage.setItem("theme", "dark");
    const user = userEvent.setup();
    renderWithTheme(<DarkModeSwitcher />);
    await user.click(screen.getByTestId("dark-mode-switcher"));
    expect(localStorage.getItem("theme")).toBe("light");
  });
});

// ---------------------------------------------------------------------------
// DarkModeSwitcher rendering
// ---------------------------------------------------------------------------

describe("DarkModeSwitcher rendering", () => {
  it("renders the button", () => {
    renderWithTheme(<DarkModeSwitcher />);
    expect(screen.getByTestId("dark-mode-switcher")).toBeInTheDocument();
  });

  it("shows moon icon when dark", () => {
    localStorage.setItem("theme", "dark");
    renderWithTheme(<DarkModeSwitcher />);
    expect(screen.getByTestId("theme-icon")).toHaveTextContent("🌙");
  });

  it("shows sun icon when light", () => {
    localStorage.setItem("theme", "light");
    renderWithTheme(<DarkModeSwitcher />);
    expect(screen.getByTestId("theme-icon")).toHaveTextContent("☀️");
  });

  it("has correct aria-label when dark", () => {
    localStorage.setItem("theme", "dark");
    renderWithTheme(<DarkModeSwitcher />);
    expect(screen.getByTestId("dark-mode-switcher")).toHaveAttribute(
      "aria-label",
      "Switch to light mode"
    );
  });

  it("has correct aria-label when light", () => {
    localStorage.setItem("theme", "light");
    renderWithTheme(<DarkModeSwitcher />);
    expect(screen.getByTestId("dark-mode-switcher")).toHaveAttribute(
      "aria-label",
      "Switch to dark mode"
    );
  });

  it("has aria-pressed=true when dark", () => {
    localStorage.setItem("theme", "dark");
    renderWithTheme(<DarkModeSwitcher />);
    expect(screen.getByTestId("dark-mode-switcher")).toHaveAttribute("aria-pressed", "true");
  });

  it("has aria-pressed=false when light", () => {
    localStorage.setItem("theme", "light");
    renderWithTheme(<DarkModeSwitcher />);
    expect(screen.getByTestId("dark-mode-switcher")).toHaveAttribute("aria-pressed", "false");
  });
});

// ---------------------------------------------------------------------------
// DarkModeSwitcher interactions
// ---------------------------------------------------------------------------

describe("DarkModeSwitcher interactions", () => {
  it("toggles from dark to light on click", async () => {
    localStorage.setItem("theme", "dark");
    const user = userEvent.setup();
    renderWithTheme(
      <>
        <DarkModeSwitcher />
        <ThemeDisplay />
      </>
    );
    expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    await user.click(screen.getByTestId("dark-mode-switcher"));
    expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
  });

  it("toggles from light to dark on click", async () => {
    localStorage.setItem("theme", "light");
    const user = userEvent.setup();
    renderWithTheme(
      <>
        <DarkModeSwitcher />
        <ThemeDisplay />
      </>
    );
    await user.click(screen.getByTestId("dark-mode-switcher"));
    expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
  });

  it("swaps icon after toggle (key remount triggers animation)", async () => {
    localStorage.setItem("theme", "dark");
    const user = userEvent.setup();
    renderWithTheme(<DarkModeSwitcher />);
    expect(screen.getByTestId("theme-icon")).toHaveTextContent("🌙");
    await user.click(screen.getByTestId("dark-mode-switcher"));
    expect(screen.getByTestId("theme-icon")).toHaveTextContent("☀️");
  });

  it("icon container has animation class for swap", () => {
    localStorage.setItem("theme", "dark");
    renderWithTheme(<DarkModeSwitcher />);
    expect(screen.getByTestId("theme-icon")).toHaveClass("animate-theme-icon-swap");
  });

  it("button has animation class for press", () => {
    renderWithTheme(<DarkModeSwitcher />);
    expect(screen.getByTestId("dark-mode-switcher")).toHaveClass("animate-theme-press");
  });

  it("toggles multiple times correctly", async () => {
    localStorage.setItem("theme", "dark");
    const user = userEvent.setup();
    renderWithTheme(
      <>
        <DarkModeSwitcher />
        <ThemeDisplay />
      </>
    );
    await user.click(screen.getByTestId("dark-mode-switcher"));
    expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
    await user.click(screen.getByTestId("dark-mode-switcher"));
    expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    await user.click(screen.getByTestId("dark-mode-switcher"));
    expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
  });

  it("is keyboard activatable", async () => {
    localStorage.setItem("theme", "dark");
    const user = userEvent.setup();
    renderWithTheme(
      <>
        <DarkModeSwitcher />
        <ThemeDisplay />
      </>
    );
    screen.getByTestId("dark-mode-switcher").focus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
  });
});
