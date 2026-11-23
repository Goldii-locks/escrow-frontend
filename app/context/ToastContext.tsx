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
}

const ToastContext = createContext<ToastContextType>({
  toasts: [],
  showToast: () => {},
  hideToast: () => {},
});

/** Maximum number of toasts visible at once; the oldest is evicted first. */
export const MAX_VISIBLE_TOASTS = 4;

/** Milliseconds a toast stays on screen before auto-dismissing. */
const TOAST_DURATION_MS = 5000;

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
  // Auto-dismiss timer handles, keyed by toast ID, so they can be cancelled
  // when a toast is dismissed manually, evicted by the cap, or unmounted.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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
    timersRef.current.set(
      id,
      setTimeout(() => {
        hideToast(id);
      }, TOAST_DURATION_MS),
    );
  }, [hideToast]);

  // Cancel timers for toasts that are no longer visible (manual dismissal,
  // auto-dismiss or eviction by the stack cap) so they cannot leak.
  useEffect(() => {
    const visible = new Set(toasts.map((t) => t.id));
    for (const [id, handle] of timersRef.current) {
      if (!visible.has(id)) {
        clearTimeout(handle);
        timersRef.current.delete(id);
      }
    }
  }, [toasts]);

  // Clear every pending timer when the provider unmounts.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const handle of timers.values()) {
        clearTimeout(handle);
      }
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, hideToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);