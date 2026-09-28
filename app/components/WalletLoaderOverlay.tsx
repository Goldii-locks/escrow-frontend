"use client";

import { useEffect, useState } from "react";
import { subscribeToWalletLoading } from "@/app/lib/wallet_state_context";
import { albedoLoading } from "@/app/lib/albedo_connector";
import ButtonSpinner from "./ButtonSpinner";

/**
 * Global loader overlay tracking wallet_state_context operations (connect,
 * disconnect, sign, multi-sig assembly) and Albedo-specific loading states
 * (connect, sign, submit, popup) and displaying a spinner overlay while any
 * of them are in flight.
 *
 * Subscribes to both the wallet_state_context loader and the AlbedoLoadingManager
 * so Albedo popup operations trigger the same overlay as other wallet operations.
 */
export default function WalletLoaderOverlay() {
  const [walletLoading, setWalletLoading] = useState(false);
  const [albedoLoadingState, setAlbedoLoadingState] = useState(false);

  useEffect(() => {
    const unsubWallet = subscribeToWalletLoading((loading) => {
      setWalletLoading(loading);
    });

    const unsubAlbedo = albedoLoading.subscribe((state) => {
      setAlbedoLoadingState(state.isLoading);
    });

    return () => {
      unsubWallet();
      unsubAlbedo();
    };
  }, []);

  if (!walletLoading && !albedoLoadingState) return null;

  return (
    <div
      data-testid="wallet-loader-overlay"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm text-white"
    >
      <div className="flex flex-col items-center space-y-4 p-6 bg-gray-900 border border-gray-800 rounded-lg shadow-2xl max-w-sm text-center">
        <ButtonSpinner className="h-10 w-10 text-indigo-500 animate-spin" />
        <div>
          <h3 className="text-lg font-semibold text-gray-100">
            Wallet Operation in Progress
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Please check your wallet extension or device. Do not refresh or close this tab.
          </p>
        </div>
      </div>
    </div>
  );
}
