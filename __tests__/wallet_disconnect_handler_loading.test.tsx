import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import WalletDisconnectLoaderOverlay from "@/app/components/WalletDisconnectLoaderOverlay";
import {
  disconnectWalletWithCheck,
  endWalletDisconnectOperation,
  isWalletDisconnectLoading,
  resetWalletDisconnectOperations,
  startWalletDisconnectOperation,
  subscribeToWalletDisconnectLoading,
  withWalletDisconnectLoader,
} from "@/app/lib/wallet_disconnect_handler";

const OVERLAY = "wallet-disconnect-loader-overlay";

// The reset notifies subscribers synchronously. Vitest runs this hook before
// Testing Library's auto-cleanup, so an overlay from the previous test may
// still be mounted — wrap it in `act` to keep that state update inside React's
// batching and out of the console.
beforeEach(() => {
  act(() => {
    resetWalletDisconnectOperations();
  });
});

afterEach(() => {
  act(() => {
    resetWalletDisconnectOperations();
  });
});

// ---------------------------------------------------------------------------
// Loader counter primitives
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler loader lifecycle (#238)", () => {
  it("is not loading before any operation starts", () => {
    expect(isWalletDisconnectLoading()).toBe(false);
  });

  it("toggles loading on at operation start", () => {
    startWalletDisconnectOperation();
    expect(isWalletDisconnectLoading()).toBe(true);
  });

  it("toggles loading off at operation end", () => {
    startWalletDisconnectOperation();
    endWalletDisconnectOperation();
    expect(isWalletDisconnectLoading()).toBe(false);
  });

  it("stays loading while a concurrent operation is still in flight", () => {
    startWalletDisconnectOperation();
    startWalletDisconnectOperation();
    endWalletDisconnectOperation();
    expect(isWalletDisconnectLoading()).toBe(true);
    endWalletDisconnectOperation();
    expect(isWalletDisconnectLoading()).toBe(false);
  });

  it("clamps at zero so an unbalanced end does not wedge the overlay", () => {
    endWalletDisconnectOperation();
    endWalletDisconnectOperation();
    expect(isWalletDisconnectLoading()).toBe(false);

    startWalletDisconnectOperation();
    expect(isWalletDisconnectLoading()).toBe(true);
  });

  it("resets all in-flight operations", () => {
    startWalletDisconnectOperation();
    startWalletDisconnectOperation();
    resetWalletDisconnectOperations();
    expect(isWalletDisconnectLoading()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Subscription behaviour
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler subscribeToWalletDisconnectLoading (#238)", () => {
  it("emits the current state immediately on subscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToWalletDisconnectLoading(listener);
    expect(listener).toHaveBeenCalledWith(false);
    unsubscribe();
  });

  it("emits true immediately when subscribing mid-operation", () => {
    startWalletDisconnectOperation();
    const listener = vi.fn();
    const unsubscribe = subscribeToWalletDisconnectLoading(listener);
    expect(listener).toHaveBeenCalledWith(true);
    unsubscribe();
  });

  it("emits on start and on end", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToWalletDisconnectLoading(listener);
    listener.mockClear();

    startWalletDisconnectOperation();
    expect(listener).toHaveBeenLastCalledWith(true);

    endWalletDisconnectOperation();
    expect(listener).toHaveBeenLastCalledWith(false);

    unsubscribe();
  });

  it("stops emitting after unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToWalletDisconnectLoading(listener);
    unsubscribe();
    listener.mockClear();

    startWalletDisconnectOperation();
    expect(listener).not.toHaveBeenCalled();
  });

  it("notifies every active subscriber", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribeToWalletDisconnectLoading(a);
    const unsubB = subscribeToWalletDisconnectLoading(b);
    a.mockClear();
    b.mockClear();

    startWalletDisconnectOperation();
    expect(a).toHaveBeenLastCalledWith(true);
    expect(b).toHaveBeenLastCalledWith(true);

    unsubA();
    unsubB();
  });
});

// ---------------------------------------------------------------------------
// withWalletDisconnectLoader
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler withWalletDisconnectLoader (#238)", () => {
  it("is loading while the wrapped operation runs", async () => {
    let observed = false;

    await withWalletDisconnectLoader(async () => {
      observed = isWalletDisconnectLoading();
    });

    expect(observed).toBe(true);
    expect(isWalletDisconnectLoading()).toBe(false);
  });

  it("returns the wrapped operation's value", async () => {
    const value = await withWalletDisconnectLoader(async () => "done");
    expect(value).toBe("done");
  });

  it("clears loading when the wrapped operation rejects", async () => {
    await expect(
      withWalletDisconnectLoader(async () => {
        throw new Error("disconnect blew up");
      }),
    ).rejects.toThrow("disconnect blew up");

    expect(isWalletDisconnectLoading()).toBe(false);
  });

  it("records a start/end pair around the operation", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToWalletDisconnectLoading(listener);
    listener.mockClear();

    await withWalletDisconnectLoader(async () => {});

    expect(listener.mock.calls.map((c) => c[0])).toEqual([true, false]);
    unsubscribe();
  });
});

// ---------------------------------------------------------------------------
// disconnectWalletWithCheck drives the spinner
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler disconnect spinner integration (#238)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("shows the spinner while the disconnect is executing", async () => {
    let loadingDuringDisconnect = false;

    await disconnectWalletWithCheck(
      "freighter",
      async () => {
        loadingDuringDisconnect = isWalletDisconnectLoading();
      },
      () => true,
    );

    expect(loadingDuringDisconnect).toBe(true);
  });

  it("hides the spinner once the disconnect resolves", async () => {
    await disconnectWalletWithCheck("freighter", async () => {}, () => true);
    expect(isWalletDisconnectLoading()).toBe(false);
  });

  it("hides the spinner when the disconnect function throws", async () => {
    const result = await disconnectWalletWithCheck(
      "freighter",
      async () => {
        throw new Error("extension crashed");
      },
      () => true,
    );

    expect(result.success).toBe(false);
    expect(isWalletDisconnectLoading()).toBe(false);
  });

  it("hides the spinner when the wallet is not installed", async () => {
    const result = await disconnectWalletWithCheck(
      "freighter",
      async () => {},
      () => false,
    );

    expect(result.fallbackInstructions).not.toBeNull();
    expect(isWalletDisconnectLoading()).toBe(false);
  });

  it("toggles the spinner exactly once per disconnect call", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToWalletDisconnectLoading(listener);
    listener.mockClear();

    await disconnectWalletWithCheck("freighter", async () => {}, () => true);

    expect(listener.mock.calls.map((c) => c[0])).toEqual([true, false]);
    unsubscribe();
  });
});

// ---------------------------------------------------------------------------
// WalletDisconnectLoaderOverlay
// ---------------------------------------------------------------------------

describe("WalletDisconnectLoaderOverlay (#238)", () => {
  it("renders nothing while idle", () => {
    const { container } = render(<WalletDisconnectLoaderOverlay />);
    expect(screen.queryByTestId(OVERLAY)).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the overlay when an operation starts", async () => {
    render(<WalletDisconnectLoaderOverlay />);

    act(() => {
      startWalletDisconnectOperation();
    });

    expect(await screen.findByTestId(OVERLAY)).toBeInTheDocument();
  });

  it("hides the overlay when the operation ends", async () => {
    render(<WalletDisconnectLoaderOverlay />);

    act(() => {
      startWalletDisconnectOperation();
    });
    expect(await screen.findByTestId(OVERLAY)).toBeInTheDocument();

    act(() => {
      endWalletDisconnectOperation();
    });
    await waitFor(() => {
      expect(screen.queryByTestId(OVERLAY)).not.toBeInTheDocument();
    });
  });

  it("renders the overlay immediately when mounted mid-operation", async () => {
    startWalletDisconnectOperation();
    render(<WalletDisconnectLoaderOverlay />);
    expect(await screen.findByTestId(OVERLAY)).toBeInTheDocument();
  });

  it("renders a spinner inside the overlay", async () => {
    render(<WalletDisconnectLoaderOverlay />);
    act(() => {
      startWalletDisconnectOperation();
    });

    const overlay = await screen.findByTestId(OVERLAY);
    const spinner = overlay.querySelector("svg");
    expect(spinner).not.toBeNull();
    expect(spinner).toHaveClass("animate-spin");
  });

  it("announces the overlay politely to assistive technology", async () => {
    render(<WalletDisconnectLoaderOverlay />);
    act(() => {
      startWalletDisconnectOperation();
    });

    const overlay = await screen.findByTestId(OVERLAY);
    expect(overlay).toHaveAttribute("role", "status");
    expect(overlay).toHaveAttribute("aria-live", "polite");
  });

  it("shows the overlay across a full disconnect call and hides it after", async () => {
    render(<WalletDisconnectLoaderOverlay />);

    let resolveDisconnect: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      resolveDisconnect = resolve;
    });

    let call: Promise<unknown> | undefined;
    act(() => {
      call = disconnectWalletWithCheck(
        "freighter",
        () => pending,
        () => true,
      );
    });

    expect(await screen.findByTestId(OVERLAY)).toBeInTheDocument();

    await act(async () => {
      resolveDisconnect?.();
      await call;
    });

    await waitFor(() => {
      expect(screen.queryByTestId(OVERLAY)).not.toBeInTheDocument();
    });
  });

  it("stops listening after unmount", async () => {
    const { unmount } = render(<WalletDisconnectLoaderOverlay />);
    unmount();

    act(() => {
      startWalletDisconnectOperation();
    });

    expect(screen.queryByTestId(OVERLAY)).not.toBeInTheDocument();
  });
});
