"use client";
import { useWallet } from "@/app/context/WalletContext";
import { useIsAdmin } from "@/app/hooks/useIsAdmin";
import { SUPPORTED_WALLETS } from "@/app/context/WalletContext";
import Link from "next/link";

import WalletBadge, { formatAddress } from "@/app/components/WalletBadge";

export default function Navbar() {
  const {
    address,
    connect,
    disconnect,
    isConnecting,
    networkMismatchMessage,
    selectedWalletId,
    setSelectedWalletId,
  } = useWallet();
  const { isAdminUser } = useIsAdmin(address);

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 rounded";

  const selectedWallet = SUPPORTED_WALLETS.find((w) => w.id === selectedWalletId);

  return (
    <>
      {networkMismatchMessage && (
        <div
          className="bg-warning/40 border-b border-warning px-6 py-3 text-warning-soft text-sm text-center"
          role="alert"
        >
          ⚠️ {networkMismatchMessage}
        </div>
      )}
      <nav
        aria-label="Primary"
        className="border-b border-gray-800 bg-gray-950 px-6 py-4 flex items-center justify-between"
      >
        <Link
          href="/"
          aria-label="Escrow home"
          className={`text-xl font-bold text-white tracking-tight ${focusRing}`}
        >
          <span aria-hidden="true">🔐</span> Escrow
        </Link>
        <div className="flex items-center gap-4">
          {address ? (
            <>
              <Link
                href="/dashboard"
                className={`text-sm text-gray-300 hover:text-white transition ${focusRing}`}
              >
                Dashboard
              </Link>
              <Link
                href="/create"
                className={`text-sm text-gray-300 hover:text-white transition ${focusRing}`}
              >
                + New Job
              </Link>
              {isAdminUser && (
                <Link
                  href="/admin"
                  className={`text-sm text-gray-300 hover:text-white transition ${focusRing}`}
                >
                  Admin
                </Link>
              )}
              <WalletBadge
                address={address}
                isConnecting={isConnecting}
                providerName={selectedWallet?.label}
                networkMismatch={networkMismatchMessage}
              />
              <span
                role="status"
                className="text-xs sm:text-sm text-gray-300 font-mono bg-gray-800 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full transition-colors duration-200"
                aria-label={`Connected wallet ${address}`}
              >
                {formatAddress(address)}
              </span>
              <button
                onClick={disconnect}
                className={`bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition ${focusRing}`}
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              <label htmlFor="wallet-provider" className="sr-only">
                Wallet provider
              </label>
              <select
                id="wallet-provider"
                value={selectedWalletId}
                onChange={(event) =>
                  setSelectedWalletId(event.target.value as (typeof SUPPORTED_WALLETS)[number]["id"])
                }
                aria-label="Wallet provider"
                disabled={isConnecting}
                className="bg-gray-900 border border-gray-700 text-sm text-gray-200 rounded-lg px-3 py-2"
              >
                {SUPPORTED_WALLETS.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.label}
                  </option>
                ))}
              </select>
              <button
                onClick={connect}
                disabled={isConnecting}
                className={`bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition ${focusRing}`}
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            </>
          )}
        </div>
      </nav>
    </>
  );
}
