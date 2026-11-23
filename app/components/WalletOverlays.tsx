"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useWallet } from "@/app/context/WalletContext";
import { subscribeToLedgerLoading } from "@/app/lib/ledger_loader";
import { subscribeToWalletLoading } from "@/app/lib/wallet_state_context";
import { albedoLoading } from "@/app/lib/albedo_loading";

// These overlays pull in wallet-specific connectors (and, for the signature
// alert, the Stellar SDK). They are only downloaded when an operation is
// actually in flight, keeping them out of every route's first-load JS (#850).
const LedgerLoaderOverlay = dynamic(() => import("./LedgerLoaderOverlay"), {
  ssr: false,
});
const WalletLoaderOverlay = dynamic(() => import("./WalletLoaderOverlay"), {
  ssr: false,
});
const SignatureTimeoutAlert = dynamic(() => import("./SignatureTimeoutAlert"), {
  ssr: false,
});

export default function WalletOverlays() {
  const [ledgerBusy, setLedgerBusy] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [albedoBusy, setAlbedoBusy] = useState(false);
  const { signatureTimeoutError, networkMismatchMessage } = useWallet();

  useEffect(() => subscribeToLedgerLoading(setLedgerBusy), []);
  useEffect(() => subscribeToWalletLoading(setWalletBusy), []);
  useEffect(() => albedoLoading.subscribe((state) => setAlbedoBusy(state.isLoading)), []);

  const needsSignatureAlert = Boolean(
    signatureTimeoutError || networkMismatchMessage
  );

  return (
    <>
      {ledgerBusy && <LedgerLoaderOverlay />}
      {(walletBusy || albedoBusy) && <WalletLoaderOverlay />}
      {needsSignatureAlert && <SignatureTimeoutAlert />}
    </>
  );
}
