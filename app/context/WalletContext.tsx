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
  useNetworkSyncChecker,
  type NetworkSyncState,
} from "@/app/hooks/useNetworkSyncChecker";
import {
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
} from "@/app/lib/network_sync_checker_cache";

const STORAGE_KEY = "milesto_wallet_connected";

export const SUPPORTED_WALLETS = [
  { id: "freighter", label: "Freighter" },
  { id: "albedo", label: "Albedo" },
  { id: "xbull", label: "xBull" },
  { id: "hana", label: "Hana" },
] as const;

export type SupportedWalletId = (typeof SUPPORTED_WALLETS)[number]["id"];

interface KitSignResult {
  signedTxXdr?: string;
}

interface WalletContextType {
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
  /** @deprecated Use networkSyncState.mismatch for richer network information. */
  networkMismatch: boolean;
  /** Full network sync state from the network_sync_checker module. */
  networkSyncState: NetworkSyncState;
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
  networkSyncState: { isChecking: false, mismatch: false, result: null, error: null },
  selectedWalletId: SUPPORTED_WALLETS[0].id,
  setSelectedWalletId: () => {},
  signTransaction: async () => "",
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<SupportedWalletId>(
    SUPPORTED_WALLETS[0].id
  );
  const initializedRef = useRef(false);
  const { showToast } = useToast();

  // Issue #156 / #158: delegate all network-sync work to the dedicated hook.
  const networkSyncState = useNetworkSyncChecker(address);

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
    // Issue #157: restore session from the richer persistent cache first;
    // fall back to the legacy boolean key for backwards-compatibility.
    const cached = loadActiveSession();
    const legacyConnected = localStorage.getItem(STORAGE_KEY) === "true";

    if (!cached && !legacyConnected) return;

    ensureKitInitialized();

    // Issue #157: restore the wallet provider selection from cache.
    // We schedule this asynchronously to avoid a synchronous setState-in-effect
    // that the react-hooks/set-state-in-effect lint rule disallows.
    let active = true;
    if (cached) {
      const isKnown = SUPPORTED_WALLETS.some((w) => w.id === cached.walletId);
      if (isKnown) {
        void Promise.resolve().then(() => {
          if (active) setSelectedWalletId(cached.walletId as SupportedWalletId);
        });
      }
    }
    StellarWalletsKit.getAddress()
      .then(async (result: { address?: string }) => {
        if (!active) return;
        if (result.address) {
          setAddress(result.address);
          // Refresh the persistent cache with the latest address.
          const walletId = cached?.walletId ?? SUPPORTED_WALLETS[0].id;
          saveActiveSession(result.address, walletId);
        } else {
          clearActiveSession();
          localStorage.removeItem(STORAGE_KEY);
        }
      })
      .catch(() => {
        // Previously-connected wallet is no longer reachable.
        clearActiveSession();
        localStorage.removeItem(STORAGE_KEY);
      });

    return () => {
      active = false;
    };
  }, [ensureKitInitialized]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      ensureKitInitialized();
      StellarWalletsKit.setWallet(selectedWalletId);

      const result = (await StellarWalletsKit.authModal()) as { address?: string };
      if (result.address) {
        setAddress(result.address);
        // Issue #157: persist the full session (address + walletId).
        saveActiveSession(result.address, selectedWalletId);
        localStorage.setItem(STORAGE_KEY, "true");
      }
    } catch (e) {
      console.error("Wallet connection failed", e);
      showToast("Failed to connect wallet.", "error");
    } finally {
      setIsConnecting(false);
    }
  }, [ensureKitInitialized, selectedWalletId, showToast]);

  const disconnect = useCallback(() => {
    StellarWalletsKit.disconnect().catch((e) => {
      console.error("Wallet disconnect failed", e);
    });
    // Issue #157: clear the persistent session cache on disconnect.
    clearActiveSession();
    localStorage.removeItem(STORAGE_KEY);
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
        networkMismatch: networkSyncState.mismatch,
        networkSyncState,
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
