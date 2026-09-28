import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NetworkSyncChecker from "@/app/components/NetworkSyncChecker";
import { NetworkSyncUserRejectedError } from "@/app/lib/network_sync_checker";

// ---------------------------------------------------------------------------
// #162 — React Testing Library assertions for network_sync_checker
// ---------------------------------------------------------------------------

describe("NetworkSyncChecker component (#162)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Trigger action compilation — all interactive elements must render
  // -------------------------------------------------------------------------

  it("renders its trigger action and an initial idle status without errors", () => {
    render(
      <NetworkSyncChecker walletNetwork="testnet" appNetwork="testnet" />
    );

    expect(screen.getByTestId("network-sync-checker")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Run network sync probe" })
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("network-sync-probe-status")
    ).toHaveAttribute("data-status", "idle");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Network mismatch — no signature probe is attempted
  // -------------------------------------------------------------------------

  it("transitions to blocked and shows the network warning when wallet and app networks differ", async () => {
    const showToast = vi.fn();
    const onSign = vi.fn(async () => "signed-xdr");

    render(
      <NetworkSyncChecker
        walletNetwork="mainnet"
        appNetwork="testnet"
        onSign={onSign}
        showToast={showToast}
        detector={() => true}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Run network sync probe" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("network-sync-probe-status")
      ).toHaveAttribute("data-status", "blocked");
    });

    expect(
      screen.getByTestId("network-sync-network-warning-bar")
    ).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining("Network out of sync"),
      "warning"
    );
    expect(onSign).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Missing wallet — setup instructions surface instead of probing
  // -------------------------------------------------------------------------

  it("shows the wallet setup banner and blocked status when no wallet extension is detected", async () => {
    const showToast = vi.fn();
    const onSign = vi.fn(async () => "signed-xdr");

    render(
      <NetworkSyncChecker
        walletNetwork="testnet"
        appNetwork="testnet"
        onSign={onSign}
        showToast={showToast}
        detector={() => false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Run network sync probe" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("network-sync-probe-status")
      ).toHaveAttribute("data-status", "blocked");
    });

    expect(
      screen.getByTestId("network-sync-wallet-warning-banner")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("network-sync-wallet-install-link")
    ).toHaveAttribute("href", "https://www.freighter.app/");
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining("No wallet extension detected"),
      "warning"
    );
    expect(onSign).not.toHaveBeenCalled();
  });

  it("does not attempt a probe when no signer is wired even if the wallet is available", async () => {
    render(
      <NetworkSyncChecker
        walletNetwork="testnet"
        appNetwork="testnet"
        detector={() => true}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Run network sync probe" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("network-sync-probe-status")
      ).toHaveAttribute("data-status", "blocked");
    });
  });

  // -------------------------------------------------------------------------
  // Signature probe — happy path
  // -------------------------------------------------------------------------

  it("transitions to synced when the wallet approves the signature probe", async () => {
    const showToast = vi.fn();
    const onSign = vi.fn(async () => "signed-xdr-abc");

    render(
      <NetworkSyncChecker
        walletNetwork="testnet"
        appNetwork="testnet"
        onSign={onSign}
        showToast={showToast}
        detector={() => true}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Run network sync probe" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("network-sync-probe-status")
      ).toHaveAttribute("data-status", "synced");
    });

    expect(
      screen.getByTestId("network-sync-probe-status")
    ).toHaveTextContent("signature accepted");
    expect(onSign).toHaveBeenCalledTimes(1);
    expect(showToast).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Signature probe — user rejection
  // -------------------------------------------------------------------------

  it("transitions to cancelled and surfaces the rejection message when the user declines", async () => {
    const showToast = vi.fn();
    const onSign = vi
      .fn()
      .mockRejectedValue(new NetworkSyncUserRejectedError());

    render(
      <NetworkSyncChecker
        walletNetwork="testnet"
        appNetwork="testnet"
        onSign={onSign}
        showToast={showToast}
        detector={() => true}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Run network sync probe" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("network-sync-probe-status")
      ).toHaveAttribute("data-status", "cancelled");
    });

    expect(
      screen.getByTestId("network-sync-probe-status")
    ).toHaveTextContent("you rejected the signature");
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining("you rejected the signature"),
      "warning"
    );
    expect(warnSpy).toHaveBeenCalled();
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[network_sync_checker]");
    expect(logged).toContain("signature rejected during network sync");
  });

  it("also treats 'user declined the request' phrasing as a cancellation", async () => {
    const onSign = vi.fn().mockRejectedValue(new Error("User declined the request"));

    render(
      <NetworkSyncChecker
        walletNetwork="testnet"
        appNetwork="testnet"
        onSign={onSign}
        showToast={vi.fn()}
        detector={() => true}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Run network sync probe" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("network-sync-probe-status")
      ).toHaveAttribute("data-status", "cancelled");
    });
  });

  // -------------------------------------------------------------------------
  // Signature probe — unexpected failure
  // -------------------------------------------------------------------------

  it("transitions to error for unexpected signing failures", async () => {
    const onSign = vi.fn().mockRejectedValue(new Error("Wallet extension crashed"));

    render(
      <NetworkSyncChecker
        walletNetwork="testnet"
        appNetwork="testnet"
        onSign={onSign}
        showToast={vi.fn()}
        detector={() => true}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Run network sync probe" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("network-sync-probe-status")
      ).toHaveAttribute("data-status", "error");
    });

    expect(
      screen.getByTestId("network-sync-probe-status")
    ).toHaveTextContent("probe failed");
  });

  // -------------------------------------------------------------------------
  // Re-runs — the trigger stays available after a failed probe
  // -------------------------------------------------------------------------

  it("re-enables the trigger after a probe resolves", async () => {
    const onSign = vi.fn(async () => "signed-xdr");

    render(
      <NetworkSyncChecker
        walletNetwork="testnet"
        appNetwork="testnet"
        onSign={onSign}
        showToast={vi.fn()}
        detector={() => true}
      />
    );

    const button = screen.getByRole("button", { name: "Run network sync probe" });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(screen.getByTestId("network-sync-probe-status")).toHaveAttribute(
      "data-status",
      "checking"
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("network-sync-probe-status")
      ).toHaveAttribute("data-status", "synced");
    });

    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => {
      expect(onSign).toHaveBeenCalledTimes(2);
    });
  });
});