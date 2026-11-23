import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import {
  ToastProvider,
  useToast,
  getToastDurationMs,
} from "@/app/context/ToastContext";
import Toast from "@/app/components/Toast";

function ToastHarness() {
  const { showToast } = useToast();
  return (
    <div>
      <button onClick={() => showToast("Saved", "success")}>show success</button>
      <button onClick={() => showToast("Failed", "error")}>show error</button>
      <button onClick={() => showToast("Careful", "warning")}>show warning</button>
      <button onClick={() => showToast("FYI", "info")}>show info</button>
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

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("toast durations and pause behaviour (#870)", () => {
  it("uses 5s for success/info and a longer 15s for error/warning", () => {
    expect(getToastDurationMs("success")).toBe(5000);
    expect(getToastDurationMs("info")).toBe(5000);
    expect(getToastDurationMs("error")).toBe(15000);
    expect(getToastDurationMs("warning")).toBe(15000);
  });

  it("dismisses a success toast after 5s", () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText("show success"));
    });

    advance(4999);
    expect(screen.getByText("Saved")).toBeInTheDocument();
    advance(1);
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("dismisses an info toast after 5s", () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText("show info"));
    });

    advance(5000);
    expect(screen.queryByText("FYI")).not.toBeInTheDocument();
  });

  it("keeps an error toast visible after 10s and dismisses it at 15s", () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText("show error"));
    });

    advance(10000);
    expect(screen.getByText("Failed")).toBeInTheDocument();

    advance(4999);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    advance(1);
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
  });

  it("keeps a warning toast visible after 10s", () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText("show warning"));
    });

    advance(10000);
    expect(screen.getByText("Careful")).toBeInTheDocument();
    advance(5000);
    expect(screen.queryByText("Careful")).not.toBeInTheDocument();
  });

  it("pauses the countdown while hovered and resumes with the time left", () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText("show error"));
    });

    advance(10000); // 5s left on the 15s countdown
    fireEvent.mouseEnter(screen.getByTestId("toast-item"));

    // Far beyond the original expiry: hover must hold the toast open.
    advance(60000);
    expect(screen.getByText("Failed")).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByTestId("toast-item"));
    advance(4999);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    advance(1);
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
  });

  it("pauses the countdown while a control inside the toast has focus", () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText("show success"));
    });

    advance(2000); // 3s left on the 5s countdown
    const close = screen.getByRole("button", { name: "Close notification" });
    fireEvent.focus(close);

    advance(30000);
    expect(screen.getByText("Saved")).toBeInTheDocument();

    fireEvent.blur(close);
    advance(2999);
    expect(screen.getByText("Saved")).toBeInTheDocument();
    advance(1);
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("pauses only the hovered toast, not the whole stack", () => {
    renderHarness();
    act(() => {
      fireEvent.click(screen.getByText("show error"));
    });
    advance(1000);
    act(() => {
      fireEvent.click(screen.getByText("show success"));
    });

    const errorItem = screen.getByText("Failed").closest("[data-testid='toast-item']")!;
    fireEvent.mouseEnter(errorItem);

    advance(5000);
    // Success expired on its own timer; the hovered error survives.
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("renders a persistent polite live region that stays mounted when empty", () => {
    renderHarness();
    const container = screen.getByTestId("toast-container");
    expect(container).toHaveAttribute("aria-live", "polite");
    expect(container).toHaveAttribute("aria-label", "Notifications");

    act(() => {
      fireEvent.click(screen.getByText("show success"));
    });
    expect(screen.getByTestId("toast-container")).toBe(container);

    advance(5000);
    expect(screen.queryByTestId("toast-item")).not.toBeInTheDocument();
    // The region itself must remain in the DOM for future announcements.
    expect(screen.getByTestId("toast-container")).toBe(container);
  });
});