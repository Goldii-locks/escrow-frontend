import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWallet } from "@/app/context/WalletContext";

function WalletConsumer() {
  useWallet();
  return null;
}

describe("useWallet", () => {
  it("throws when rendered outside a WalletProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<WalletConsumer />)).toThrow(
      "useWallet must be used within a WalletProvider"
    );
    consoleError.mockRestore();
  });
});
