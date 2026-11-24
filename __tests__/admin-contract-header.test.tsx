import { render, screen } from "@testing-library/react";
import { Networks } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";
import AdminContractHeader from "@/app/components/AdminContractHeader";
import WhitelistConfirmModal from "@/app/components/WhitelistConfirmModal";

const CONTRACT = "CABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW";

describe.each([
  { passphrase: Networks.TESTNET, label: "TESTNET", path: "testnet", red: false },
  { passphrase: Networks.PUBLIC, label: "MAINNET", path: "public", red: true },
])("admin network/contract display on $label", ({ passphrase, label, path, red }) => {
  it("shows the network badge, contract, copy button and explorer link", () => {
    render(<AdminContractHeader contractId={CONTRACT} networkPassphrase={passphrase} />);

    const badge = screen.getByTestId("admin-network-badge");
    expect(badge).toHaveTextContent(label);
    expect(badge.className.includes("red")).toBe(red);
    expect(screen.getByTestId("admin-contract-id")).toHaveTextContent("CABCDE…QRSTUVW");
    expect(screen.getByRole("button", { name: /copy contract id/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view on explorer/i })).toHaveAttribute(
      "href",
      `https://stellar.expert/explorer/${path}/contract/${CONTRACT}`
    );
  });

  it("repeats the network and contract in the confirm modal", () => {
    render(
      <WhitelistConfirmModal
        action={{ kind: "add", token: "CTOKEN1" }}
        onCancel={() => {}}
        onConfirm={() => {}}
        contractId={CONTRACT}
        networkPassphrase={passphrase}
      />
    );

    const target = screen.getByTestId("whitelist-confirm-target");
    expect(target).toHaveTextContent(label);
    expect(target).toHaveTextContent("CABCDE…QRSTUVW");
  });
});
