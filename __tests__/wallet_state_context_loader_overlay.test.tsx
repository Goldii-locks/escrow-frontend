// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import WalletLoaderOverlay from "@/app/components/WalletLoaderOverlay";
import {
  isWalletLoading,
  startWalletOperation,
  endWalletOperation,
  withWalletLoader,
} from "@/app/lib/wallet_state_context";

describe("WalletLoaderOverlay (#118)", () => {
  it("is initially hidden and does not render the overlay", () => {
    render(<WalletLoaderOverlay />);
    expect(screen.queryByTestId("wallet-loader-overlay")).not.toBeInTheDocument();
  });

  it("becomes visible when an operation starts and hides when it ends", async () => {
    render(<WalletLoaderOverlay />);

    startWalletOperation();
    expect(isWalletLoading()).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId("wallet-loader-overlay")).toBeInTheDocument();
    });

    endWalletOperation();
    expect(isWalletLoading()).toBe(false);
    await waitFor(() => {
      expect(screen.queryByTestId("wallet-loader-overlay")).not.toBeInTheDocument();
    });
  });

  it("hides again after withWalletLoader completes or throws", async () => {
    render(<WalletLoaderOverlay />);

    await withWalletLoader(async () => {
      expect(isWalletLoading()).toBe(true);
      await waitFor(() => {
        expect(screen.getByTestId("wallet-loader-overlay")).toBeInTheDocument();
      });
      return "ok";
    });
    await waitFor(() => {
      expect(screen.queryByTestId("wallet-loader-overlay")).not.toBeInTheDocument();
    });

    await expect(
      withWalletLoader(async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
    await waitFor(() => {
      expect(screen.queryByTestId("wallet-loader-overlay")).not.toBeInTheDocument();
    });
  });
});
