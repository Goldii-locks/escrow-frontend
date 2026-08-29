"use client";
import { useState, useEffect, useRef } from "react";
import { useNotifications, type NotificationType } from "@/app/context/NotificationContext";

const TYPE_STYLES: Record<NotificationType, string> = {
  success: "text-success-soft",
  error:   "text-danger-soft",
  warning: "text-warning-soft",
  info:    "text-info-soft",
};

const TYPE_ICONS: Record<NotificationType, string> = {
  success: "✓",
  error:   "✕",
  warning: "⚠",
  info:    "ℹ",
};

/**
 * NotificationBell — animated navbar alert bell.
 *
 * Animations (globals.css):
 *  - bell-ring   : rocks the bell when a new notification arrives
 *  - badge-pop   : scale-spring when the unread badge first appears
 *  - bell-press  : quick press-down on click
 *  - panel-slide : dropdown slides in from above
 */
export default function NotificationBell() {
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();
  const [open, setOpen]         = useState(false);
  const [ringing, setRinging]   = useState(false);
  const [pressing, setPressing] = useState(false);
  const prevUnread              = useRef(unreadCount);
  const panelRef                = useRef<HTMLDivElement>(null);
  const buttonRef               = useRef<HTMLButtonElement>(null);

  // Ring the bell whenever a new unread notification arrives
  useEffect(() => {
    if (unreadCount > prevUnread.current) {
      setRinging(true);
    }
    prevUnread.current = unreadCount;
  }, [unreadCount]);

  // Close the panel on outside click
  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  // Attach animationend via DOM ref to avoid JSX synthetic event typing issues
  useEffect(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    function onAnimEnd(e: AnimationEvent) {
      if (e.animationName === "bell-ring")  setRinging(false);
      if (e.animationName === "bell-press") setPressing(false);
    }
    btn.addEventListener("animationend", onAnimEnd);
    return () => btn.removeEventListener("animationend", onAnimEnd);
  });

  function handleToggle() {
    setPressing(true);
    setOpen((was: boolean) => {
      const next = !was;
      if (next) markAllRead();
      return next;
    });
  }

  return (
    <div className="relative" data-testid="notification-bell-root">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-haspopup="true"
        aria-expanded={open}
        data-testid="notification-bell-btn"
        className={[
          "relative flex items-center justify-center",
          "w-9 h-9 rounded-lg",
          "bg-gray-800 hover:bg-gray-700",
          "border border-gray-700",
          "text-gray-300 hover:text-white",
          "transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-indigo-400 focus-visible:ring-offset-2",
          "focus-visible:ring-offset-gray-950",
          "overflow-visible",
          ringing  ? "animate-bell-ring"  : "",
          pressing ? "animate-bell-press" : "",
        ].filter(Boolean).join(" ")}
      >
        <span aria-hidden="true" className="text-base leading-none select-none">
          🔔
        </span>

        {unreadCount > 0 && (
          <span
            key={unreadCount}
            data-testid="notification-badge"
            aria-hidden="true"
            className={[
              "absolute -top-1.5 -right-1.5",
              "min-w-[1.1rem] h-[1.1rem] px-0.5",
              "flex items-center justify-center",
              "rounded-full text-[0.6rem] font-bold leading-none",
              "bg-danger-soft text-gray-950",
              "animate-badge-pop",
            ].join(" ")}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          data-testid="notification-panel"
          role="dialog"
          aria-label="Notifications"
          className={[
            "absolute right-0 mt-2 w-80",
            "bg-gray-900 border border-gray-700 rounded-xl shadow-xl",
            "z-50 overflow-hidden",
            "animate-panel-slide",
          ].join(" ")}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <span className="text-sm font-semibold text-text-primary">
              Notifications
            </span>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                data-testid="notification-clear-btn"
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          <ul
            className="max-h-72 overflow-y-auto divide-y divide-gray-800"
            aria-label="Notification list"
          >
            {notifications.length === 0 ? (
              <li
                className="px-4 py-6 text-sm text-text-muted text-center"
                data-testid="notification-empty"
              >
                No notifications
              </li>
            ) : (
              notifications.map((n) => (
                <li
                  key={n.id}
                  data-testid="notification-item"
                  className="flex items-start gap-3 px-4 py-3 animate-fade-in"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 text-sm font-bold ${TYPE_STYLES[n.type]}`}
                  >
                    {TYPE_ICONS[n.type]}
                  </span>
                  <span className="text-sm text-text-secondary flex-1 break-words">
                    {n.message}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
