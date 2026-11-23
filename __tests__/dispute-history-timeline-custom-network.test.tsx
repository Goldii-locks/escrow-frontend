import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import DisputeHistoryTimeline from "@/app/components/DisputeHistoryTimeline";
import { MOCK_DISPUTE_HISTORY } from "@/app/lib/dispute_history_timeline";

const CUSTOM_PASSPHRASE = "Local Quickstart Network ; November 2026";
const WALLET = "GCKF7J3CLIENT";
const TX_HASH = "custom-network-timeline-hash";

describe("DisputeHistoryTimeline on networks without an explorer (#867)", () => {
  it("renders an event hash as plain text with a copy button", () => {
    const event = { ...MOCK_DISPUTE_HISTORY[0], txHash: TX_HASH };

    expect(() =>
      render(
        <DisputeHistoryTimeline
          disputeId="disp-101"
          currentWalletAddress={WALLET}
          initialEvents={[event]}
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
});
