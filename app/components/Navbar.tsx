"use client";
import { useWallet } from "@/app/context/WalletContext";
import Link from "next/link";

export default function Navbar() {
  const { address, connect, disconnect, isConnecting } = useWallet();

  const short = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`;

  return (
    <nav className="border-b border-gray-800 bg-gray-950 px-6 py-4 flex items-center justify-between">
      <Link href="/" className="text-xl font-bold text-white tracking-tight">
        🔐 Escrow
      </Link>
      <div className="flex items-center gap-4">
        {address ? (
          <>
            <Link href="/dashboard" className="text-sm text-gray-300 hover:text-white transition">
              Dashboard
            </Link>
            <Link href="/create" className="text-sm text-gray-300 hover:text-white transition">
              + New Job
            </Link>
            <Link href="/admin" className="text-sm text-gray-300 hover:text-white transition">
              Admin
            </Link>
            <span className="text-sm text-gray-400 font-mono bg-gray-800 px-3 py-1 rounded-full">
              {short(address)}
            </span>
            <button
              onClick={disconnect}
              className="text-sm text-red-400 hover:text-red-300 transition"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={connect}
            disabled={isConnecting}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>
    </nav>
  );
}
