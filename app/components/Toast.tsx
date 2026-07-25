"use client";
import { useToast, ToastType } from "@/app/context/ToastContext";

const getToastStyles = (type: ToastType) => {
  switch (type) {
    case "success":
      return "bg-success/40 border-success text-success-soft";
    case "error":
      return "bg-danger/40 border-danger text-danger-soft";
    case "warning":
      return "bg-warning/40 border-warning text-warning-soft";
    case "info":
      return "bg-accent/40 border-accent text-accent-soft";
  }
};

export default function Toast() {
  const { toasts, hideToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg border shadow-lg animate-slide-in ${getToastStyles(toast.type)}`}
          role="alert"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm">{toast.message}</p>
            <button
              onClick={() => hideToast(toast.id)}
              className="text-sm font-medium hover:opacity-70 transition-opacity"
              aria-label="Close notification"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
