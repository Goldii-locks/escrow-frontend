"use client";

import { useState } from "react";
import ButtonSpinner from "./ButtonSpinner";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type?: "info" | "success" | "warning" | "error";
}

export interface NotificationBellProps {
  unreadCount?: number;
  hasUnread?: boolean;
  isOpen?: boolean;
  isLoading?: boolean;
  error?: string | null;
  notifications?: NotificationItem[];
  onBellClick?: () => void;
  onMarkAllAsRead?: () => void;
  onNotificationClick?: (notification: NotificationItem) => void;
  onClearAll?: () => void;
  disabled?: boolean;
  className?: string;

  // Older call sites (Navbar, and the suite that came with them) drive this
  // component with a plain count and click handler. Kept as aliases so both
  // shapes work rather than forcing one of them to be rewritten.
  /** Alias of `unreadCount`. */
  count?: number;
  /** Alias of `onBellClick`. */
  onClick?: () => void;
  /** Overrides the derived button label. */
  ariaLabel?: string;
}

/**
 * Formats unread count for badge display (e.g., 99+ for high values).
 */
function formatUnreadBadge(count: number): string {
  if (count > 99) return "99+";
  return count.toString();
}

/**
 * Navbar alert bell badge and notification center component.
 * Supports zero unread, unread badge counters, open dropdown with list,
 * loading state, error state, and accessibility attributes.
 */
export default function NotificationBell({
  unreadCount,
  hasUnread,
  isOpen: controlledIsOpen,
  isLoading = false,
  error = null,
  notifications = [],
  onBellClick,
  onMarkAllAsRead,
  onNotificationClick,
  onClearAll,
  disabled = false,
  className = "",
  count,
  onClick,
  ariaLabel,
}: NotificationBellProps) {
  const resolvedUnreadCount = unreadCount ?? count ?? 0;
  const resolvedBellClick = onBellClick ?? onClick;
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  // Allow component to function as controlled or uncontrolled
  const isDropdownOpen = controlledIsOpen ?? internalIsOpen;

  const showUnreadDotOrBadge =
    (hasUnread !== undefined ? hasUnread : resolvedUnreadCount > 0) ||
    resolvedUnreadCount > 0;

  const handleToggle = () => {
    if (disabled) return;
    if (resolvedBellClick) {
      resolvedBellClick();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
  };

  const computeStatusAttr = () => {
    if (disabled) return "disabled";
    if (isLoading) return "loading";
    if (error) return "error";
    if (showUnreadDotOrBadge) return "unread";
    return "read";
  };

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page";

  return (
    <div
      className={`relative inline-block ${className}`}
      data-testid="notification-bell-container"
    >
      <button
        type="button"
        data-testid="notification-bell"
        data-status={computeStatusAttr()}
        data-unread-count={resolvedUnreadCount}
        onClick={handleToggle}
        disabled={disabled}
        aria-label={
          ariaLabel ??
          (resolvedUnreadCount > 0
            ? `Notifications (${resolvedUnreadCount} unread)`
            : "Notifications")
        }
        aria-expanded={isDropdownOpen}
        aria-haspopup="true"
        aria-live="polite"
        className={`relative p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-field transition ${focusRing} ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        } ${className}`}
      >
        {/* Bell Icon SVG */}
        <svg
          className="w-6 h-6 text-text-secondary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Count Badge or Dot */}
        {showUnreadDotOrBadge && !disabled && (
          <span
            data-testid="notification-badge"
            aria-label={
              resolvedUnreadCount > 0
                ? `${resolvedUnreadCount} unread notifications`
                : undefined
            }
            className={`absolute -top-1 -right-1 flex items-center justify-center rounded-full border-2 border-surface-page bg-accent text-white text-xs font-bold ${
              resolvedUnreadCount > 0
                ? "min-w-[1.25rem] h-5 px-1 font-mono"
                : "w-3 h-3 animate-pulse"
            }`}
          >
            {resolvedUnreadCount > 0 ? formatUnreadBadge(resolvedUnreadCount) : ""}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isDropdownOpen && !disabled && (
        <div
          data-testid="notification-dropdown"
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-950/60">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">Notifications</h3>
              {resolvedUnreadCount > 0 && (
                <span className="text-xs bg-indigo-950 text-indigo-300 font-mono px-2 py-0.5 rounded-full border border-indigo-800">
                  {resolvedUnreadCount} new
                </span>
              )}
            </div>
            {onMarkAllAsRead && resolvedUnreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition focus-visible:outline-none"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Body Content */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-800/60">
            {isLoading ? (
              <div
                data-testid="notification-loading"
                className="px-4 py-6 text-center text-sm text-gray-400 flex items-center justify-center gap-2"
              >
                <ButtonSpinner className="h-4 w-4" />
                <span>Loading notifications…</span>
              </div>
            ) : error ? (
              <div
                data-testid="notification-error"
                className="p-4 bg-red-950/30 border-l-4 border-red-500 text-red-300 text-xs flex items-start gap-2"
              >
                <span aria-hidden="true" className="text-red-400 text-sm">
                  ⚠️
                </span>
                <div>
                  <p className="font-semibold text-red-200">Error</p>
                  <p>{error}</p>
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <div
                data-testid="notification-empty"
                className="px-4 py-8 text-center text-sm text-gray-500"
              >
                <p className="text-2xl mb-1">🔔</p>
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  data-testid={`notification-item-${item.id}`}
                  data-read={item.read}
                  onClick={() => onNotificationClick?.(item)}
                  className={`px-4 py-3 hover:bg-gray-800/50 transition cursor-pointer flex items-start justify-between gap-3 ${
                    !item.read ? "bg-indigo-950/20" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-xs font-medium truncate ${
                          !item.read ? "text-white" : "text-gray-300"
                        }`}
                      >
                        {item.title}
                      </p>
                      {!item.read && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0"
                          aria-label="Unread"
                        />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">
                      {item.message}
                    </p>
                    <p className="text-[10px] text-gray-500 font-mono mt-1">
                      {item.timestamp}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {onClearAll && notifications.length > 0 && !isLoading && !error && (
            <div className="px-4 py-2 border-t border-gray-800 bg-gray-950/40 text-right">
              <button
                type="button"
                onClick={onClearAll}
                className="text-xs text-gray-400 hover:text-gray-200 transition"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
