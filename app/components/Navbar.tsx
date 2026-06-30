"use client";
import { useWallet } from "@/app/context/WalletContext";
import { useIsAdmin } from "@/app/hooks/useIsAdmin";
import Link from "next/link";

export default function Navbar() {
  const { address, connect, disconnect, isConnecting } = useWallet();
  const { isAdminUser } = useIsAdmin(address);

  const short = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  const focusRing =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 rounded";

  return (
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
              onClick={disconnect}
              className={`text-sm text-red-400 hover:text-red-300 transition ${focusRing}`}
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={connect}
            disabled={isConnecting}
            className={`bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition ${focusRing}`}
          >
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>
    </nav>
  );
}
