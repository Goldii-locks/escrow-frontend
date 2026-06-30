"use client";
import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface FreighterSignResult {
  signedTxXdr?: string;
}

interface FreighterApi {
  requestAccess: () => Promise<void>;
  getPublicKey: () => Promise<string>;
  signTransaction: (
    xdr: string,
    options: { networkPassphrase: string }
  ) => Promise<FreighterSignResult | string>;
}

interface WalletContextType {
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
  signTransaction: (xdr: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  connect: async () => {},
  disconnect: () => {},
  isConnecting: false,
  signTransaction: async () => "",
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const freighter = (window as Window & typeof globalThis & { freighter: unknown }).freighter;
      if (!freighter || typeof freighter !== 'object') {
      const freighter = (window as Window & { freighter?: FreighterApi }).freighter;
      if (!freighter) {
        alert("Please install the Freighter wallet extension.");
        return;
      }
      const freighterWallet = freighter as { requestAccess: () => Promise<void>; getPublicKey: () => Promise<string> };
      await freighterWallet.requestAccess();
      const addr = await freighterWallet.getPublicKey();
      setAddress(addr);
    } catch (e) {
      console.error("Wallet connection failed", e);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => setAddress(null), []);

  const signTransaction = useCallback(async (xdr: string): Promise<string> => {
    const freighter = (window as Window & typeof globalThis & { freighter: unknown }).freighter;
    if (!freighter || typeof freighter !== 'object') throw new Error("Freighter not found");
    const freighterWallet = freighter as { signTransaction: (xdr: string, options: unknown) => Promise<unknown> };
    const result = (await freighterWallet.signTransaction(xdr, {
      networkPassphrase: "Test SDF Network ; September 2015",
    })) as { signedTxXdr?: string };
    return result.signedTxXdr ?? result;
    const freighter = (window as Window & { freighter?: FreighterApi }).freighter;
    if (!freighter) throw new Error("Freighter not found");
    const result = await freighter.signTransaction(xdr, {
      networkPassphrase: process.env.NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE || "Test SDF Network ; September 2015",
    });
    return typeof result === "string" ? result : (result.signedTxXdr ?? "");
  }, []);

  return (
    <WalletContext.Provider value={{ address, connect, disconnect, isConnecting, signTransaction }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
