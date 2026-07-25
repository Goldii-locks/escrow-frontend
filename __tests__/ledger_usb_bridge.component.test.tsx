import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LedgerUsbBridge from "@/app/components/LedgerUsbBridge";

describe("LedgerUsbBridge component", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("renders trigger actions for network check and signing", () => {
    render(
      <LedgerUsbBridge
        walletNetwork="testnet"
        appNetwork="testnet"
        signTransaction={vi.fn()}
        showToast={vi.fn()}
      />
    );

    expect(screen.getByTestId("ledger-usb-bridge")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Check Ledger network" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign via Ledger" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("ledger-usb-bridge-status")).toHaveTextContent(
      "idle"
    );
  });

  it("marks network as ok when wallet and app networks match", () => {
    const onNetworkCheck = vi.fn();
    const showToast = vi.fn();

    render(
      <LedgerUsbBridge
        walletNetwork="testnet"
        appNetwork="testnet"
        signTransaction={vi.fn()}
        showToast={showToast}
        onNetworkCheck={onNetworkCheck}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Check Ledger network" }));

    expect(onNetworkCheck).toHaveBeenCalledWith(false);
    expect(screen.getByTestId("ledger-usb-bridge-status")).toHaveTextContent(
      "network-ok"
    );
    expect(showToast).not.toHaveBeenCalled();
  });

  it("surfaces a warning toast when networks diverge", () => {
    const onNetworkCheck = vi.fn();
    const showToast = vi.fn();

    render(
      <LedgerUsbBridge
        walletNetwork="mainnet"
        appNetwork="testnet"
        signTransaction={vi.fn()}
        showToast={showToast}
        onNetworkCheck={onNetworkCheck}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Check Ledger network" }));

    expect(onNetworkCheck).toHaveBeenCalledWith(true);
    expect(screen.getByTestId("ledger-usb-bridge-status")).toHaveTextContent(
      "network-mismatch"
    );
    expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/Network mismatch/i),
      "warning"
    );
  });

  it("completes signing when the wallet approves", async () => {
    const signTransaction = vi.fn().mockResolvedValue({ signedXdr: "signed-xdr" });
    const onSigned = vi.fn();
    const showToast = vi.fn();

    render(
      <LedgerUsbBridge
        walletNetwork="testnet"
        appNetwork="testnet"
        signTransaction={signTransaction}
        showToast={showToast}
        onSigned={onSigned}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign via Ledger" }));

    expect(screen.getByTestId("ledger-usb-bridge-status")).toHaveTextContent(
      "signing"
    );

    await waitFor(() => {
      expect(screen.getByTestId("ledger-usb-bridge-status")).toHaveTextContent(
        "signed"
      );
    });

    expect(signTransaction).toHaveBeenCalledTimes(1);
    expect(onSigned).toHaveBeenCalledWith({ signedXdr: "signed-xdr" });
    expect(showToast).not.toHaveBeenCalled();
  });

  it("handles user rejection during signing with a warning toast", async () => {
    const signTransaction = vi
      .fn()
      .mockRejectedValue(new Error("user rejected transaction"));
    const showToast = vi.fn();

    render(
      <LedgerUsbBridge
        walletNetwork="testnet"
        appNetwork="testnet"
        signTransaction={signTransaction}
        showToast={showToast}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign via Ledger" }));

    await waitFor(() => {
      expect(screen.getByTestId("ledger-usb-bridge-status")).toHaveTextContent(
        "rejected"
      );
    });

    expect(showToast).toHaveBeenCalledWith(
      "Transaction cancelled — you rejected the signature on your Ledger.",
      "warning"
    );
    expect(warnSpy).toHaveBeenCalled();
  });

  it("surfaces unexpected signing errors with an error toast", async () => {
    const signTransaction = vi.fn().mockRejectedValue(new Error("USB disconnect"));
    const showToast = vi.fn();

    render(
      <LedgerUsbBridge
        walletNetwork="testnet"
        appNetwork="testnet"
        signTransaction={signTransaction}
        showToast={showToast}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign via Ledger" }));

    await waitFor(() => {
      expect(screen.getByTestId("ledger-usb-bridge-status")).toHaveTextContent(
        "error"
      );
    });

    expect(showToast).toHaveBeenCalledWith("USB disconnect", "error");
  });
});
