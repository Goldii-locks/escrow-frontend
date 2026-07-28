"use client";

import { useEffect, useState } from "react";
import { subscribeToLedgerLoading } from "@/app/lib/ledger_usb_bridge";
import ButtonSpinner from "./ButtonSpinner";

/**
 * Global loader overlay component specifically for tracking and communicating
 * ledger_usb_bridge operations to users. Completely locks user interaction
 * and displays an informative spinner overlay during active calls.
 */
export default function LedgerLoaderOverlay() {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return subscribeToLedgerLoading((loading) => {
      setIsLoading(loading);
    });
  }, []);

  if (!isLoading) return null;

  return (
    <div
      data-testid="ledger-loader-overlay"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm text-white"
    >
      <div className="flex flex-col items-center space-y-4 p-6 bg-gray-900 border border-gray-800 rounded-lg shadow-2xl max-w-sm text-center">
        <ButtonSpinner className="h-10 w-10 text-indigo-500 animate-spin" />
        <div>
          <h3 className="text-lg font-semibold text-gray-100">
            Ledger Operation in Progress
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Please confirm or check your Ledger USB device. Do not refresh or close this tab.
          </p>
        </div>
      </div>
    </div>
  );
}
