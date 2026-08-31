"use client";

import ButtonSpinner from "./ButtonSpinner";

export interface DarkModeSwitcherProps {
  /** Current theme state: true = dark, false = light, null/undefined = empty/no data */
  isDarkMode?: boolean | null;
  /** Toggle handler */
  onToggle?: () => void;
  /** Whether the switch is disabled */
  disabled?: boolean;
  /** Loading state - shows spinner */
  loading?: boolean;
  /** Optional id for the control */
  id?: string;
  /** Additional className */
  className?: string;
  /** Accessible label override */
  ariaLabel?: string;
}

/**
 * Empty state view for DarkModeSwitcher.
 * Displayed when theme data is unavailable (isDarkMode is null/undefined).
 * Uses design tokens and is fully accessible.
 */
export function DarkModeSwitcherEmptyState({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      data-testid="dark-mode-switcher-empty-state"
      role="region"
      aria-label="No theme preferences"
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface-card p-6 text-center ${className}`}
    >
      <div
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-field border border-border-subtle text-text-muted text-lg"
      >
        &#9790;
      </div>
      <p className="text-sm font-semibold text-text-primary">
        No theme preferences available
      </p>
      <p className="max-w-xs text-xs text-text-muted">
        Theme data is empty. Once theme preferences are configured, the
        dark/light toggle will appear here. You can still browse in the default
        light theme.
      </p>
      <span
        aria-hidden="true"
        className="mt-1 text-xs px-2 py-1 rounded-full border border-border-subtle bg-surface-field text-text-muted"
      >
        Waiting for theme data
      </span>
    </div>
  );
}

export default function DarkModeSwitcher({
  isDarkMode,
  onToggle,
  disabled = false,
  loading = false,
  id,
  className = "",
  ariaLabel,
}: DarkModeSwitcherProps) {
  const checked = Boolean(isDarkMode);
  const isEmpty = isDarkMode === null || isDarkMode === undefined;
  const isDisabled = disabled || loading;

  // Empty state - descriptive placeholder when no data
  if (isEmpty && !loading) {
    return <DarkModeSwitcherEmptyState className={className} />;
  }

  // Loading state
  if (loading) {
    return (
      <span
        data-testid="dark-mode-switcher"
        data-state="loading"
        role="status"
        aria-live="polite"
        aria-label="Loading theme"
        className={`inline-flex items-center gap-2 rounded-full border border-border-subtle bg-surface-field px-3 py-1.5 text-sm text-text-muted ${className}`}
      >
        <ButtonSpinner className="h-3.5 w-3.5" />
        <span>Loading theme...</span>
      </span>
    );
  }

  const label = ariaLabel ?? (checked ? "Switch to light mode" : "Switch to dark mode");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (isDisabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onToggle?.();
    }
  };

  const handleClick = () => {
    if (isDisabled) return;
    onToggle?.();
  };

  return (
    <button
      id={id}
      data-testid="dark-mode-switcher"
      data-state={checked ? "dark" : "light"}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={isDisabled}
      disabled={isDisabled}
      tabIndex={isDisabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={[
        // base layout
        "relative inline-flex h-7 w-12 items-center rounded-full p-1",
        // transition & cursor
        "transition-colors duration-200 ease-in-out",
        "cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
        // colors - accessible contrast using design tokens
        checked
          ? "bg-accent hover:bg-accent-hover"
          : "bg-surface-field border border-border-subtle hover:bg-surface-field/80",
        // focus-visible premium ring
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page",
        // hover / focus tokens
        "hover:shadow-sm focus-visible:shadow-md",
        className,
      ].join(" ")}
    >
      <span className="sr-only">{label}</span>
      <span
        aria-hidden="true"
        data-testid="dark-mode-switcher-thumb"
        className={[
          "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm",
          "transition-transform duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0",
          "ring-0",
        ].join(" ")}
      />
      {/* Decorative icons - hidden from AT */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-1.5 text-[10px] leading-none transition-opacity duration-200 ${checked ? "opacity-60 text-white" : "opacity-0"}`}
      >
        &#9790;
      </span>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute right-1.5 text-[10px] leading-none transition-opacity duration-200 ${checked ? "opacity-0" : "opacity-60 text-text-muted"}`}
      >
        &#9788;
      </span>
    </button>
  );
}
