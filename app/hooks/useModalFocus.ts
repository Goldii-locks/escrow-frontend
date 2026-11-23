"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("hidden") &&
      element.getAttribute("aria-hidden") !== "true" &&
      !element.closest("[hidden], [aria-hidden='true']"),
  );
}

interface UseModalFocusOptions {
  /** Whether the dialog is currently visible. */
  isOpen: boolean;
  /** Called when the user dismisses the dialog with Escape. */
  onClose: () => void;
  /**
   * While true, Escape is ignored so an in-flight transaction cannot be
   * accidentally dismissed.
   */
  isPending?: boolean;
  /**
   * Optional element to focus on open. Defaults to the first focusable
   * control, then the dialog heading (or the dialog itself).
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Shared dialog behaviour: moves focus in on open, keeps Tab inside the
 * dialog, closes on Escape (unless pending) and restores focus to the
 * element that opened it. `onClose` and `isPending` are read from refs so
 * inline callbacks do not restart the trap on every parent render.
 */
export function useModalFocus<T extends HTMLElement>({
  isOpen,
  onClose,
  isPending = false,
  initialFocusRef,
}: UseModalFocusOptions): RefObject<T | null> {
  const dialogRef = useRef<T | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const isPendingRef = useRef(isPending);

  // Keep the latest callbacks readable from the trap without restarting it
  // on every parent render. Updated in an effect so render stays pure.
  useEffect(() => {
    onCloseRef.current = onClose;
    isPendingRef.current = isPending;
  }, [onClose, isPending]);

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    previouslyFocusedRef.current = previouslyFocused;

    const initialFocus =
      initialFocusRef?.current ??
      getFocusableElements(dialog)[0] ??
      dialog.querySelector<HTMLElement>("h1, h2, h3, [role='heading']") ??
      dialog;

    if (!initialFocus.hasAttribute("tabindex")) {
      initialFocus.setAttribute("tabindex", "-1");
    }
    initialFocus.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isPendingRef.current) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(dialog);
      const first = focusable[0] ?? dialog;
      const last = focusable[focusable.length - 1] ?? dialog;
      const active = document.activeElement;

      if (!dialog.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Recover if script or an assistive technology moves focus behind the
    // dialog while it is open.
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof Node && !dialog.contains(target)) {
        const focusable = getFocusableElements(dialog);
        (focusable[0] ?? dialog).focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", handleFocusIn, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);

      const restoreTo = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (restoreTo?.isConnected) {
        restoreTo.focus();
      }
    };
    // `onClose` and `isPending` are deliberately read through refs.
  }, [isOpen, initialFocusRef]);

  return dialogRef;
}
