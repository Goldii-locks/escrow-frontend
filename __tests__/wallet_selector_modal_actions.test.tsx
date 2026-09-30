import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import WalletSelectorModal from "@/app/components/WalletSelectorModal";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const showToast = vi.hoisted(() => vi.fn());

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("@/app/lib/freighter_connector", () => ({
  checkFreighterAvailability: vi.fn(() => ({
    available: true,
    setupInstruction: "",
  })),
  FREIGHTER_INSTALL_URL: "https://freighter.app",
  FREIGHTER_SETUP_INSTRUCTION: "Install Freighter",
  isFreighterUserRejected: vi.fn(() => false),
}));

vi.mock("@/app/context/WalletContext", () => ({
  SUPPORTED_WALLETS: [
    { id: "freighter", label: "Freighter" },
    { id: "albedo", label: "Albedo" },
    { id: "xbull", label: "xBull" },
    { id: "hana", label: "Hana" },
  ],
}));

const TEST_ADDRESS =
  "GA6HCMBLTZS5VYYBCATRBRZ3BZJMAFUDKYYF6AH6MVCMGWMRDNSWJPIH";

// ---------------------------------------------------------------------------
// #232 — Wallet connect actions
// ---------------------------------------------------------------------------

describe("WalletSelectorModal connect actions (#232)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onConnect with 'freighter' when Freighter row is clicked", () => {
    const onConnect = vi.fn();
    render(
      <WalletSelectorModal isOpen={true} onClose={vi.fn()} onConnect={onConnect} />,
    );

    fireEvent.click(screen.getByTestId("wallet-selector-option-freighter"));
    expect(onConnect).toHaveBeenCalledWith("freighter");
  });

  it("calls onConnect with 'albedo' when Albedo row is clicked", () => {
    const onConnect = vi.fn();
    render(
      <WalletSelectorModal isOpen={true} onClose={vi.fn()} onConnect={onConnect} />,
    );

    fireEvent.click(screen.getByTestId("wallet-selector-option-albedo"));
    expect(onConnect).toHaveBeenCalledWith("albedo");
  });

  it("calls onConnect with 'xbull' when xBull row is clicked", () => {
    const onConnect = vi.fn();
    render(
      <WalletSelectorModal isOpen={true} onClose={vi.fn()} onConnect={onConnect} />,
    );

    fireEvent.click(screen.getByTestId("wallet-selector-option-xbull"));
    expect(onConnect).toHaveBeenCalledWith("xbull");
  });

  it("calls onConnect with 'hana' when Hana row is clicked", () => {
    const onConnect = vi.fn();
    render(
      <WalletSelectorModal isOpen={true} onClose={vi.fn()} onConnect={onConnect} />,
    );

    fireEvent.click(screen.getByTestId("wallet-selector-option-hana"));
    expect(onConnect).toHaveBeenCalledWith("hana");
  });

  it("does not crash when onConnect is omitted and a wallet is clicked", () => {
    expect(() => {
      render(
        <WalletSelectorModal isOpen={true} onClose={vi.fn()} />,
      );
      fireEvent.click(screen.getByTestId("wallet-selector-option-freighter"));
    }).not.toThrow();
  });

  it("does not call onConnect when wallet buttons are disabled by loading", () => {
    const onConnect = vi.fn();
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        onConnect={onConnect}
        isLoading={true}
      />,
    );

    fireEvent.click(screen.getByTestId("wallet-selector-option-freighter"));
    expect(onConnect).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// #232 — Wallet disconnect actions
// ---------------------------------------------------------------------------

describe("WalletSelectorModal disconnect actions (#232)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onDisconnect and onClose when the disconnect button is clicked", () => {
    const onDisconnect = vi.fn();
    const onClose = vi.fn();
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={onClose}
        onDisconnect={onDisconnect}
        activeAddress={TEST_ADDRESS}
      />,
    );

    fireEvent.click(screen.getByTestId("wallet-selector-disconnect-btn"));
    expect(onDisconnect).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not crash when onDisconnect is omitted and disconnect is clicked", () => {
    expect(() => {
      render(
        <WalletSelectorModal
          isOpen={true}
          onClose={vi.fn()}
          activeAddress={TEST_ADDRESS}
        />,
      );
      fireEvent.click(screen.getByTestId("wallet-selector-disconnect-btn"));
    }).not.toThrow();
  });

  it("does not fire onDisconnect when the disconnect button is disabled by loading", () => {
    const onDisconnect = vi.fn();
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        onDisconnect={onDisconnect}
        activeAddress={TEST_ADDRESS}
        isLoading={true}
      />,
    );

    fireEvent.click(screen.getByTestId("wallet-selector-disconnect-btn"));
    expect(onDisconnect).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// #232 — Active wallet info display
// ---------------------------------------------------------------------------

describe("WalletSelectorModal active wallet info (#232)", () => {
  it("shows the active wallet info section when activeAddress is set", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        activeAddress={TEST_ADDRESS}
      />,
    );

    expect(screen.getByTestId("wallet-selector-active-info")).toBeInTheDocument();
  });

  it("displays a truncated address (first 4 and last 4 characters)", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        activeAddress={TEST_ADDRESS}
      />,
    );

    const info = screen.getByTestId("wallet-selector-active-info");
    const prefix = TEST_ADDRESS.slice(0, 4);
    const suffix = TEST_ADDRESS.slice(-4);
    expect(info).toHaveTextContent(prefix);
    expect(info).toHaveTextContent(suffix);
    expect(info).not.toHaveTextContent(TEST_ADDRESS);
  });

  it("hides the active wallet info section when activeAddress is null", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        activeAddress={null}
      />,
    );

    expect(
      screen.queryByTestId("wallet-selector-active-info"),
    ).not.toBeInTheDocument();
  });

  it("shows the disconnect button inside the active wallet info", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        activeAddress={TEST_ADDRESS}
      />,
    );

    expect(
      screen.getByTestId("wallet-selector-disconnect-btn"),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// #232 — Connected badge and data attributes
// ---------------------------------------------------------------------------

describe("WalletSelectorModal connected badge and data attributes (#232)", () => {
  it("shows the 'Connected' badge on the selected wallet when connected", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        activeAddress={TEST_ADDRESS}
        selectedWalletId="freighter"
      />,
    );

    expect(
      screen.getByTestId("wallet-selector-connected-badge"),
    ).toHaveTextContent("Connected");
  });

  it("does not show the 'Connected' badge when no activeAddress is set", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        selectedWalletId="freighter"
      />,
    );

    expect(
      screen.queryByTestId("wallet-selector-connected-badge"),
    ).not.toBeInTheDocument();
  });

  it("sets data-selected='true' on the selected wallet row", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        selectedWalletId="albedo"
      />,
    );

    expect(
      screen.getByTestId("wallet-selector-option-albedo"),
    ).toHaveAttribute("data-selected", "true");
    expect(
      screen.getByTestId("wallet-selector-option-freighter"),
    ).toHaveAttribute("data-selected", "false");
  });

  it("sets data-connected='true' only on the selected wallet when address is set", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        activeAddress={TEST_ADDRESS}
        selectedWalletId="xbull"
      />,
    );

    expect(
      screen.getByTestId("wallet-selector-option-xbull"),
    ).toHaveAttribute("data-connected", "true");
    expect(
      screen.getByTestId("wallet-selector-option-freighter"),
    ).toHaveAttribute("data-connected", "false");
  });

  it("sets data-connected='false' on all rows when no address is set", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        selectedWalletId="freighter"
      />,
    );

    expect(
      screen.getByTestId("wallet-selector-option-freighter"),
    ).toHaveAttribute("data-connected", "false");
    expect(
      screen.getByTestId("wallet-selector-option-albedo"),
    ).toHaveAttribute("data-connected", "false");
  });
});

// ---------------------------------------------------------------------------
// #232 — Error message display
// ---------------------------------------------------------------------------

describe("WalletSelectorModal error message display (#232)", () => {
  it("renders the error message banner when errorMessage is provided", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        errorMessage="Connection timed out."
      />,
    );

    const error = screen.getByTestId("wallet-selector-error-message");
    expect(error).toBeInTheDocument();
    expect(error).toHaveAttribute("role", "alert");
    expect(error).toHaveTextContent("Connection timed out.");
  });

  it("does not render the error message banner when errorMessage is null", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        errorMessage={null}
      />,
    );

    expect(
      screen.queryByTestId("wallet-selector-error-message"),
    ).not.toBeInTheDocument();
  });

  it("does not render the error message banner when errorMessage is not provided", () => {
    render(
      <WalletSelectorModal isOpen={true} onClose={vi.fn()} />,
    );

    expect(
      screen.queryByTestId("wallet-selector-error-message"),
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// #232 — className passthrough
// ---------------------------------------------------------------------------

describe("WalletSelectorModal className prop (#232)", () => {
  it("applies a custom className to the modal root element", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        className="my-custom-class"
      />,
    );

    expect(screen.getByTestId("wallet-selector-modal")).toHaveClass(
      "my-custom-class",
    );
  });

  it("preserves default classes alongside the custom className", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={vi.fn()}
        className="my-custom-class"
      />,
    );

    const modal = screen.getByTestId("wallet-selector-modal");
    expect(modal).toHaveClass("fixed", "inset-0", "z-50", "my-custom-class");
  });
});
