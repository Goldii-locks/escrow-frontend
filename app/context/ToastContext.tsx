"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (message: string, type: ToastType) => void;
  hideToast: (id: string) => void;
  /** Suspend a toast's auto-dismiss countdown (hover/focus). */
  pauseToast: (id: string) => void;
  /** Resume a paused countdown with the time that was left. */
  resumeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  toasts: [],
  showToast: () => {},
  hideToast: () => {},
  pauseToast: () => {},
  resumeToast: () => {},
});

/** Maximum number of toasts visible at once; the oldest is evicted first. */
export const MAX_VISIBLE_TOASTS = 4;

/**
 * Auto-dismiss durations per toast type. Errors and warnings stay longer
 * because they usually need action; success/info confirmations are brief.
 */
export const TOAST_DURATIONS_MS: Record<ToastType, number> = {
  success: 5000,
  info: 5000,
  warning: 15000,
  error: 15000,
};

export function getToastDurationMs(type: ToastType): number {
  return TOAST_DURATIONS_MS[type];
}

interface ToastTimer {
  /** Pending timeout handle, or `null` while the countdown is paused. */
  handle: ReturnType<typeof setTimeout> | null;
  /** Wall-clock time the current countdown ends (when running). */
  expiresAt: number;
  /** Milliseconds left on the countdown (kept up to date on pause). */
  remaining: number;
}

// Monotonic fallback so IDs stay unique even when `crypto.randomUUID` is
// unavailable or several toasts are created within the same millisecond.
let toastSequence = 0;

function createToastId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  toastSequence += 1;
  return `toast-${toastSequence}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Auto-dismiss timers, keyed by toast ID, so they can be cancelled when a
  // toast is dismissed manually, evicted by the cap, paused, or unmounted.
  const timersRef = useRef<Map<string, ToastTimer>>(new Map());

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = createToastId();
    setToasts((prev) => {
      const next = [...prev, { id, message, type }];
      return next.length > MAX_VISIBLE_TOASTS
        ? next.slice(next.length - MAX_VISIBLE_TOASTS)
        : next;
    });
    const duration = getToastDurationMs(type);
    timersRef.current.set(id, {
      handle: setTimeout(() => {
        hideToast(id);
      }, duration),
      expiresAt: Date.now() + duration,
      remaining: duration,
    });
  }, [hideToast]);

  const pauseToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (!timer || timer.handle === null) return;
    clearTimeout(timer.handle);
    timer.handle = null;
    timer.remaining = Math.max(0, timer.expiresAt - Date.now());
  }, []);

  const resumeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (!timer || timer.handle !== null) return;
    timer.expiresAt = Date.now() + timer.remaining;
    timer.handle = setTimeout(() => {
      hideToast(id);
    }, timer.remaining);
  }, [hideToast]);

  // Cancel timers for toasts that are no longer visible (manual dismissal,
  // auto-dismiss or eviction by the stack cap) so they cannot leak.
  useEffect(() => {
    const visible = new Set(toasts.map((t) => t.id));
    for (const [id, timer] of timersRef.current) {
      if (!visible.has(id)) {
        if (timer.handle !== null) clearTimeout(timer.handle);
        timersRef.current.delete(id);
      }
    }
  }, [toasts]);

  // Clear every pending timer when the provider unmounts.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        if (timer.handle !== null) clearTimeout(timer.handle);
      }
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider
      value={{ toasts, showToast, hideToast, pauseToast, resumeToast }}
    >
      {children}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);