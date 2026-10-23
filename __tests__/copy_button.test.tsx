import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CopyButton from "@/app/components/CopyButton";
import Toast from "@/app/components/Toast";
import { ToastProvider } from "@/app/context/ToastContext";

const FULL = "CCQ5KZQ4A3XJ6Y2OJVZKD2B3E4HQWQ7TNXJ6Y2OJVZKD2B3E4HQWQ7TN";

describe("CopyButton", () => {
  const writeText = vi.fn();

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  });

  it("copies the full value even when the display is truncated", async () => {
    render(
      <ToastProvider>
        <span>{`${FULL.slice(0, 6)}…${FULL.slice(-7)}`}</span>
        <CopyButton value={FULL} label="Contract ID" />
        <Toast />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy contract ID" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(FULL));
    expect(await screen.findByRole("status")).toHaveTextContent("Contract ID copied to clipboard");
  });

  it("shows an error toast when the clipboard write fails", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(
      <ToastProvider>
        <CopyButton value={FULL} label="Contract ID" />
        <Toast />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy contract ID" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not copy contract ID");
  });
});
