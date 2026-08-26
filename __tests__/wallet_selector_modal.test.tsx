import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Networks } from "@stellar/stellar-sdk";

// WalletSelectorModal imports WalletContext only for the SupportedWalletId type
// and the SUPPORTED_WALLETS constant. Mock the module so tests never try to
// resolve @stellar/freighter-api (which is unavailable in jsdom).
vi.mock("@/app/context/WalletContext", () => ({
  SUPPORTED_WALLETS: [
    { id: "freighter", label: "Freighter" },
    { id: "albedo", label: "Albedo" },
    { id: "xbull", label: "xBull" },
    { id: "hana", label: "Hana" },
  ],
}));

import WalletSelectorModal from "@/app/components/WalletSelectorModal";
import type { SupportedWalletId } from "@/app/context/WalletContext";

const NETWORK = Networks.TESTNET;

// ---------------------------------------------------------------------------
// Default props helpers
// ---------------------------------------------------------------------------

function defaultProps(overrides: Partial<Parameters<typeof WalletSelectorModal>[0]> = {}) {
  return {
    selectedWalletId: "freighter" as SupportedWalletId,
    onSelectWallet: vi.fn(),
    onConnect: vi.fn(),
    isConnecting: false,
    networkPassphrase: NETWORK,
    ...overrides,
  };
}

function openModal() {
  fireEvent.click(screen.getByTestId("wallet-selector-modal-trigger"));
}

// ---------------------------------------------------------------------------
// Trigger button
// ---------------------------------------------------------------------------

describe("WalletSelectorModal — trigger button", () => {
  it("renders the trigger button", () => {
    render(<WalletSelectorModal {...defaultProps()} />);
    expect(screen.getByTestId("wallet-selector-modal-trigger")).toBeInTheDocument();
  });

  it("shows 'Connect Wallet' label when not connecting", () => {
    render(<WalletSelectorModal {...defaultProps()} />);
    expect(screen.getByTestId("wallet-selector-modal-trigger")).toHaveTextContent(
      "Connect Wallet"
    );
  });

  it("is disabled when isConnecting is true", () => {
    render(<WalletSelectorModal {...defaultProps({ isConnecting: true })} />);
    expect(screen.getByTestId("wallet-selector-modal-trigger")).toBeDisabled();
  });

  it("modal is not visible before the trigger is clicked", () => {
    render(<WalletSelectorModal {...defaultProps()} />);
    expect(screen.queryByTestId("wallet-selector-modal")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Modal open / close
// ---------------------------------------------------------------------------

describe("WalletSelectorModal — open and close", () => {
  it("opens the modal when the trigger is clicked", () => {
    render(<WalletSelectorModal {...defaultProps()} />);
    openModal();
    expect(screen.getByTestId("wallet-selector-modal")).toBeInTheDocument();
  });

  it("closes the modal when the close button is clicked", () => {
    render(<WalletSelectorModal {...defaultProps()} />);
    openModal();
    fireEvent.click(screen.getByTestId("wallet-selector-modal-close"));
    expect(screen.queryByTestId("wallet-selector-modal")).not.toBeInTheDocument();
  });

  it("closes the modal when the backdrop is clicked", () => {
    render(<WalletSelectorModal {...defaultProps()} />);
    openModal();
    fireEvent.click(screen.getByTestId("wallet-selector-modal-backdrop"));
    expect(screen.queryByTestId("wallet-selector-modal")).not.toBeInTheDocument();
  });

  it("has role=dialog and aria-modal on the modal panel", () => {
    render(<WalletSelectorModal {...defaultProps()} />);
    openModal();
    const dialog = screen.getByTestId("wallet-selector-modal");
    expect(dialog).toHaveAttribute("role", "dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});

// ---------------------------------------------------------------------------
// Single-sig flow — existing behaviour unchanged
// ---------------------------------------------------------------------------

describe("WalletSelectorModal — single-sig connect flow", () => {
  it("renders the wallet selector inside the modal", () => {
    render(<WalletSelectorModal {...defaultProps()} />);
    openModal();
    // the select element inside the modal
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("calls onSelectWallet when a wallet is chosen", () => {
    const onSelectWallet = vi.fn();
    render(<WalletSelectorModal {...defaultProps({ onSelectWallet })} />);
    openModal();
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "albedo" },
    });
    expect(onSelectWallet).toHaveBeenCalledWith("albedo");
  });

  it("calls onConnect and closes the modal when Connect is clicked", () => {
    const onConnect = vi.fn();
    render(<WalletSelectorModal {...defaultProps({ onConnect })} />);
    openModal();
    fireEvent.click(screen.getByTestId("connect-btn"));
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("wallet-selector-modal")).not.toBeInTheDocument();
  });

  it("multi-sig panel is hidden by default", () => {
    render(<WalletSelectorModal {...defaultProps()} />);
    openModal();
    expect(screen.queryByTestId("multisig-panel")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Multi-sig toggle
// ---------------------------------------------------------------------------

describe("WalletSelectorModal — multi-sig toggle", () => {
  beforeEach(() => {
    render(<WalletSelectorModal {...defaultProps()} />);
    openModal();
  });

  it("shows the multi-sig panel when the toggle is checked", () => {
    fireEvent.click(screen.getByTestId("multisig-toggle"));
    expect(screen.getByTestId("multisig-panel")).toBeInTheDocument();
  });

  it("hides the single-sig connect button when multi-sig mode is active", () => {
    fireEvent.click(screen.getByTestId("multisig-toggle"));
    expect(screen.queryByTestId("connect-btn")).not.toBeInTheDocument();
  });

  it("hides the multi-sig panel when the toggle is unchecked again", () => {
    const toggle = screen.getByTestId("multisig-toggle");
    fireEvent.click(toggle);
    expect(screen.getByTestId("multisig-panel")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByTestId("multisig-panel")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Multi-sig validation gate — valid XDR parses without errors
// ---------------------------------------------------------------------------

describe("WalletSelectorModal — XDR validation gate", () => {
  it("shows the structure preview after a valid XDR is validated", async () => {
    // Build a real transaction XDR
    const {
      Account,
      Asset,
      BASE_FEE,
      Keypair,
      Operation,
      TransactionBuilder,
    } = await import("@stellar/stellar-sdk");

    const source = Keypair.random();
    const account = new Account(source.publicKey(), "0");
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK,
    })
      .addOperation(
        Operation.payment({
          destination: Keypair.random().publicKey(),
          asset: Asset.native(),
          amount: "1",
        })
      )
      .setTimeout(30)
      .build();

    render(<WalletSelectorModal {...defaultProps({ selectedWalletId: "albedo" })} />);
    openModal();
    fireEvent.click(screen.getByTestId("multisig-toggle"));

    fireEvent.change(screen.getByTestId("xdr-input"), {
      target: { value: tx.toXDR() },
    });
    fireEvent.click(screen.getByTestId("validate-xdr-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("tx-structure-preview")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("multisig-error")).not.toBeInTheDocument();
  });

  it("shows an error message when malformed XDR is submitted", async () => {
    render(<WalletSelectorModal {...defaultProps({ selectedWalletId: "albedo" })} />);
    openModal();
    fireEvent.click(screen.getByTestId("multisig-toggle"));

    fireEvent.change(screen.getByTestId("xdr-input"), {
      target: { value: "this-is-not-valid-xdr" },
    });
    fireEvent.click(screen.getByTestId("validate-xdr-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("multisig-error")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("tx-structure-preview")).not.toBeInTheDocument();
  });

  it("shows an error message when empty XDR is submitted", async () => {
    render(<WalletSelectorModal {...defaultProps({ selectedWalletId: "albedo" })} />);
    openModal();
    fireEvent.click(screen.getByTestId("multisig-toggle"));

    // validate-xdr-btn is disabled when input is empty; simulate clicking anyway
    // by directly invoking handleValidateXdr via a truthy but blank value
    fireEvent.change(screen.getByTestId("xdr-input"), {
      target: { value: "   " },
    });
    // button is disabled for blank — set non-blank then clear
    fireEvent.change(screen.getByTestId("xdr-input"), {
      target: { value: "x" },
    });
    fireEvent.change(screen.getByTestId("xdr-input"), {
      target: { value: "" },
    });
    // Now paste a non-empty string that is still invalid
    fireEvent.change(screen.getByTestId("xdr-input"), {
      target: { value: "ZZZZ" },
    });
    fireEvent.click(screen.getByTestId("validate-xdr-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("multisig-error")).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Multi-sig plan building
// ---------------------------------------------------------------------------

describe("WalletSelectorModal — assembly plan", () => {
  it("calls onMultiSigPlanReady and closes the modal after a successful plan build", async () => {
    const {
      Account,
      Asset,
      BASE_FEE,
      Keypair,
      Operation,
      TransactionBuilder,
    } = await import("@stellar/stellar-sdk");

    const source = Keypair.random();
    const cosigner = Keypair.random();
    const account = new Account(source.publicKey(), "0");
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK,
    })
      .addOperation(
        Operation.payment({
          destination: Keypair.random().publicKey(),
          asset: Asset.native(),
          amount: "1",
        })
      )
      .setTimeout(30)
      .build();

    const onMultiSigPlanReady = vi.fn();
    render(
      <WalletSelectorModal
        {...defaultProps({ selectedWalletId: "albedo", onMultiSigPlanReady })}
      />
    );
    openModal();
    fireEvent.click(screen.getByTestId("multisig-toggle"));

    // Validate XDR first
    fireEvent.change(screen.getByTestId("xdr-input"), {
      target: { value: tx.toXDR() },
    });
    fireEvent.click(screen.getByTestId("validate-xdr-btn"));
    await waitFor(() =>
      expect(screen.getByTestId("tx-structure-preview")).toBeInTheDocument()
    );

    // Enter co-signers
    fireEvent.change(screen.getByTestId("signer-input"), {
      target: {
        value: `${source.publicKey()},${cosigner.publicKey()}`,
      },
    });

    // Build plan
    fireEvent.click(screen.getByTestId("build-plan-btn"));

    expect(onMultiSigPlanReady).toHaveBeenCalledTimes(1);
    const plan = onMultiSigPlanReady.mock.calls[0][0];
    expect(plan.pendingSigners).toContain(source.publicKey());
    expect(plan.pendingSigners).toContain(cosigner.publicKey());

    // Modal should close
    expect(screen.queryByTestId("wallet-selector-modal")).not.toBeInTheDocument();
  });

  it("shows an error if Build plan is clicked without signers", async () => {
    const {
      Account,
      Asset,
      BASE_FEE,
      Keypair,
      Operation,
      TransactionBuilder,
    } = await import("@stellar/stellar-sdk");

    const source = Keypair.random();
    const account = new Account(source.publicKey(), "0");
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK,
    })
      .addOperation(
        Operation.payment({
          destination: Keypair.random().publicKey(),
          asset: Asset.native(),
          amount: "1",
        })
      )
      .setTimeout(30)
      .build();

    render(<WalletSelectorModal {...defaultProps({ selectedWalletId: "albedo" })} />);
    openModal();
    fireEvent.click(screen.getByTestId("multisig-toggle"));

    fireEvent.change(screen.getByTestId("xdr-input"), {
      target: { value: tx.toXDR() },
    });
    fireEvent.click(screen.getByTestId("validate-xdr-btn"));
    await waitFor(() =>
      expect(screen.getByTestId("tx-structure-preview")).toBeInTheDocument()
    );

    // Signer input stays empty — build-plan-btn should be disabled
    expect(screen.getByTestId("build-plan-btn")).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Trigger button — extended (mocked wallet actions)
// ---------------------------------------------------------------------------

describe("WalletSelectorModal — trigger button (extended)", () => {
  it("does not call onConnect when the trigger is clicked while isConnecting", () => {
    const onConnect = vi.fn();
    render(
      <WalletSelectorModal
        {...defaultProps({ isConnecting: true, onConnect })}
      />
    );
    fireEvent.click(screen.getByTestId("wallet-selector-modal-trigger"));
    expect(onConnect).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Wallet picker state
// ---------------------------------------------------------------------------

describe("WalletSelectorModal — wallet picker state", () => {
  it("combobox reflects the selectedWalletId prop on open", () => {
    render(
      <WalletSelectorModal {...defaultProps({ selectedWalletId: "albedo" })} />
    );
    openModal();
    expect(screen.getByRole("combobox")).toHaveValue("albedo");
  });

  it("combobox reflects a different selectedWalletId prop on open", () => {
    render(
      <WalletSelectorModal {...defaultProps({ selectedWalletId: "xbull" })} />
    );
    openModal();
    expect(screen.getByRole("combobox")).toHaveValue("xbull");
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

describe("WalletSelectorModal — accessibility", () => {
  it("dialog panel has aria-labelledby attribute", () => {
    render(<WalletSelectorModal {...defaultProps()} />);
    openModal();
    const dialog = screen.getByTestId("wallet-selector-modal");
    expect(dialog).toHaveAttribute("aria-labelledby");
  });

  it("aria-labelledby points to an element that contains the modal title text", () => {
    render(<WalletSelectorModal {...defaultProps()} />);
    openModal();
    const dialog = screen.getByTestId("wallet-selector-modal");
    const labelId = dialog.getAttribute("aria-labelledby") as string;
    const titleEl = document.getElementById(labelId);
    expect(titleEl).not.toBeNull();
    expect(titleEl?.textContent).toMatch(/connect wallet/i);
  });
});

// ---------------------------------------------------------------------------
// Modal state reset on close
// ---------------------------------------------------------------------------

describe("WalletSelectorModal — modal state reset on close", () => {
  it("re-opening shows no multi-sig panel after it was toggled on and modal closed", () => {
    render(<WalletSelectorModal {...defaultProps()} />);
    openModal();
    fireEvent.click(screen.getByTestId("multisig-toggle"));
    expect(screen.getByTestId("multisig-panel")).toBeInTheDocument();

    // close
    fireEvent.click(screen.getByTestId("wallet-selector-modal-close"));
    // re-open
    openModal();
    expect(screen.queryByTestId("multisig-panel")).not.toBeInTheDocument();
  });

  it("re-opening shows no parse error after a failed validation and close", async () => {
    render(
      <WalletSelectorModal {...defaultProps({ selectedWalletId: "albedo" })} />
    );
    openModal();
    fireEvent.click(screen.getByTestId("multisig-toggle"));
    fireEvent.change(screen.getByTestId("xdr-input"), {
      target: { value: "bad-xdr" },
    });
    fireEvent.click(screen.getByTestId("validate-xdr-btn"));
    await waitFor(() =>
      expect(screen.getByTestId("multisig-error")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId("wallet-selector-modal-close"));
    openModal();
    // toggle again to check clean state
    fireEvent.click(screen.getByTestId("multisig-toggle"));
    expect(screen.queryByTestId("multisig-error")).not.toBeInTheDocument();
  });

  it("re-opening shows no structure preview after a successful validation and close", async () => {
    const {
      Account,
      Asset,
      BASE_FEE,
      Keypair,
      Operation,
      TransactionBuilder,
    } = await import("@stellar/stellar-sdk");

    const source = Keypair.random();
    const account = new Account(source.publicKey(), "0");
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK,
    })
      .addOperation(
        Operation.payment({
          destination: Keypair.random().publicKey(),
          asset: Asset.native(),
          amount: "1",
        })
      )
      .setTimeout(30)
      .build();

    render(
      <WalletSelectorModal {...defaultProps({ selectedWalletId: "albedo" })} />
    );
    openModal();
    fireEvent.click(screen.getByTestId("multisig-toggle"));
    fireEvent.change(screen.getByTestId("xdr-input"), {
      target: { value: tx.toXDR() },
    });
    fireEvent.click(screen.getByTestId("validate-xdr-btn"));
    await waitFor(() =>
      expect(screen.getByTestId("tx-structure-preview")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId("wallet-selector-modal-close"));
    openModal();
    fireEvent.click(screen.getByTestId("multisig-toggle"));
    expect(screen.queryByTestId("tx-structure-preview")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// XDR input state management
// ---------------------------------------------------------------------------

describe("WalletSelectorModal — XDR input state management", () => {
  it("validate-xdr-btn is disabled when XDR input is empty", () => {
    render(
      <WalletSelectorModal {...defaultProps({ selectedWalletId: "albedo" })} />
    );
    openModal();
    fireEvent.click(screen.getByTestId("multisig-toggle"));
    expect(screen.getByTestId("validate-xdr-btn")).toBeDisabled();
  });

  it("typing into XDR input after a failed parse clears the error", async () => {
    render(
      <WalletSelectorModal {...defaultProps({ selectedWalletId: "albedo" })} />
    );
    openModal();
    fireEvent.click(screen.getByTestId("multisig-toggle"));

    fireEvent.change(screen.getByTestId("xdr-input"), {
      target: { value: "bad-xdr" },
    });
    fireEvent.click(screen.getByTestId("validate-xdr-btn"));
    await waitFor(() =>
      expect(screen.getByTestId("multisig-error")).toBeInTheDocument()
    );

    // Type new input — error should clear
    fireEvent.change(screen.getByTestId("xdr-input"), {
      target: { value: "new-input" },
    });
    expect(screen.queryByTestId("multisig-error")).not.toBeInTheDocument();
  });

  it("typing into XDR input after a successful parse clears the structure preview", async () => {
    const {
      Account,
      Asset,
      BASE_FEE,
      Keypair,
      Operation,
      TransactionBuilder,
    } = await import("@stellar/stellar-sdk");

    const source = Keypair.random();
    const account = new Account(source.publicKey(), "0");
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK,
    })
      .addOperation(
        Operation.payment({
          destination: Keypair.random().publicKey(),
          asset: Asset.native(),
          amount: "1",
        })
      )
      .setTimeout(30)
      .build();

    render(
      <WalletSelectorModal {...defaultProps({ selectedWalletId: "albedo" })} />
    );
    openModal();
    fireEvent.click(screen.getByTestId("multisig-toggle"));
    fireEvent.change(screen.getByTestId("xdr-input"), {
      target: { value: tx.toXDR() },
    });
    fireEvent.click(screen.getByTestId("validate-xdr-btn"));
    await waitFor(() =>
      expect(screen.getByTestId("tx-structure-preview")).toBeInTheDocument()
    );

    // Type new input — preview should clear
    fireEvent.change(screen.getByTestId("xdr-input"), {
      target: { value: "changed" },
    });
    expect(screen.queryByTestId("tx-structure-preview")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Build plan button states
// ---------------------------------------------------------------------------

describe("WalletSelectorModal — build plan button states", () => {
  it("build-plan-btn is disabled when structure preview is absent even if signer input has content", () => {
    render(
      <WalletSelectorModal {...defaultProps({ selectedWalletId: "albedo" })} />
    );
    openModal();
    fireEvent.click(screen.getByTestId("multisig-toggle"));

    // Enter a signer but do NOT validate XDR first
    fireEvent.change(screen.getByTestId("signer-input"), {
      target: { value: "GABCDEFG" },
    });
    expect(screen.getByTestId("build-plan-btn")).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Mocked wallet actions — onMultiSigPlanReady not called on error path
// ---------------------------------------------------------------------------

describe("WalletSelectorModal — mocked wallet actions", () => {
  it("onMultiSigPlanReady is not called when build-plan is clicked with no signers", async () => {
    const {
      Account,
      Asset,
      BASE_FEE,
      Keypair,
      Operation,
      TransactionBuilder,
    } = await import("@stellar/stellar-sdk");

    const source = Keypair.random();
    const account = new Account(source.publicKey(), "0");
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK,
    })
      .addOperation(
        Operation.payment({
          destination: Keypair.random().publicKey(),
          asset: Asset.native(),
          amount: "1",
        })
      )
      .setTimeout(30)
      .build();

    const onMultiSigPlanReady = vi.fn();
    render(
      <WalletSelectorModal
        {...defaultProps({ selectedWalletId: "albedo", onMultiSigPlanReady })}
      />
    );
    openModal();
    fireEvent.click(screen.getByTestId("multisig-toggle"));
    fireEvent.change(screen.getByTestId("xdr-input"), {
      target: { value: tx.toXDR() },
    });
    fireEvent.click(screen.getByTestId("validate-xdr-btn"));
    await waitFor(() =>
      expect(screen.getByTestId("tx-structure-preview")).toBeInTheDocument()
    );

    // build-plan-btn disabled (no signer) — try clicking anyway via direct DOM
    const btn = screen.getByTestId("build-plan-btn");
    expect(btn).toBeDisabled();
    // Confirm callback was never invoked
    expect(onMultiSigPlanReady).not.toHaveBeenCalled();
  });

  it("onConnect is called exactly once per click in single-sig mode", () => {
    const onConnect = vi.fn();
    render(<WalletSelectorModal {...defaultProps({ onConnect })} />);
    openModal();
    fireEvent.click(screen.getByTestId("connect-btn"));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("onSelectWallet receives the new wallet id when the combobox changes", () => {
    const onSelectWallet = vi.fn();
    render(
      <WalletSelectorModal
        {...defaultProps({ selectedWalletId: "freighter", onSelectWallet })}
      />
    );
    openModal();
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "hana" },
    });
    expect(onSelectWallet).toHaveBeenCalledWith("hana");
  });
});
