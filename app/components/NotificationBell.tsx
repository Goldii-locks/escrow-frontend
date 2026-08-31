"use client";

export interface NotificationBellProps {
  count?: number;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
}

/**
 * Displays a notification bell icon with an optional badge count.
 * Uses the repository's canonical design tokens for all colors,
 * spacing, and typography.
 */
export default function NotificationBell({
  count = 0,
  className = "",
  onClick,
  ariaLabel = "Notifications",
}: NotificationBellProps) {
  const hasNotifications = count > 0;
  const displayCount = count > 99 ? "99+" : String(count);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center justify-center p-2 rounded-lg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page hover:bg-surface-field ${className}`}
      aria-label={ariaLabel}
      aria-live="polite"
    >
      {/* Bell icon */}
      <svg
        className="h-6 w-6 text-text-secondary"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>

      {/* Badge */}
      {hasNotifications && (
        <span
          className="absolute -top-1 -right-1 inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-accent text-white text-xs font-medium border-2 border-surface-page"
          aria-label={`${count} unread notifications`}
        >
          {displayCount}
        </span>
      )}
    </button>
  );
}
