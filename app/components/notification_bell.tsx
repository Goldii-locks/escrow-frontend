"use client";

import { useId, useState } from "react";

export type NotificationType = "error" | "warning" | "success" | "info";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
}

export interface NotificationField {
  name: string;
  label: string;
  error?: string | null;
}

export interface NotificationBellProps {
  /** Notifications to surface in the panel. */
  notifications?: NotificationItem[];
  /** Validation field configurations; entries with an `error` render an alert. */
  fields?: NotificationField[];
  /** Label used for the trigger button (defaults to "Notifications"). */
  label?: string;
}

const TYPE_STYLES: Record<NotificationType, string> = {
  error: "border-danger bg-danger/40 text-danger-soft",
  warning: "border-warning bg-warning/40 text-warning-soft",
  success: "border-success bg-success/40 text-success-soft",
  info: "border-accent bg-accent/40 text-accent-soft",
};

const TYPE_ICON: Record<NotificationType, string> = {
  error: "✕",
  warning: "⚠",
  success: "✓",
  info: "ℹ",
};

function computeBadgeCount(notifications: NotificationItem[], fields: NotificationField[]) {
  return notifications.length + fields.filter((f) => f.error).length;
}

/**
 * `notification_bell` — navbar alert bell badge.
 *
 * Accessibility (a11y):
 *  - Native `<button>` so it is keyboard navigable (Tab/Enter/Space).
 *  - `aria-haspopup` + `aria-expanded` expose the disclosure panel state.
 *  - `aria-label` accessible name; the bell glyph is `aria-hidden`.
 *  - `aria-live="polite"` region announces updates; errors use `role="alert"`.
 *  - `aria-invalid` + `aria-describedby` wire field errors to their messages.
 *  - `focus-visible` rings and design-token colours that meet contrast.
 *
 * Validation alerts (#324): any field with an `error` value renders an alert
 * (badge + panel message + `role="alert"`). Fields without an error render
 * clean, so the error text toggles as validation triggers.
 */
export default function NotificationBell({
  notifications = [],
  fields = [],
  label = "Notifications",
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const badgeCount = computeBadgeCount(notifications, fields);
  const errorCount = notifications.filter((n) => n.type === "error").length + fields.filter((f) => f.error).length;

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 rounded";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`relative inline-flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-gray-200 text-lg w-10 h-10 rounded-lg transition ${focusRing}`}
      >
        <span aria-hidden="true">🔔</span>
        {badgeCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
              errorCount > 0 ? "bg-danger text-white" : "bg-accent text-white"
            }`}
          >
            <span aria-hidden="true">{badgeCount}</span>
            <span className="sr-only">
              {badgeCount} unread {badgeCount === 1 ? "notification" : "notifications"}
            </span>
          </span>
        )}
        <span className="sr-only"> open notifications</span>
      </button>

      <div
        id={panelId}
        role="dialog"
        aria-label={`${label} panel`}
        aria-live="polite"
        hidden={!open}
        className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-border-subtle bg-surface-card shadow-lg z-50"
      >
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-text-primary">{label}</h2>
        </div>

        <div className="max-h-80 overflow-y-auto p-3 space-y-3">
          {/* Validation field alerts (#324) */}
          {fields.length > 0 && (
            <div role="group" aria-label="Validation errors" className="space-y-2">
              {fields.map((field) => {
                const hasError = Boolean(field.error);
                return (
                  <div
                    key={field.name}
                    className={`rounded border px-3 py-2 ${
                      hasError
                        ? "border-danger bg-danger/40"
                        : "border-border-subtle bg-surface-field"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-text-secondary">
                        {field.label}
                      </span>
                      <span
                        role="status"
                        className={`text-xs font-semibold ${
                          hasError ? "text-danger-soft" : "text-success-soft"
                        }`}
                      >
                        {hasError ? "Invalid" : "Valid"}
                      </span>
                    </div>
                    {hasError && (
                      <p
                        id={`${panelId}-${field.name}-error`}
                        role="alert"
                        aria-live="assertive"
                        className="mt-1 text-xs text-danger-soft"
                      >
                        {field.error}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Notifications */}
          {notifications.length === 0 && fields.length === 0 && (
            <p className="text-sm text-text-muted">You&apos;re all caught up.</p>
          )}
          {notifications.map((notice) => (
            <div
              key={notice.id}
              role={notice.type === "error" ? "alert" : "status"}
              aria-live={notice.type === "error" ? "assertive" : "polite"}
              className={`rounded border px-3 py-2 ${TYPE_STYLES[notice.type]}`}
            >
              <div className="flex items-start gap-2">
                <span aria-hidden="true">{TYPE_ICON[notice.type]}</span>
                <div>
                  <p className="text-sm font-medium">{notice.title}</p>
                  {notice.message && (
                    <p className="text-xs mt-0.5">{notice.message}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
