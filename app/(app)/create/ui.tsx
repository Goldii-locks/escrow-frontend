"use client";

import { useRef, type ReactNode } from "react";

export const inputClassName =
  "w-full bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm text-text-primary placeholder:text-text-disabled transition-colors duration-200 hover:border-accent-soft hover:bg-surface-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border-subtle disabled:hover:bg-surface-field";

export const buttonClassName =
  "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100";

/** Text-style "+ Add …" button used above each list. */
export const addButtonClassName = `${buttonClassName} text-accent-soft hover:text-accent-soft-hover rounded-sm px-0 py-0 active:scale-95`;

/** The ✕ button beside each list row. */
export const removeButtonClassName = `${buttonClassName} text-danger-soft hover:text-danger-soft-hover shrink-0 rounded-sm min-h-[44px] min-w-[44px] px-2 py-2 active:scale-95`;

export function EmptyCollectionState({
  title,
  description,
  actionLabel,
  onAction,
  testId,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  testId: string;
}) {
  return (
    <div
      className="rounded-2xl border border-dashed border-border-subtle bg-surface-card/80 px-4 py-5 shadow-sm"
      data-testid={testId}
    >
      <p className="text-sm font-semibold text-text-secondary">{title}</p>
      <p className="mt-1 text-xs leading-5 text-text-muted">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className={`${buttonClassName} mt-4 text-accent-soft hover:text-accent-soft-hover px-0 py-0 rounded-sm active:scale-95`}
      >
        {actionLabel}
      </button>
    </div>
  );
}

/**
 * One wizard step: a tabpanel section labelled by its tab, with a heading and
 * a "Focus section" button that activates the tab and moves focus here.
 */
export function StepPanel({
  id,
  title,
  description,
  focusLabel,
  onActivate,
  children,
}: {
  id: "details" | "milestones" | "review";
  title: string;
  description: string;
  focusLabel: string;
  onActivate: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);
  return (
    <section
      id={`panel-${id}`}
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      ref={panelRef}
      tabIndex={-1}
      className="rounded-2xl border border-border-subtle bg-surface-card/70 p-5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-surface-page"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <p className="text-xs text-text-muted">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            onActivate();
            panelRef.current?.focus();
          }}
          aria-label={focusLabel}
          className={`${buttonClassName} border border-border-subtle bg-surface-field px-3 py-2 text-text-secondary hover:border-accent-soft hover:text-text-primary`}
        >
          Focus section
        </button>
      </div>
      {children}
    </section>
  );
}
