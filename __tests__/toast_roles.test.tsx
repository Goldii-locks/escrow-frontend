import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import Toast from "@/app/components/Toast";
import { ToastProvider, useToast, type ToastType } from "@/app/context/ToastContext";

const trigger: { show: (message: string, type: ToastType) => void } = { show: () => {} };

function Trigger() {
  const { showToast } = useToast();
  useEffect(() => {
    trigger.show = showToast;
  }, [showToast]);
  return null;
}

function renderToasts() {
  render(
    <ToastProvider>
      <Trigger />
      <Toast />
    </ToastProvider>
  );
}

describe("Toast roles", () => {
  it("renders error toasts with role alert", () => {
    renderToasts();
    act(() => trigger.show("Something failed", "error"));
    expect(screen.getByRole("alert")).toHaveTextContent("Something failed");
  });

  it.each(["success", "info"] as const)("renders %s toasts with role status", (type) => {
    renderToasts();
    act(() => trigger.show("All good", type));
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("All good");
    expect(toast).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
