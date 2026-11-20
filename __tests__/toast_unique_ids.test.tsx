import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ToastProvider, useToast, MAX_TOASTS } from "@/app/context/ToastContext";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

describe("ToastContext unique IDs", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("gives independently dismissible toasts when Date.now is frozen", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      result.current.showToast("first", "error");
      result.current.showToast("second", "warning");
    });

    expect(result.current.toasts).toHaveLength(2);
    const [a, b] = result.current.toasts;
    expect(a.id).not.toBe(b.id);

    act(() => result.current.hideToast(a.id));
    expect(result.current.toasts.map((t) => t.message)).toEqual(["second"]);
  });

  it("auto-dismisses only the toast whose timer fired", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => result.current.showToast("first", "info"));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => result.current.showToast("second", "info"));
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.toasts.map((t) => t.message)).toEqual(["second"]);
  });

  it("caps the visible stack, dropping the oldest", () => {
    const { result } = renderHook(() => useToast(), { wrapper });

    act(() => {
      for (let i = 0; i < MAX_TOASTS + 2; i++) {
        result.current.showToast(`t${i}`, "info");
      }
    });

    expect(result.current.toasts).toHaveLength(MAX_TOASTS);
    expect(result.current.toasts[0].message).toBe("t2");
  });
});
