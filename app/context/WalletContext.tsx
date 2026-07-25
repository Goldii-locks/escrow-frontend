"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import { Networks, StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";
import { NETWORK_PASSPHRASE } from "@/app/lib/contract";
import { useToast } from "./ToastContext";
import {
  loadFreighterState,
  saveFreighterState,
  clearFreighterState,
  passphraseToNetwork,
  DEFAULT_FREIGHTER_WALLET_ID,
  type SupportedFreighterWalletId,
} from "@/app/lib/freighter_connector";

const STORAGE_KEY = "milesto_wallet_connected";

export const SUPPORTED_WALLETS: {
  id: SupportedFreighterWalletId;
  label: string;
}[] = [
  { id: "freighter", label: "Freighter" },
  { id: "albedo", label: "Albedo" },
  { id: "xbull", label: "xBull" },
  { id: "hana", label: "Hana" },
];

export type SupportedWalletId = SupportedFreighterWalletId;

interface KitSignResult {
  signedTxXdr?: string;
}

interface WalletContextType {
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
  networkMismatch: boolean;
  selectedWalletId: SupportedWalletId;
  setSelectedWalletId: (walletId: SupportedWalletId) => void;
  signTransaction: (xdr: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  connect: async () => {},
  disconnect: () => {},
  isConnecting: false,
  networkMismatch: false,
  selectedWalletId: DEFAULT_FREIGHTER_WALLET_ID,
  setSelectedWalletId: () => {},
  signTransaction: async () => "",
});

function readInitialWalletId(): SupportedFreighterWalletId {
  if (typeof window === "undefined") return DEFAULT_FREIGHTER_WALLET_ID;
  try {
    return loadFreighterState().selectedWalletId;
  } catch {
    return DEFAULT_FREIGHTER_WALLET_ID;
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<SupportedWalletId>(
    () => readInitialWalletId()
  );
  const [networkMismatch, setNetworkMismatch] = useState(false);
  const initializedRef = useRef(false);
  const { showToast } = useToast();

  const checkNetwork = useCallback(async () => {
    try {
      const result = await StellarWalletsKit.getNetwork();
      setNetworkMismatch(result.networkPassphrase !== NETWORK_PASSPHRASE);
    } catch (e) {
      console.error("Failed to check network", e);
      setNetworkMismatch(false);
    }
  }, []);

  const ensureKitInitialized = useCallback(() => {
    if (initializedRef.current) return;

    const allowedIds = new Set<string>(SUPPORTED_WALLETS.map((wallet) => wallet.id));

    StellarWalletsKit.init({
      modules: defaultModules({
        filterBy: (module: { productId: string }) => allowedIds.has(module.productId),
      }),
      network: Networks.TESTNET,
      authModal: {
        showInstallLabel: true,
        hideUnsupportedWallets: false,
      },
    });

    initializedRef.current = true;
  }, []);

  useEffect(() => {
    const restored = loadFreighterState();
    if (!restored.restored || !restored.address) {
      if (localStorage.getItem(STORAGE_KEY) === "true") {
        localStorage.removeItem(STORAGE_KEY);
      }
      return;
    }

    ensureKitInitialized();
    StellarWalletsKit.setWallet(restored.selectedWalletId);

    let active = true;
    StellarWalletsKit.getAddress()
      .then(async (result: { address?: string }) => {
        if (!active) return;
        if (result.address && result.address === restored.address) {
          setAddress(result.address);
          await checkNetwork();
        } else if (result.address) {
          setAddress(result.address);
          const netResult = await StellarWalletsKit.getNetwork().catch(() => null);
          const network = netResult
            ? passphraseToNetwork(netResult.networkPassphrase) ?? restored.network
            : restored.network;
          if (network) {
            saveFreighterState({
              address: result.address,
              selectedWalletId: restored.selectedWalletId,
              network,
            });
          }
          await checkNetwork();
        } else {
          clearFreighterState();
          localStorage.removeItem(STORAGE_KEY);
        }
      })
      .catch(() => {
        clearFreighterState();
        localStorage.removeItem(STORAGE_KEY);
      });

    return () => {
      active = false;
    };
  }, [ensureKitInitialized, checkNetwork]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      ensureKitInitialized();
      StellarWalletsKit.setWallet(selectedWalletId);

      const result = (await StellarWalletsKit.authModal()) as { address?: string };
      if (result.address) {
        setAddress(result.address);
        const netResult = await StellarWalletsKit.getNetwork().catch(() => null);
        const network = netResult
          ? passphraseToNetwork(netResult.networkPassphrase) ?? "testnet"
          : "testnet";
        saveFreighterState({
          address: result.address,
          selectedWalletId,
          network,
        });
        localStorage.setItem(STORAGE_KEY, "true");
        await checkNetwork();
      }
    } catch (e) {
      console.error("Wallet connection failed", e);
      showToast("Failed to connect wallet.", "error");
    } finally {
      setIsConnecting(false);
    }
  }, [ensureKitInitialized, selectedWalletId, checkNetwork, showToast]);

  const disconnect = useCallback(() => {
    StellarWalletsKit.disconnect().catch((e) => {
      console.error("Wallet disconnect failed", e);
    });
    clearFreighterState();
    localStorage.removeItem(STORAGE_KEY);
    setNetworkMismatch(false);
    setAddress(null);
  }, []);

  const signTransaction = useCallback(async (xdr: string): Promise<string> => {
    if (!address) throw new Error("Wallet not connected");

    ensureKitInitialized();
    StellarWalletsKit.setWallet(selectedWalletId);

    const result = (await StellarWalletsKit.signTransaction(xdr, {
      address,
      networkPassphrase: NETWORK_PASSPHRASE,
    })) as KitSignResult;

    return result.signedTxXdr ?? "";
  }, [address, ensureKitInitialized, selectedWalletId]);

  return (
    <WalletContext.Provider
      value={{
        address,
        connect,
        disconnect,
        isConnecting,
        networkMismatch,
        selectedWalletId,
        setSelectedWalletId,
        signTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
