import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import WalletDisconnectNetworkWarningBar from "@/app/components/WalletDisconnectNetworkWarningBar";
import {
  DISCONNECT_NETWORK_PASSPHRASES,
  checkDisconnectNetworkMatch,
  normalizeDisconnectNetwork,
  warnOnDisconnectNetworkMismatch,
} from "@/app/lib/wallet_disconnect_handler";

const BAR = "wallet-disconnect-network-warning-bar";
const MAINNET_PASSPHRASE = DISCONNECT_NETWORK_PASSPHRASES.mainnet;
const TESTNET_PASSPHRASE = DISCONNECT_NETWORK_PASSPHRASES.testnet;

// ---------------------------------------------------------------------------
// normalizeDisconnectNetwork
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler normalizeDisconnectNetwork (#236)", () => {
  it("normalizes the mainnet label", () => {
    expect(normalizeDisconnectNetwork("mainnet")).toBe("mainnet");
  });

  it("normalizes the testnet label", () => {
    expect(normalizeDisconnectNetwork("testnet")).toBe("testnet");
  });

  it("is case-insensitive", () => {
    expect(normalizeDisconnectNetwork("MAINNET")).toBe("mainnet");
    expect(normalizeDisconnectNetwork("TestNet")).toBe("testnet");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeDisconnectNetwork("  testnet  ")).toBe("testnet");
  });

  it("accepts the 'public' alias for mainnet", () => {
    expect(normalizeDisconnectNetwork("public")).toBe("mainnet");
  });

  it("accepts the 'test' alias for testnet", () => {
    expect(normalizeDisconnectNetwork("test")).toBe("testnet");
  });

  it("normalizes the full mainnet passphrase", () => {
    expect(normalizeDisconnectNetwork(MAINNET_PASSPHRASE)).toBe("mainnet");
  });

  it("normalizes the full testnet passphrase", () => {
    expect(normalizeDisconnectNetwork(TESTNET_PASSPHRASE)).toBe("testnet");
  });

  it("returns null for an unrecognized network", () => {
    expect(normalizeDisconnectNetwork("futurenet")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(normalizeDisconnectNetwork("")).toBeNull();
  });

  it("returns null for a whitespace-only string", () => {
    expect(normalizeDisconnectNetwork("   ")).toBeNull();
  });

  it("returns null for null and undefined", () => {
    expect(normalizeDisconnectNetwork(null)).toBeNull();
    expect(normalizeDisconnectNetwork(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkDisconnectNetworkMatch
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler checkDisconnectNetworkMatch (#236)", () => {
  it("reports no mismatch when both sides are testnet", () => {
    const state = checkDisconnectNetworkMatch("testnet", "testnet");
    expect(state.mismatched).toBe(false);
    expect(state.unknownNetwork).toBe(false);
    expect(state.warningMessage).toBeNull();
  });

  it("reports no mismatch when both sides are mainnet", () => {
    const state = checkDisconnectNetworkMatch("mainnet", "mainnet");
    expect(state.mismatched).toBe(false);
    expect(state.warningMessage).toBeNull();
  });

  it("reports no mismatch when a label matches a passphrase", () => {
    const state = checkDisconnectNetworkMatch(MAINNET_PASSPHRASE, "mainnet");
    expect(state.mismatched).toBe(false);
    expect(state.walletNetwork).toBe("mainnet");
    expect(state.appNetwork).toBe("mainnet");
  });

  it("detects a Mainnet wallet against a Testnet app", () => {
    const state = checkDisconnectNetworkMatch("mainnet", "testnet");
    expect(state.mismatched).toBe(true);
    expect(state.unknownNetwork).toBe(false);
    expect(state.warningMessage).toMatch(/network mismatch/i);
    expect(state.warningMessage).toContain("Mainnet");
    expect(state.warningMessage).toContain("Testnet");
  });

  it("detects a Testnet wallet against a Mainnet app", () => {
    const state = checkDisconnectNetworkMatch("testnet", "mainnet");
    expect(state.mismatched).toBe(true);
    expect(state.walletNetwork).toBe("testnet");
    expect(state.appNetwork).toBe("mainnet");
  });

  it("detects a mismatch across full passphrases", () => {
    const state = checkDisconnectNetworkMatch(
      TESTNET_PASSPHRASE,
      MAINNET_PASSPHRASE,
    );
    expect(state.mismatched).toBe(true);
    expect(state.warningMessage).toMatch(/switch networks/i);
  });

  it("treats an unrecognized wallet network as a mismatch", () => {
    const state = checkDisconnectNetworkMatch("futurenet", "testnet");
    expect(state.mismatched).toBe(true);
    expect(state.unknownNetwork).toBe(true);
    expect(state.walletNetwork).toBeNull();
    expect(state.warningMessage).toMatch(/unable to determine/i);
  });

  it("treats a missing wallet network as a mismatch", () => {
    const state = checkDisconnectNetworkMatch(null, "testnet");
    expect(state.mismatched).toBe(true);
    expect(state.unknownNetwork).toBe(true);
  });

  it("treats a missing app network as a mismatch", () => {
    const state = checkDisconnectNetworkMatch("testnet", undefined);
    expect(state.mismatched).toBe(true);
    expect(state.unknownNetwork).toBe(true);
    expect(state.appNetwork).toBeNull();
  });

  it("tells the user to switch networks on a real mismatch", () => {
    const state = checkDisconnectNetworkMatch("mainnet", "testnet");
    expect(state.warningMessage).toMatch(/switch networks to continue/i);
  });
});

// ---------------------------------------------------------------------------
// warnOnDisconnectNetworkMismatch
// ---------------------------------------------------------------------------

describe("wallet_disconnect_handler warnOnDisconnectNetworkMismatch (#236)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("logs a prefixed warning on mismatch", () => {
    const state = warnOnDisconnectNetworkMismatch("mainnet", "testnet");
    expect(state.mismatched).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[wallet_disconnect_handler]");
    expect(logged).toContain("NETWORK MISMATCH");
  });

  it("logs for an unknown network", () => {
    warnOnDisconnectNetworkMismatch("futurenet", "testnet");
    expect(warnSpy).toHaveBeenCalled();
  });

  it("does not log when the networks match", () => {
    warnOnDisconnectNetworkMismatch("testnet", "testnet");
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// WalletDisconnectNetworkWarningBar
// ---------------------------------------------------------------------------

describe("WalletDisconnectNetworkWarningBar (#236)", () => {
  it("renders the warning bar on a Mainnet/Testnet mismatch", () => {
    render(
      <WalletDisconnectNetworkWarningBar
        walletNetwork="mainnet"
        appNetwork="testnet"
      />,
    );

    const bar = screen.getByTestId(BAR);
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveTextContent(/network mismatch/i);
    expect(bar).toHaveTextContent("Mainnet");
    expect(bar).toHaveTextContent("Testnet");
  });

  it("marks the bar as an alert for assistive technology", () => {
    render(
      <WalletDisconnectNetworkWarningBar
        walletNetwork="mainnet"
        appNetwork="testnet"
      />,
    );
    expect(screen.getByTestId(BAR)).toHaveAttribute("role", "alert");
  });

  it("renders the warning bar when networks are given as passphrases", () => {
    render(
      <WalletDisconnectNetworkWarningBar
        walletNetwork={TESTNET_PASSPHRASE}
        appNetwork={MAINNET_PASSPHRASE}
      />,
    );
    expect(screen.getByTestId(BAR)).toBeInTheDocument();
  });

  it("renders an unknown-network bar when the wallet network is unrecognized", () => {
    render(
      <WalletDisconnectNetworkWarningBar
        walletNetwork="futurenet"
        appNetwork="testnet"
      />,
    );
    const bar = screen.getByTestId(BAR);
    expect(bar).toHaveAttribute("data-unknown-network", "true");
    expect(bar).toHaveTextContent(/unable to determine/i);
  });

  it("renders the bar when the wallet network is missing", () => {
    render(
      <WalletDisconnectNetworkWarningBar
        walletNetwork={null}
        appNetwork="testnet"
      />,
    );
    expect(screen.getByTestId(BAR)).toBeInTheDocument();
  });

  it("does not render when the networks match", () => {
    const { container } = render(
      <WalletDisconnectNetworkWarningBar
        walletNetwork="testnet"
        appNetwork="testnet"
      />,
    );
    expect(screen.queryByTestId(BAR)).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("does not render when a label matches a passphrase", () => {
    const { container } = render(
      <WalletDisconnectNetworkWarningBar
        walletNetwork={MAINNET_PASSPHRASE}
        appNetwork="mainnet"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("appends a caller-supplied className", () => {
    render(
      <WalletDisconnectNetworkWarningBar
        walletNetwork="mainnet"
        appNetwork="testnet"
        className="sticky top-0"
      />,
    );
    expect(screen.getByTestId(BAR)).toHaveClass("sticky");
  });
});
