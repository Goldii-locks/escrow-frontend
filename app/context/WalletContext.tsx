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
import { isGasFeeError } from "@/app/lib/errors";
import { useToast } from "./ToastContext";

export const STORAGE_KEY = "milesto_wallet_connected";

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
  const [networkMismatch, setNetworkMismatch] = useState(false);
  const initializedRef = useRef(false);
  const { showToast } = useToast();

  const checkNetwork = useCallback(async () => {
    try {
      const result = await StellarWalletsKit.getNetwork();
      setNetworkMismatch(result.networkPassphrase !== NETWORK_PASSPHRASE);
    } catch (e) {
      console.error("[NETWORK_SYNC_CHECKER_ERROR]: Failed to check network", e);
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
    if (localStorage.getItem(STORAGE_KEY) !== "true") return;

    ensureKitInitialized();

    let active = true;
    StellarWalletsKit.getAddress()
      .then(async (result: { address?: string }) => {
        if (!active) return;
        if (result.address) {
          setAddress(result.address);
          await checkNetwork();
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      })
      .catch(() => {
        // Previously-connected wallet is no longer reachable.
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
        await checkNetwork();
        localStorage.setItem(STORAGE_KEY, "true");
      }
    } catch (e) {
      console.error("[NETWORK_SYNC_CHECKER_ERROR]: Wallet connection failed", e);
      showToast("Failed to connect wallet.", "error");
    } finally {
      setIsConnecting(false);
    }
  }, [ensureKitInitialized, selectedWalletId, checkNetwork, showToast]);

  const disconnect = useCallback(() => {
    void Promise.resolve(StellarWalletsKit.disconnect()).catch((e: unknown) => {
      console.error("[NETWORK_SYNC_CHECKER_ERROR]: Wallet disconnect failed", e);
    });
    localStorage.removeItem(STORAGE_KEY);
    setNetworkMismatch(false);
    setAddress(null);
  }, []);

  const signTransaction = useCallback(async (xdr: string): Promise<string> => {
    if (!address) throw new Error("Wallet not connected");

    ensureKitInitialized();
    StellarWalletsKit.setWallet(selectedWalletId);

    try {
      const result = (await StellarWalletsKit.signTransaction(xdr, {
        address,
        networkPassphrase: NETWORK_PASSPHRASE,
      })) as KitSignResult;
      return result.signedTxXdr ?? "";
    } catch (e: any) {
      console.error("[NETWORK_SYNC_CHECKER_ERROR]: Transaction signing failed", e);

      const rawMessage: string = e?.message ?? "";
      let errorMessage = "Transaction failed.";

      if (isGasFeeError(rawMessage)) {
        const lower = rawMessage.toLowerCase();
        if (lower.includes("insufficient balance") || lower.includes("insufficient funds")) {
          errorMessage = "Insufficient account balance. Your wallet may not have enough XLM to cover the transaction fees.";
        } else if (lower.includes("budget") || lower.includes("soroban") || lower.includes("cpu") || lower.includes("memory") || lower.includes("ledger")) {
          errorMessage = "Gas estimation error: This transaction exceeds the Soroban resource budget. Try a smaller batch or wait for network conditions to improve.";
        } else if (lower.includes("max fee")) {
          errorMessage = "Gas estimation error: Network fees are higher than the current max fee setting. Please try again later.";
        } else {
          errorMessage = "Gas estimation error: Your transaction might be too expensive. Review the operation and try again.";
        }
      }

      showToast(errorMessage, "error");
      throw e;
    }
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
