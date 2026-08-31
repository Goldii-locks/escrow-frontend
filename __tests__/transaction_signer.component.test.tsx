import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TransactionSigner from "@/app/components/TransactionSigner";

describe("TransactionSigner component (#216)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Render — initial state
  // ---------------------------------------------------------------------------

  it("renders all trigger actions and initial idle status without errors", () => {
    render(
      <TransactionSigner
        walletNetwork="testnet"
        appNetwork="testnet"
        signTransaction={vi.fn()}
      />
    );

    expect(screen.getByTestId("transaction-signer")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign Transaction" })
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("transaction-signer-status")
    ).toHaveTextContent("idle");
  });

  // ---------------------------------------------------------------------------
  // Network mismatch — no warning
  // ---------------------------------------------------------------------------

  it("shows no network warning when networks match", () => {
    render(
      <TransactionSigner
        walletNetwork="testnet"
        appNetwork="testnet"
        signTransaction={vi.fn()}
      />
    );

    expect(
      screen.queryByTestId("transaction-signer-network-warning-bar")
    ).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Network mismatch — warning bar
  // ---------------------------------------------------------------------------

  it("shows network warning when networks mismatch", () => {
    render(
      <TransactionSigner
        walletNetwork="mainnet"
        appNetwork="testnet"
        signTransaction={vi.fn()}
      />
    );

    const bar = screen.getByTestId("transaction-signer-network-warning-bar");
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute("role", "alert");
    expect(bar).toHaveTextContent(/Network mismatch/i);
  });

  it("disables the sign button when networks mismatch", () => {
    render(
      <TransactionSigner
        walletNetwork="mainnet"
        appNetwork="testnet"
        signTransaction={vi.fn()}
      />
    );

    const signButton = screen.getByRole("button", {
      name: "Sign Transaction",
    });
    expect(signButton).toBeDisabled();
  });

  it("does not call signTransaction when networks mismatch", async () => {
    const signTransaction = vi.fn();

    render(
      <TransactionSigner
        walletNetwork="mainnet"
        appNetwork="testnet"
        signTransaction={signTransaction}
      />
    );

    const signButton = screen.getByRole("button", {
      name: "Sign Transaction",
    });
    // The button is disabled when networks mismatch, so the browser
    // does not fire the click handler.  Verify signTransaction is never
    // called and the button is disabled.
    expect(signButton).toBeDisabled();
    fireEvent.click(signButton);

    expect(signTransaction).not.toHaveBeenCalled();
  });

  it("shows the warning bar content when networks mismatch (console warn tested in unit tests)", () => {
    render(
      <TransactionSigner
        walletNetwork="mainnet"
        appNetwork="testnet"
        signTransaction={vi.fn()}
      />
    );

    const bar = screen.getByRole("alert");
    expect(bar).toHaveTextContent(/Switch networks to continue/i);
  });

  // ---------------------------------------------------------------------------
  // Signing — happy path
  // ---------------------------------------------------------------------------

  it("transitions to signed status when signing succeeds", async () => {
    const signTransaction = vi.fn().mockResolvedValue("signed-xdr-abc");
    const onSigned = vi.fn();

    render(
      <TransactionSigner
        walletNetwork="testnet"
        appNetwork="testnet"
        signTransaction={signTransaction}
        onSigned={onSigned}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign Transaction" }));

    expect(
      screen.getByTestId("transaction-signer-status")
    ).toHaveTextContent("signing");

    await waitFor(() => {
      expect(
        screen.getByTestId("transaction-signer-status")
      ).toHaveTextContent("signed");
    });

    expect(signTransaction).toHaveBeenCalledTimes(1);
    expect(onSigned).toHaveBeenCalledWith("signed-xdr-abc");
  });

  // ---------------------------------------------------------------------------
  // Signing — user rejection
  // ---------------------------------------------------------------------------

  it("transitions to rejected status when user declines", async () => {
    const signTransaction = vi
      .fn()
      .mockRejectedValue(new Error("User rejected transaction"));

    render(
      <TransactionSigner
        walletNetwork="testnet"
        appNetwork="testnet"
        signTransaction={signTransaction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign Transaction" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("transaction-signer-status")
      ).toHaveTextContent("rejected");
    });
  });

  it("also handles 'user declined' rejection phrasing", async () => {
    const signTransaction = vi
      .fn()
      .mockRejectedValue(new Error("User declined the request"));

    render(
      <TransactionSigner
        walletNetwork="testnet"
        appNetwork="testnet"
        signTransaction={signTransaction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign Transaction" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("transaction-signer-status")
      ).toHaveTextContent("rejected");
    });
  });

  it("transitions to rejected status when signTransaction returns empty string", async () => {
    const signTransaction = vi.fn().mockResolvedValue("");

    render(
      <TransactionSigner
        walletNetwork="testnet"
        appNetwork="testnet"
        signTransaction={signTransaction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign Transaction" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("transaction-signer-status")
      ).toHaveTextContent("rejected");
    });
  });

  // ---------------------------------------------------------------------------
  // Signing — unexpected error
  // ---------------------------------------------------------------------------

  it("transitions to error status for unexpected signing failures", async () => {
    const signTransaction = vi
      .fn()
      .mockRejectedValue(new Error("Extension crashed"));

    render(
      <TransactionSigner
        walletNetwork="testnet"
        appNetwork="testnet"
        signTransaction={signTransaction}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign Transaction" }));

    await waitFor(() => {
      expect(
        screen.getByTestId("transaction-signer-status")
      ).toHaveTextContent("error");
    });

    expect(warnSpy).toHaveBeenCalled();
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[transaction_signer]");
    expect(logged).toContain("SIGN ERROR");
  });

  // ---------------------------------------------------------------------------
  // Children rendering
  // ---------------------------------------------------------------------------

  it("renders children inside the component", () => {
    render(
      <TransactionSigner
        walletNetwork="testnet"
        appNetwork="testnet"
        signTransaction={vi.fn()}
      >
        <div data-testid="child-content">Custom content</div>
      </TransactionSigner>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByTestId("child-content")).toHaveTextContent(
      "Custom content"
    );
  });
});
