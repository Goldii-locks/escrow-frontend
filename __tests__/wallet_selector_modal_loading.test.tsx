import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WalletSelectorModal from "@/app/components/WalletSelectorModal";

import {
  isModalWalletLoading,
  startModalWalletOperation,
  endModalWalletOperation,
  withModalWalletLoader,
  subscribeToModalWalletLoading,
} from "@/app/lib/wallet_selector_modal";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/app/context/ToastContext", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
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

// ---------------------------------------------------------------------------
// Loading state helpers — unit tests
// ---------------------------------------------------------------------------

describe("wallet_selector_modal loading state helpers (#task-3)", () => {
  it("isModalWalletLoading returns false initially", () => {
    expect(isModalWalletLoading()).toBe(false);
  });

  it("subscribeToModalWalletLoading emits the current state immediately", () => {
    const states: boolean[] = [];
    const unsubscribe = subscribeToModalWalletLoading((loading) =>
      states.push(loading),
    );
    expect(states).toEqual([false]);
    unsubscribe();
  });

  it("withModalWalletLoader notifies subscribers true then false around a successful call", async () => {
    const states: boolean[] = [];
    const unsubscribe = subscribeToModalWalletLoading((loading) =>
      states.push(loading),
    );

    const result = await withModalWalletLoader(async () => "done");

    expect(result).toBe("done");
    expect(states).toEqual([false, true, false]);
    unsubscribe();
  });

  it("withModalWalletLoader notifies false even when the wrapped call throws", async () => {
    const states: boolean[] = [];
    const unsubscribe = subscribeToModalWalletLoading((loading) =>
      states.push(loading),
    );

    await expect(
      withModalWalletLoader(async () => {
        throw new Error("fail");
      }),
    ).rejects.toThrow("fail");

    expect(states).toEqual([false, true, false]);
    unsubscribe();
  });

  it("startModalWalletOperation increments the counter and notifies listeners", () => {
    const states: boolean[] = [];
    const unsubscribe = subscribeToModalWalletLoading((loading) =>
      states.push(loading),
    );

    startModalWalletOperation();
    expect(isModalWalletLoading()).toBe(true);
    expect(states).toContain(true);

    unsubscribe();
    endModalWalletOperation();
  });

  it("endModalWalletOperation decrements the counter and notifies listeners", () => {
    startModalWalletOperation();
    startModalWalletOperation();

    const states: boolean[] = [];
    const unsubscribe = subscribeToModalWalletLoading((loading) =>
      states.push(loading),
    );

    endModalWalletOperation();
    expect(isModalWalletLoading()).toBe(true);

    endModalWalletOperation();
    expect(isModalWalletLoading()).toBe(false);
    expect(states).toContain(false);

    unsubscribe();
  });

  it("endModalWalletOperation clamps to zero and does not go negative", () => {
    endModalWalletOperation();
    endModalWalletOperation();
    expect(isModalWalletLoading()).toBe(false);
  });

  it("subscribeToModalWalletLoading's unsubscribe stops further notifications", async () => {
    const states: boolean[] = [];
    const unsubscribe = subscribeToModalWalletLoading((loading) =>
      states.push(loading),
    );
    unsubscribe();

    await withModalWalletLoader(async () => "done");

    expect(states).toEqual([false]);
  });
});

// ---------------------------------------------------------------------------
// WalletSelectorModal component — spinner rendering
// ---------------------------------------------------------------------------

describe("WalletSelectorModal loading spinner (#task-3)", () => {
  it("does not render spinner when isLoading is false", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
        isLoading={false}
      />,
    );
    expect(screen.queryByTestId("wallet-selector-spinner")).not.toBeInTheDocument();
  });

  it("renders spinner when isLoading prop is true", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
        isLoading={true}
      />,
    );
    expect(screen.getByTestId("wallet-selector-spinner")).toBeInTheDocument();
  });

  it("spinner contains an accessible SVG", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
        isLoading={true}
      />,
    );
    const spinner = screen.getByTestId("wallet-selector-spinner");
    expect(spinner.querySelector("svg")).toBeInTheDocument();
  });

  it("spinner displays a loading message", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
        isLoading={true}
      />,
    );
    expect(screen.getByTestId("wallet-selector-spinner")).toHaveTextContent(
      /wallet operation in progress/i,
    );
  });

  it("does not render the spinner when isOpen is false even if isLoading is true", () => {
    const { container } = render(
      <WalletSelectorModal
        isOpen={false}
        onClose={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
        isLoading={true}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("disconnect button is disabled when isLoading is true", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
        activeAddress="GABCDEF1234567890abcdef"
        isLoading={true}
      />,
    );
    expect(screen.getByTestId("wallet-selector-disconnect-btn")).toBeDisabled();
  });

  it("wallet option buttons are disabled when isLoading is true", () => {
    render(
      <WalletSelectorModal
        isOpen={true}
        onClose={() => {}}
        onConnect={() => {}}
        onDisconnect={() => {}}
        isLoading={true}
      />,
    );
    expect(screen.getByTestId("wallet-selector-option-freighter")).toBeDisabled();
    expect(screen.getByTestId("wallet-selector-option-albedo")).toBeDisabled();
  });
});
