"use client";
import { useTheme } from "@/app/context/ThemeContext";

/**
 * DarkModeSwitcher — animated sun/moon toggle.
 *
 * Animations (defined in globals.css):
 *  - Icon swaps with a spin+scale pop (theme-icon-swap keyframe)
 *  - Button background pulses briefly on click (theme-btn-press keyframe)
 */
export default function DarkModeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      data-testid="dark-mode-switcher"
      // animate-theme-press re-triggers each click via key; we use CSS instead
      className={[
        "relative flex items-center justify-center",
        "w-9 h-9 rounded-lg",
        "bg-gray-800 hover:bg-gray-700",
        "dark:bg-gray-700 dark:hover:bg-gray-600",
        "border border-gray-700 dark:border-gray-600",
        "text-gray-300 hover:text-white dark:text-gray-200",
        "transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-indigo-400 focus-visible:ring-offset-2",
        "focus-visible:ring-offset-gray-950",
        "animate-theme-press",        // active:scale press defined in CSS
        "overflow-hidden",
      ].join(" ")}
    >
      {/* Icon container — spins + scales when theme changes */}
      <span
        key={theme}                    // forces remount → restarts animation
        data-testid="theme-icon"
        aria-hidden="true"
        className="text-base leading-none animate-theme-icon-swap"
      >
        {isDark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}
