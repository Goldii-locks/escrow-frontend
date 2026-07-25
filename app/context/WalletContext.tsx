"use client";
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import {
  clearWalletState,
  deserializeWalletState,
  serializeWalletState,
  type StellarNetwork,
} from "@/app/lib/walletPersistence";

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

const NETWORK_PASSPHRASES: Record<StellarNetwork, string> = {
  testnet: "Test SDF Network ; September 2015",
  mainnet: "Public Global Stellar Network ; September 2015",
};

interface WalletContextType {
  address: string | null;
  network: StellarNetwork;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
  signTransaction: (xdr: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  network: "testnet",
  connect: async () => {},
  disconnect: () => {},
  isConnecting: false,
  signTransaction: async () => "",
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(() => deserializeWalletState()?.address ?? null);
  const [network, setNetwork] = useState<StellarNetwork>(
    () => deserializeWalletState()?.network ?? "testnet",
  );
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const freighter = (window as Window & { freighter?: FreighterApi }).freighter;
      if (!freighter) {
        alert("Please install the Freighter wallet extension.");
        return;
      }
      await freighter.requestAccess();
      const addr = await freighter.getPublicKey();
      const activeNetwork: StellarNetwork = "testnet";
      setAddress(addr);
      setNetwork(activeNetwork);
      serializeWalletState(addr, activeNetwork);
    } catch (e) {
      console.error("Wallet connection failed", e);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    clearWalletState();
  }, []);

  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      const freighter = (window as Window & { freighter?: FreighterApi }).freighter;
      if (!freighter) throw new Error("Freighter not found");
      const result = await freighter.signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASES[network],
      });
      return typeof result === "string" ? result : (result.signedTxXdr ?? "");
    },
    [network],
  );

  return (
    <WalletContext.Provider
      value={{ address, network, connect, disconnect, isConnecting, signTransaction }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
