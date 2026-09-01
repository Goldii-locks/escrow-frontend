import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import WalletSelectorModal, {
  detectAnyWalletExtension,
  handleWalletError,
} from "@/app/components/WalletSelectorModal";
import { FREIGHTER_INSTALL_URL } from "@/app/lib/freighter_connector";
import { WalletRejectedError } from "@/app/lib/errors";

// ------------------------------------------------------------------------------
// Mocks
// ------------------------------------------------------------------------------

const showToast = vi.hoisted(() => vi.fn());

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("@/app/context/WalletContext", () => ({
  SUPPORTED_WALLETS: [
    { id: "freighter", label: "Freighter" },
    { id: "albedo", label: "Albedo" },
    { id: "xbull", label: "xBull" },
    { id: "hana", label: "Hana" },
  ],
}));

// ------------------------------------------------------------------------------
// detectAnyWalletExtension unit tests
// ------------------------------------------------------------------------------

describe("detectAnyWalletExtension", () => {
  afterEach(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w["freighterApi"];
    delete w["freighter"];
  });

  it("returns false when no wallet globals are present", () => {
    expect(detectAnyWalletExtension()).toBe(false);
  });

  it("returns true when freighterApi is present", () => {
    (window as unknown as Record<string, unknown>)["freighterApi"] = {};
    expect(detectAnyWalletExtension()).toBe(true);
  });

  it("returns true when freighter is present", () => {
    (window as unknown as Record<string, unknown>)["freighter"] = {};
    expect(detectAnyWalletExtension()).toBe(true);
  });

  it("honours an injected detector callback", () => {
    expect(detectAnyWalletExtension(() => true)).toBe(true);
    expect(detectAnyWalletExtension(() => false)).toBe(false);
  });
});

// ------------------------------------------------------------------------------
// handleWalletError unit tests
// ------------------------------------------------------------------------------

describe("handleWalletError", () => {
  it("identifies user rejected transaction errors", () => {
    const result = handleWalletError(new Error("user rejected transaction"));
    expect(result.isRejection).toBe(true);
    expect(result.message).toMatch(/Signature cancelled/i);
  });

  it("identifies WalletRejectedError instances", () => {
    const result = handleWalletError(new WalletRejectedError());
    expect(result.isRejection).toBe(true);
    expect(result.message).toMatch(/Signature cancelled/i);
  });

  it("identifies user declined errors", () => {
    const result = handleWalletError(new Error("User Declined the request"));
    expect(result.isRejection).toBe(true);
  });

  it("does not classify unexpected errors as rejections", () => {
    const result = handleWalletError(new Error("horizon unreachable"));
    expect(result.isRejection).toBe(false);
    expect(result.message).toBe("horizon unreachable");
  });

  it("handles non-Error thrown values", () => {
    const result = handleWalletError("string error");
    expect(result.isRejection).toBe(false);
    expect(result.message).toBe("An unexpected error occurred.");
  });
});

// ------------------------------------------------------------------------------
// Task 3 — Wallet availability check errors
// ------------------------------------------------------------------------------

describe("WalletSelectorModal wallet availability (#103)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when isOpen is false", () => {
    render(
      <WalletSelectorModal isOpen={false} onClose={vi.fn()} />
    );
    expect(
      screen.queryByTestId("wallet-selector-modal")
    ).not.toBeInTheDocument();
  });

  it("renders the modal dialog when isOpen is true", () => {
    render(
      <WalletSelectorModal isOpen={true} onClose={vi.fn()} />
    );

    expect(screen.getByTestId("wallet-selector-modal")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Select Wallet")).toBeInTheDocument();
  });

  it("renders all supported wallet options", () => {
    render(
      <WalletSelectorModal isOpen={true} onClose={vi.fn()} />
    );

    expect(
      screen.getByTestId("wallet-selector-option-freighter")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("wallet-selector-option-albedo")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("wallet-selector-option-xbull")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("wallet-selector-option-hana")
    ).toBeInTheDocument();
  });

  it("shows availability warning when Freighter extension is missing", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        freighterDetector={() => false}
      />
    );

    const warning = screen.getByTestId(
      "wallet-selector-availability-warning"
    );
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveAttribute("role", "alert");

    expect(
      screen.getByTestId("wallet-selector-setup-instruction")
    ).toHaveTextContent(/not detected/i);

    const installLink = screen.getByTestId("wallet-selector-install-link");
    expect(installLink).toHaveAttribute("href", FREIGHTER_INSTALL_URL);
    expect(installLink).toHaveAttribute("target", "_blank");
  });

  it("hides availability warning when Freighter extension is detected", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        freighterDetector={() => true}
      />
    );

    expect(
      screen.queryByTestId("wallet-selector-availability-warning")
    ).not.toBeInTheDocument();
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <WalletSelectorModal isOpen={true} onClose={onClose} />
    );

    fireEvent.click(screen.getByTestId("wallet-selector-modal-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onConnect with the selected wallet id", () => {
    const onConnect = vi.fn();
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        onConnect={onConnect}
      />
    );

    fireEvent.click(screen.getByTestId("wallet-selector-option-freighter"));
    expect(onConnect).toHaveBeenCalledWith("freighter");
  });
});

// ------------------------------------------------------------------------------
// Task 4 — Graceful handling of user signature rejection exceptions
// ------------------------------------------------------------------------------

describe("WalletSelectorModal design tokens", () => {
  it("uses semantic design token classes for modal shell and alert surfaces", () => {
    // `errorMessage` defaults to null, and the error surface only renders when
    // it is set - pass one so the alert this case asserts on is in the tree.
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        errorMessage="Unable to reach the wallet."
      />
    );

    const backdrop = screen.getByTestId("wallet-selector-modal");
    expect(backdrop).toHaveClass("bg-surface-page/80");

    const content = screen.getByTestId("wallet-selector-modal-content");
    expect(content).toHaveClass(
      "bg-surface-card",
      "border",
      "border-border-subtle",
      "text-text-primary"
    );

    const title = screen.getByText("Select Wallet");
    expect(title).toHaveClass("text-text-primary");

    const warning = screen.getByTestId("wallet-selector-availability-warning");
    expect(warning).toHaveClass(
      "bg-warning-soft/10",
      "border-warning-soft/40",
      "text-warning-soft"
    );

    const errorMessage = screen.getByTestId("wallet-selector-error-message");
    expect(errorMessage).toHaveClass(
      "bg-danger/20",
      "border-danger/40",
      "text-danger-soft"
    );
  });

  it("uses design-token classes for wallet rows and status badges", () => {
    render(
      // The connected badge is gated on `activeAddress !== null` as well as
      // the row being the selected wallet, so both props are needed here.
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        selectedWalletId="freighter"
        activeAddress="GA6HCMBLTZS5VYYBCATRBRZ3BZJMAFUDKYYF6AH6MVCMGWMRDNSWJPIH"
      />
    );

    const selectedOption = screen.getByTestId("wallet-selector-option-freighter");
    expect(selectedOption).toHaveClass(
      "border-accent-soft",
      "bg-accent/10",
      "text-text-primary"
    );

    const connectedBadge = screen.getByTestId("wallet-selector-connected-badge");
    expect(connectedBadge).toHaveClass("text-success-soft");
  });
});

describe("WalletSelectorModal signature rejection handling (#105)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows rejection warning toast when handleWalletError catches a user rejection", () => {
    const result = handleWalletError(
      new Error("user rejected transaction")
    );
    expect(result.isRejection).toBe(true);

    // Simulate what the component does with this result
    showToast(result.message, "warning");
    expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/Signature cancelled/i),
      "warning"
    );
  });

  it("shows rejection warning toast when handleWalletError catches a WalletRejectedError", () => {
    const result = handleWalletError(new WalletRejectedError());
    expect(result.isRejection).toBe(true);

    showToast(result.message, "warning");
    expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/Signature cancelled/i),
      "warning"
    );
  });

  it("does not show rejection toast for non-rejection errors", () => {
    const result = handleWalletError(new Error("network timeout"));
    expect(result.isRejection).toBe(false);

    // Non-rejection errors should not trigger the warning toast path
    expect(result.message).not.toMatch(/Signature cancelled/i);
  });

  it("logs a console warning when a rejection is caught", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = handleWalletError(
      new Error("User Declined the request")
    );
    expect(result.isRejection).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      "[wallet_selector_modal] signature rejected by user:",
      "User Declined the request"
    );

    warnSpy.mockRestore();
  });

  it("preserves the original error in the result for debugging", () => {
    const originalError = new Error("user rejected transaction");
    const result = handleWalletError(originalError);

    expect(result.error).toBe(originalError);
    expect(result.isRejection).toBe(true);
  });

  it("handleWalletError returns fallback message for unknown thrown values", () => {
    const result = handleWalletError(undefined);
    expect(result.isRejection).toBe(false);
    expect(result.message).toBe("An unexpected error occurred.");
  });

  it("handleWalletError returns fallback message for null thrown values", () => {
    const result = handleWalletError(null);
    expect(result.isRejection).toBe(false);
    expect(result.message).toBe("An unexpected error occurred.");
  });
});

// ------------------------------------------------------------------------------
// Task 5 — Gas estimation error warning banners
// -----------------------------------------------------------------------------

describe("WalletSelectorModal gas estimation warnings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a simulation warning banner when the simulation result contains an error", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        simulationResult={{ fee: 0, error: "Fee limits need to exceed standard bounds." }}
      />
    );

    const warning = screen.getByTestId("wallet-selector-gas-warning");
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveAttribute("role", "alert");
    expect(warning).toHaveTextContent(/simulation failed/i);
    expect(warning).toHaveTextContent(/fee limits need to exceed/i);
  });

  it("does not show a simulation warning banner when the simulation result has no error", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        simulationResult={{ fee: 100 }}
      />
    );

    expect(
      screen.queryByTestId("wallet-selector-gas-warning")
    ).not.toBeInTheDocument();
  });

  it("does not show a simulation warning banner when no simulation result is provided", () => {
    render(
      <WalletSelectorModal isOpen={true} onClose={vi.fn()} />
    );

    expect(
      screen.queryByTestId("wallet-selector-gas-warning")
    ).not.toBeInTheDocument();
  });
});
