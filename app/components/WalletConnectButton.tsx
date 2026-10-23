"use client";

import { useState } from "react";
import { useWallet } from "@/app/context/WalletContext";
import WalletSelectorModal from "@/app/components/WalletSelectorModal";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 rounded";

/**
 * "Connect Wallet" button that opens WalletSelectorModal. Picking a wallet in
 * the modal records it as the selected provider and connects it directly.
 */
export default function WalletConnectButton() {
  const { address, connect, isConnecting, selectedWalletId, setSelectedWalletId } = useWallet();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={isConnecting}
        className={`bg-accent hover:bg-accent-hover disabled:opacity-50 text-text-primary text-sm font-medium px-4 py-2 rounded-lg transition ${focusRing}`}
      >
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>
      <WalletSelectorModal
        isOpen={open}
        onClose={() => setOpen(false)}
        activeAddress={address}
        selectedWalletId={selectedWalletId}
        isLoading={isConnecting}
        onConnect={(id) => {
          setSelectedWalletId(id);
          setOpen(false);
          // Pass the id: the selectedWalletId state update hasn't rendered yet.
          void connect(id);
        }}
      />
    </>
  );
}
