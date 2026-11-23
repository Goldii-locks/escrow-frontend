import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_VISIBLE_TOASTS,
  ToastProvider,
  useToast,
} from "@/app/context/ToastContext";
import Toast from "@/app/components/Toast";

/** Exposes the context so tests can drive it without a real page. */
function ToastHarness() {
  const { toasts, showToast, hideToast } = useToast();
  return (
    <div>
      <button onClick={() => showToast("Saved", "success")}>show success</button>
      <button onClick={() => showToast("Failed", "error")}>show error</button>
      <button onClick={() => hideToast(toasts[0]?.id ?? "")}>hide first</button>
      <output data-testid="toast-ids">{toasts.map((t) => t.id).join(",")}</output>
      <output data-testid="toast-count">{toasts.length}</output>
      <Toast />
    </div>
  );
}

function renderHarness() {
  return render(
    <ToastProvider>
      <ToastHarness />
    </ToastProvider>,
  );
}

function ids(): string[] {
  const raw = screen.getByTestId("toast-ids").textContent ?? "";
  return raw ? raw.split(",") : [];
}

beforeEach(() => {
  vi.useFakeTimers();
  // Freeze the clock: IDs must not depend on Date.now() being distinct.
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ToastContext identity and stack (#869)", () => {
  it("creates two independently dismissible toasts when Date.now is frozen", () => {
    renderHarness();

    act(() => {
      fireEvent.click(screen.getByText("show success"));
      fireEvent.click(screen.getByText("show error"));
    });

    const [first, second] = ids();
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first).not.toBe(second);
    expect(screen.getAllByRole("alert")).toHaveLength(2);

    // Dismissing the first must leave the second untouched.
    const closeButtons = screen.getAllByRole("button", {
      name: "Close notification",
    });
    act(() => {
      fireEvent.click(closeButtons[0]);
    });

    expect(ids()).toEqual([second]);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("gives every toast a unique ID even in a rapid burst", () => {
    renderHarness();

    act(() => {
      for (let i = 0; i < MAX_VISIBLE_TOASTS; i += 1) {
        fireEvent.click(screen.getByText("show success"));
      }
    });

    const all = ids();
    expect(all).toHaveLength(MAX_VISIBLE_TOASTS);
    expect(new Set(all).size).toBe(MAX_VISIBLE_TOASTS);
  });

  it(`caps the visible stack at ${MAX_VISIBLE_TOASTS} toasts, evicting the oldest`, () => {
    renderHarness();

    act(() => {
      for (let i = 0; i < MAX_VISIBLE_TOASTS + 2; i += 1) {
        fireEvent.click(screen.getByText("show success"));
      }
    });

    expect(screen.getAllByRole("alert")).toHaveLength(MAX_VISIBLE_TOASTS);
    expect(ids()).toHaveLength(MAX_VISIBLE_TOASTS);
  });

  it("auto-dismisses each toast on its own timer", () => {
    renderHarness();

    act(() => {
      fireEvent.click(screen.getByText("show success"));
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      fireEvent.click(screen.getByText("show error"));
    });

    // First toast expires at 5s; the second (created at 2s) survives.
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
    expect(screen.getByTestId("toast-count").textContent).toBe("0");
  });

  it("cancels the auto-dismiss timer when a toast is dismissed manually", () => {
    renderHarness();

    act(() => {
      fireEvent.click(screen.getByText("show success"));
    });
    act(() => {
      fireEvent.click(screen.getByText("hide first"));
    });
    expect(screen.getByTestId("toast-count").textContent).toBe("0");

    // A new toast must not be removed by the cancelled timer of the old one.
    act(() => {
      fireEvent.click(screen.getByText("show error"));
    });
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("clears pending timers on unmount", () => {
    const { unmount } = renderHarness();

    act(() => {
      fireEvent.click(screen.getByText("show success"));
    });
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not leak timers for toasts evicted by the cap", () => {
    renderHarness();

    act(() => {
      for (let i = 0; i < MAX_VISIBLE_TOASTS + 3; i += 1) {
        fireEvent.click(screen.getByText("show success"));
      }
    });

    // Only the visible toasts may hold auto-dismiss timers.
    expect(vi.getTimerCount()).toBe(MAX_VISIBLE_TOASTS);
  });

  it("falls back to unique sequential IDs without crypto.randomUUID", () => {
    const original = crypto.randomUUID;
    // @ts-expect-error deliberately removing the API for the fallback path
    delete crypto.randomUUID;
    try {
      renderHarness();
      act(() => {
        fireEvent.click(screen.getByText("show success"));
        fireEvent.click(screen.getByText("show error"));
      });
      const [first, second] = ids();
      expect(first).not.toBe(second);
    } finally {
      crypto.randomUUID = original;
    }
  });
});