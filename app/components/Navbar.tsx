"use client";
import { useWallet } from "@/app/context/WalletContext";
import { useIsAdmin } from "@/app/hooks/useIsAdmin";
import { SUPPORTED_WALLETS } from "@/app/context/WalletContext";
import Link from "next/link";

export default function Navbar() {
  const {
    address,
    connect,
    disconnect,
    isConnecting,
    networkMismatch,
    selectedWalletId,
    setSelectedWalletId,
  } = useWallet();
  const { isAdminUser } = useIsAdmin(address);

  const short = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 rounded";

  return (
    <>
      {networkMismatch && (
        <div
          className="bg-warning/40 border-b border-warning px-6 py-3 text-warning-soft text-sm text-center"
          role="alert"
        >
          ⚠️ Network mismatch: Please switch your Freighter wallet to Stellar Testnet.
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
            <span
              className="text-sm text-gray-300 font-mono bg-gray-800 px-3 py-1 rounded-full"
              aria-label={`Connected wallet ${address}`}
            >
              {short(address)}
            </span>
            <button
              onClick={connect}
              disabled={isConnecting}
              className={`bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition ${focusRing}`}
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
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
