import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DarkModeSwitcher from "@/app/components/DarkModeSwitcher";

describe("DarkModeSwitcher - validation messages and alerts #314", () => {
  it("renders with aria-invalid=false and no error message when error is not provided", () => {
    render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
    const sw = screen.getByRole("switch");
    
    expect(sw).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders with aria-invalid=true and displays the error message when error is provided", () => {
    const errorMessage = "Invalid theme configuration selected";
    render(
      <DarkModeSwitcher
        isDarkMode={false}
        onToggle={vi.fn()}
        error={errorMessage}
        id="theme-test"
      />
    );
    const sw = screen.getByRole("switch");

    expect(sw).toHaveAttribute("aria-invalid", "true");
    const alertEl = screen.getByRole("alert");
    expect(alertEl).toBeInTheDocument();
    expect(alertEl).toHaveTextContent(errorMessage);
    expect(alertEl).toHaveAttribute("id", "theme-test-error");
    expect(sw).toHaveAttribute("aria-describedby", "theme-test-error");
  });

  it("applies border-red-500 styling to the button when error is present", () => {
    render(
      <DarkModeSwitcher
        isDarkMode={false}
        onToggle={vi.fn()}
        error="Validation Error"
      />
    );
    const sw = screen.getByRole("switch");
    expect(sw.className).toContain("border-red-500");
    expect(sw.className).not.toContain("border-border-subtle");
  });

  it("renders default border-border-subtle styling when error is absent", () => {
    render(<DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />);
    const sw = screen.getByRole("switch");
    expect(sw.className).toContain("border-border-subtle");
    expect(sw.className).not.toContain("border-red-500");
  });

  it("toggles error elements dynamically when error state changes", () => {
    const { rerender } = render(
      <DarkModeSwitcher isDarkMode={false} onToggle={vi.fn()} />
    );
    
    // Initially no error
    expect(screen.getByRole("switch")).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // Rerender with an error
    rerender(
      <DarkModeSwitcher
        isDarkMode={false}
        onToggle={vi.fn()}
        error="Theme is corrupted"
        id="theme-toggle"
      />
    );
    
    expect(screen.getByRole("switch")).toHaveAttribute("aria-invalid", "true");
    const alertEl = screen.getByRole("alert");
    expect(alertEl).toBeInTheDocument();
    expect(alertEl).toHaveTextContent("Theme is corrupted");
    expect(screen.getByRole("switch")).toHaveAttribute("aria-describedby", "theme-toggle-error");

    // Rerender with error cleared
    rerender(
      <DarkModeSwitcher
        isDarkMode={false}
        onToggle={vi.fn()}
        error=""
        id="theme-toggle"
      />
    );
    
    expect(screen.getByRole("switch")).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("switch")).not.toHaveAttribute("aria-describedby");
  });

  it("combines custom ariaDescribedBy with errorId on describedby attribute", () => {
    render(
      <DarkModeSwitcher
        isDarkMode={false}
        onToggle={vi.fn()}
        error="Configuration invalid"
        id="theme-element"
        ariaDescribedBy="external-description-id"
      />
    );
    const sw = screen.getByRole("switch");
    expect(sw).toHaveAttribute(
      "aria-describedby",
      "external-description-id theme-element-error"
    );
  });
});
