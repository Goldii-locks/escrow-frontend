import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import DarkModeSwitcher, {
  DarkModeSwitcherEmptyState,
  type DarkModeSwitcherProps,
} from "@/app/components/DarkModeSwitcher";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderSwitcher(props: DarkModeSwitcherProps = {}) {
  return render(<DarkModeSwitcher {...props} />);
}

// ---------------------------------------------------------------------------
// Empty state (isDarkMode is null / undefined)
// ---------------------------------------------------------------------------

describe("DarkModeSwitcher — empty state", () => {
  it("renders empty state when isDarkMode is undefined", () => {
    renderSwitcher();
    expect(screen.getByTestId("dark-mode-switcher-empty-state")).toBeInTheDocument();
  });

  it("renders empty state when isDarkMode is null", () => {
    renderSwitcher({ isDarkMode: null });
    expect(screen.getByTestId("dark-mode-switcher-empty-state")).toBeInTheDocument();
  });

  it("does NOT render the toggle button in empty state", () => {
    renderSwitcher();
    expect(screen.queryByTestId("dark-mode-switcher")).not.toBeInTheDocument();
  });

  it("empty state has role=region", () => {
    renderSwitcher();
    expect(screen.getByTestId("dark-mode-switcher-empty-state")).toHaveAttribute(
      "role",
      "region"
    );
  });

  it("empty state has descriptive aria-label", () => {
    renderSwitcher();
    expect(screen.getByTestId("dark-mode-switcher-empty-state")).toHaveAttribute(
      "aria-label",
      "No theme preferences"
    );
  });

  it("DarkModeSwitcherEmptyState renders standalone", () => {
    render(<DarkModeSwitcherEmptyState />);
    expect(screen.getByTestId("dark-mode-switcher-empty-state")).toBeInTheDocument();
  });

  it("DarkModeSwitcherEmptyState accepts className", () => {
    render(<DarkModeSwitcherEmptyState className="mt-4" />);
    expect(screen.getByTestId("dark-mode-switcher-empty-state").className).toContain("mt-4");
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe("DarkModeSwitcher — loading state", () => {
  it("renders loading state when loading=true", () => {
    renderSwitcher({ loading: true });
    expect(screen.getByTestId("dark-mode-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("dark-mode-switcher")).toHaveAttribute("data-state", "loading");
  });

  it("loading state has role=status", () => {
    renderSwitcher({ loading: true });
    expect(screen.getByTestId("dark-mode-switcher")).toHaveAttribute("role", "status");
  });

  it("loading state has aria-label 'Loading theme'", () => {
    renderSwitcher({ loading: true });
    expect(screen.getByTestId("dark-mode-switcher")).toHaveAttribute(
      "aria-label",
      "Loading theme"
    );
  });

  it("loading state shows loading text", () => {
    renderSwitcher({ loading: true });
    expect(screen.getByTestId("dark-mode-switcher")).toHaveTextContent("Loading theme...");
  });

  it("loading overrides the empty state — renders switcher not empty state", () => {
    renderSwitcher({ loading: true, isDarkMode: undefined });
    expect(screen.queryByTestId("dark-mode-switcher-empty-state")).not.toBeInTheDocument();
    expect(screen.getByTestId("dark-mode-switcher")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Toggle — dark mode on
// ---------------------------------------------------------------------------

describe("DarkModeSwitcher — dark mode active", () => {
  it("renders the toggle button", () => {
    renderSwitcher({ isDarkMode: true });
    expect(screen.getByTestId("dark-mode-switcher")).toBeInTheDocument();
  });

  it("has role=switch", () => {
    renderSwitcher({ isDarkMode: true });
    expect(screen.getByTestId("dark-mode-switcher")).toHaveAttribute("role", "switch");
  });

  it("has aria-checked=true when dark", () => {
    renderSwitcher({ isDarkMode: true });
    expect(screen.getByTestId("dark-mode-switcher")).toHaveAttribute("aria-checked", "true");
  });

  it("has data-state=dark", () => {
    renderSwitcher({ isDarkMode: true });
    expect(screen.getByTestId("dark-mode-switcher")).toHaveAttribute("data-state", "dark");
  });

  it("defaults aria-label to 'Switch to light mode' when dark", () => {
    renderSwitcher({ isDarkMode: true });
    expect(screen.getByTestId("dark-mode-switcher")).toHaveAttribute(
      "aria-label",
      "Switch to light mode"
    );
  });

  it("thumb is translated right when dark", () => {
    renderSwitcher({ isDarkMode: true });
    expect(screen.getByTestId("dark-mode-switcher-thumb")).toHaveClass("translate-x-5");
  });
});

// ---------------------------------------------------------------------------
// Toggle — light mode
// ---------------------------------------------------------------------------

describe("DarkModeSwitcher — light mode active", () => {
  it("has aria-checked=false when light", () => {
    renderSwitcher({ isDarkMode: false });
    expect(screen.getByTestId("dark-mode-switcher")).toHaveAttribute("aria-checked", "false");
  });

  it("has data-state=light", () => {
    renderSwitcher({ isDarkMode: false });
    expect(screen.getByTestId("dark-mode-switcher")).toHaveAttribute("data-state", "light");
  });

  it("defaults aria-label to 'Switch to dark mode' when light", () => {
    renderSwitcher({ isDarkMode: false });
    expect(screen.getByTestId("dark-mode-switcher")).toHaveAttribute(
      "aria-label",
      "Switch to dark mode"
    );
  });

  it("thumb is at translate-x-0 when light", () => {
    renderSwitcher({ isDarkMode: false });
    expect(screen.getByTestId("dark-mode-switcher-thumb")).toHaveClass("translate-x-0");
  });
});

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

describe("DarkModeSwitcher — interactions", () => {
  it("calls onToggle on click", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    renderSwitcher({ isDarkMode: true, onToggle });
    await user.click(screen.getByTestId("dark-mode-switcher"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("calls onToggle on Space key", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    renderSwitcher({ isDarkMode: false, onToggle });
    screen.getByTestId("dark-mode-switcher").focus();
    await user.keyboard(" ");
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("calls onToggle on Enter key", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    renderSwitcher({ isDarkMode: false, onToggle });
    screen.getByTestId("dark-mode-switcher").focus();
    await user.keyboard("{Enter}");
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onToggle when disabled", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    renderSwitcher({ isDarkMode: true, onToggle, disabled: true });
    await user.click(screen.getByTestId("dark-mode-switcher"));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("does NOT call onToggle when loading", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    renderSwitcher({ loading: true, onToggle });
    // loading state is a span, not a button — no click interaction
    expect(onToggle).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

describe("DarkModeSwitcher — props", () => {
  it("accepts a custom ariaLabel", () => {
    renderSwitcher({ isDarkMode: true, ariaLabel: "Toggle theme" });
    expect(screen.getByTestId("dark-mode-switcher")).toHaveAttribute(
      "aria-label",
      "Toggle theme"
    );
  });

  it("accepts a custom id", () => {
    renderSwitcher({ isDarkMode: false, id: "my-switcher" });
    expect(screen.getByTestId("dark-mode-switcher")).toHaveAttribute("id", "my-switcher");
  });

  it("applies custom className to the button", () => {
    renderSwitcher({ isDarkMode: false, className: "mt-4" });
    expect(screen.getByTestId("dark-mode-switcher").className).toContain("mt-4");
  });

  it("disabled button has aria-disabled=true", () => {
    renderSwitcher({ isDarkMode: true, disabled: true });
    expect(screen.getByTestId("dark-mode-switcher")).toHaveAttribute("aria-disabled", "true");
  });

  it("disabled button has tabIndex=-1", () => {
    renderSwitcher({ isDarkMode: false, disabled: true });
    expect(screen.getByTestId("dark-mode-switcher")).toHaveAttribute("tabindex", "-1");
  });
});
