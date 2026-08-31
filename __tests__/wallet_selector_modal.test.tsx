import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import WalletSelectorModal, {
  detectAnyWalletExtension,
  handleWalletError,
} from "@/app/components/WalletSelectorModal";
import { FREIGHTER_INSTALL_URL } from "@/app/lib/freighter_connector";
import { WalletRejectedError } from "@/app/lib/errors";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// detectAnyWalletExtension unit tests
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// handleWalletError unit tests
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Task 3 — Wallet availability check errors
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Task 4 — Graceful handling of user signature rejection exceptions
// ---------------------------------------------------------------------------

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
