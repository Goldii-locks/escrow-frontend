"use client";

import { useEffect, useState } from "react";
import { subscribeToWalletDisconnectLoading } from "@/app/lib/wallet_disconnect_handler";
import ButtonSpinner from "./ButtonSpinner";

/**
 * Loader overlay tracking wallet_disconnect_handler operations. Locks user
 * interaction and shows a spinner while a disconnect is in flight, so the
 * user cannot fire a second disconnect against a half-torn-down session.
 */
export default function WalletDisconnectLoaderOverlay() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return subscribeToWalletDisconnectLoading((loading) => {
      setIsLoading(loading);
    });
  }, []);

  if (!isLoading) return null;

  return (
    <div
      data-testid="wallet-disconnect-loader-overlay"
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm text-white"
    >
      <div className="flex flex-col items-center space-y-4 p-6 bg-gray-900 border border-gray-800 rounded-lg shadow-2xl max-w-sm text-center">
        <ButtonSpinner
          className="h-10 w-10 text-indigo-500 animate-spin"
        />
        <div>
          <h3 className="text-lg font-semibold text-gray-100">
            Disconnecting Wallet
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Cleaning up your wallet session. Do not refresh or close this tab.
          </p>
        </div>
      </div>
    </div>
  );
}
