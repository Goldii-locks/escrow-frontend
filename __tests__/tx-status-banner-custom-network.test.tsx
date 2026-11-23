import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import TxStatusBanner from "@/app/components/TxStatusBanner";
import { getStellarExpertTxUrl } from "@/app/lib/stellar";
import { STELLAR_NETWORK_PASSPHRASES } from "@/app/lib/network_config";

const CUSTOM_PASSPHRASE = "Local Quickstart Network ; November 2026";
const TX_HASH = "e2e-custom-network-hash";

describe("transaction explorer links (#867)", () => {
  it("returns null for custom and futurenet passphrases", () => {
    expect(getStellarExpertTxUrl(TX_HASH, CUSTOM_PASSPHRASE)).toBeNull();
    expect(
      getStellarExpertTxUrl(TX_HASH, STELLAR_NETWORK_PASSPHRASES.FUTURENET),
    ).toBeNull();
  });

  it("returns the right public explorer path for known networks", () => {
    expect(
      getStellarExpertTxUrl(TX_HASH, STELLAR_NETWORK_PASSPHRASES.TESTNET),
    ).toBe(`https://stellar.expert/explorer/testnet/tx/${TX_HASH}`);
    expect(
      getStellarExpertTxUrl(TX_HASH, STELLAR_NETWORK_PASSPHRASES.PUBLIC),
    ).toBe(`https://stellar.expert/explorer/public/tx/${TX_HASH}`);
  });

  it("renders a successful tx hash with copy button on a custom network", () => {
    expect(() =>
      render(
        <TxStatusBanner
          state={{ phase: "success", error: null, txHash: TX_HASH }}
          passphrase={CUSTOM_PASSPHRASE}
        />,
      ),
    ).not.toThrow();

    expect(screen.getByTestId("transaction-hash-value")).toHaveTextContent(TX_HASH);
    expect(
      screen.queryByRole("link", { name: /Stellar Expert/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Copy transaction hash" }),
    ).toBeInTheDocument();
  });

  it("keeps the explorer link on a known network", () => {
    render(
      <TxStatusBanner
        state={{ phase: "success", error: null, txHash: TX_HASH }}
        passphrase={STELLAR_NETWORK_PASSPHRASES.TESTNET}
      />,
    );

    expect(screen.getByRole("link", { name: /Stellar Expert/i })).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/testnet/tx/${TX_HASH}`,
    );
  });
});
