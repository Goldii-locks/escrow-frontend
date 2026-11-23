"use client";
import { clearAllWalletSessionStorage } from "@/app/lib/wallet_session_storage_cleanup";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import { NETWORK_PASSPHRASE } from "@/app/lib/network_config";
import { useToast } from "./ToastContext";
import { ledgerActiveAddresses } from "@/app/lib/ledger_active_addresses";
import {
  checkSimulationFeeWarning,
  type LedgerSimulationResult,
  type LedgerGasWarningState,
} from "@/app/lib/simulation_fee_warning";
import { freighterActiveAddress, verifyAndRehydrateFreighterAddress } from "@/app/lib/freighter_connector";
import {
  logWalletWarning,
  validateMultiSigAssembly,
  withWalletLoader,
  WalletTransactionTracker,
  signWalletWithTimeout,
  type WalletMultiSigAssemblyOptions,
  type WalletMultiSigAssemblyResult,
  type WalletMultiSigSplit,
  WalletSignatureTimeoutError,
} from "@/app/lib/wallet_state_context";
import { walletStateStore } from "@/app/lib/wallet_state_store";
import { WalletRejectedError, isWalletRejectedError } from "@/app/lib/errors";

const LEGACY_STORAGE_KEY = "milesto_wallet_connected";
const STORAGE_KEY = LEGACY_STORAGE_KEY;

const APP_NETWORK_DISPLAY = "Testnet";

function buildMismatchMessage(walletId: string, walletNetwork: string): string {
  const walletDisplay =
    walletId === "freighter" ? "Freighter" :
    walletId === "albedo"   ? "Albedo"   :
    walletId === "xbull"    ? "xBull"    :
    walletId === "hana"     ? "Hana"     : "your wallet";

  return `Network mismatch: your ${walletDisplay} is on ${walletNetwork} but this app expects Stellar ${APP_NETWORK_DISPLAY}. Please switch networks.`;
}

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

type WalletKitBundle = {
  StellarWalletsKit: typeof import("@creit.tech/stellar-wallets-kit")["StellarWalletsKit"];
  defaultModules: typeof import("@creit.tech/stellar-wallets-kit/modules/utils")["defaultModules"];
};

let walletKitPromise: Promise<WalletKitBundle> | null = null;

/**
 * Loads the wallet kit only when a wallet operation actually needs it. The kit
 * pulls in every wallet module and the Stellar SDK, so keeping it out of the
 * provider's module scope is the main first-load win for #850.
 */
function loadWalletKit(): Promise<WalletKitBundle> {
  walletKitPromise ??= Promise.all([
    import("@creit.tech/stellar-wallets-kit"),
    import("@creit.tech/stellar-wallets-kit/modules/utils"),
  ]).then(([kit, modules]) => ({
    StellarWalletsKit: kit.StellarWalletsKit,
    defaultModules: modules.defaultModules,
  }));
  return walletKitPromise;
}

interface WalletContextType {
  address: string | null;
  assembleMultiSigTransaction: (
    splits: WalletMultiSigSplit[],
    options?: WalletMultiSigAssemblyOptions
  ) => Promise<WalletMultiSigAssemblyResult>;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
  networkMismatchMessage: string | null;
  selectedWalletId: SupportedWalletId;
  setSelectedWalletId: (walletId: SupportedWalletId) => void;
  signTransaction: (xdr: string) => Promise<string>;
  signatureTimeoutError: WalletSignatureTimeoutError | null;
  signatureTimeoutXdr: string | null;
  clearSignatureTimeout: () => void;
  /** Current simulation result used to derive gas/fee warning state. */
  simulationResult: LedgerSimulationResult | null;
  /** Set after a Soroban simulation completes; triggers fee warning evaluation. */
  setSimulationResult: (result: LedgerSimulationResult | null) => void;
  /** Derived gas/fee warning state from the latest simulation result. */
  gasWarning: LedgerGasWarningState | null;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  assembleMultiSigTransaction: async () => ({ uniqueSigners: 0, splitsValidated: 0 }),
  connect: async () => {},
  disconnect: () => {},
  isConnecting: false,
  networkMismatchMessage: null,
  selectedWalletId: SUPPORTED_WALLETS[0].id,
  setSelectedWalletId: () => {},
  signTransaction: async () => "",
  signatureTimeoutError: null,
  signatureTimeoutXdr: null,
  clearSignatureTimeout: () => {},
  simulationResult: null,
  setSimulationResult: () => {},
  gasWarning: null,
});

/** Shared transaction/debug tracker for the active wallet context store. */
const walletTracker = new WalletTransactionTracker();

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<SupportedWalletId>(() => {
    const persisted = walletStateStore.getActiveState();
    return persisted?.selectedWalletId as SupportedWalletId ?? SUPPORTED_WALLETS[0].id;
  });
  const [networkMismatchMessage, setNetworkMismatchMessage] = useState<
    string | null
  >(null);
  const [signatureTimeoutError, setSignatureTimeoutError] =
    useState<WalletSignatureTimeoutError | null>(null);
  const [signatureTimeoutXdr, setSignatureTimeoutXdr] = useState<string | null>(
    null
  );
  const [simulationResult, setSimulationResult] =
    useState<LedgerSimulationResult | null>(null);
  const initializedRef = useRef(false);
  const { showToast } = useToast();

  const gasWarning: LedgerGasWarningState | null = simulationResult
    ? checkSimulationFeeWarning(simulationResult)
    : null;

  const ensureKitInitialized = useCallback(async (): Promise<WalletKitBundle> => {
    const kit = await loadWalletKit();
    if (!initializedRef.current) {
      const allowedIds = new Set<string>(
        SUPPORTED_WALLETS.map((wallet) => wallet.id)
      );

      kit.StellarWalletsKit.init({
        modules: kit.defaultModules({
          filterBy: (module: { productId: string }) =>
            allowedIds.has(module.productId),
        }),
        network: NETWORK_PASSPHRASE,
        authModal: {
          showInstallLabel: true,
          hideUnsupportedWallets: false,
        },
      });

      initializedRef.current = true;
    }
    return kit;
  }, []);

  const checkNetwork = useCallback(async () => {
    try {
      let walletPassphrase: string;
      const { StellarWalletsKit } = await ensureKitInitialized();

      if (selectedWalletId === "freighter") {
        const activeAddr = freighterActiveAddress.getActiveAddress();
        walletPassphrase = activeAddr?.network ?? "";

        if (!walletPassphrase) {
          const result = await StellarWalletsKit.getNetwork();
          walletPassphrase = result.networkPassphrase;
        }
      } else {
        const result = await StellarWalletsKit.getNetwork();
        walletPassphrase = result.networkPassphrase;
      }

      const mismatched = walletPassphrase !== NETWORK_PASSPHRASE;
      setNetworkMismatchMessage(
        mismatched ? buildMismatchMessage(selectedWalletId, walletPassphrase) : null
      );
    } catch (e) {
      logWalletWarning("NETWORK CHECK FAILED", "Failed to check network", {
        err: e,
        phase: "error",
      });
      setNetworkMismatchMessage(null);
    }
  }, [ensureKitInitialized, selectedWalletId]);

  const initialRehydrationDone = useRef(false);

  useEffect(() => {
    if (initialRehydrationDone.current) return;
    initialRehydrationDone.current = true;

    const persisted = walletStateStore.getActiveState();
    const hadLegacyFlag = localStorage.getItem(LEGACY_STORAGE_KEY) === "true";

    // No saved session means the SDK-backed kit is never loaded on first load.
    if (!persisted && !hadLegacyFlag) return;

    const walletId = persisted?.selectedWalletId ?? selectedWalletId;
    let active = true;

    const rehydrate = async () => {
      let StellarWalletsKit: WalletKitBundle["StellarWalletsKit"];
      try {
        ({ StellarWalletsKit } = await ensureKitInitialized());
      } catch (e) {
        logWalletWarning("REHYDRATE FAILED", "Failed to load wallet kit", {
          err: e,
          phase: "error",
        });
        if (active) setAddress(null);
        return;
      }

      if (!active) return;

      if (walletId === "freighter") {
        try {
          const verifiedAddress = await verifyAndRehydrateFreighterAddress();
          if (!active) return;
          if (verifiedAddress) {
            setAddress(verifiedAddress);
            await checkNetwork();

            if (!persisted) {
              walletStateStore.setActiveState({
                address: verifiedAddress,
                selectedWalletId: "freighter",
                networkPassphrase: NETWORK_PASSPHRASE,
                connectedAt: Date.now(),
              });
            }

            localStorage.removeItem(LEGACY_STORAGE_KEY);
            return;
          }
        } catch (e) {
          logWalletWarning(
            "REHYDRATE FAILED",
            "Failed to rehydrate freighter active address",
            { err: e, phase: "error" }
          );
        }

        if (!active) return;
        walletStateStore.clear();
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        setAddress(null);
        return;
      }

      try {
        const result = (await StellarWalletsKit.getAddress()) as {
          address?: string;
        };
        if (!active) return;
        if (result.address) {
          setAddress(result.address);
          await checkNetwork();

          if (!persisted) {
            walletStateStore.setActiveState({
              address: result.address,
              selectedWalletId: walletId,
              networkPassphrase: NETWORK_PASSPHRASE,
              connectedAt: Date.now(),
            });
          }

          localStorage.removeItem(LEGACY_STORAGE_KEY);
        } else {
          walletStateStore.clear();
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          setAddress(null);
        }
      } catch {
        if (!active) return;
        walletStateStore.clear();
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        setAddress(null);
      }
    };

    void rehydrate();

    return () => {
      active = false;
    };
  }, [ensureKitInitialized, checkNetwork, selectedWalletId]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    walletTracker.track("connect", "connecting", "Opening wallet selector");
    try {
      await withWalletLoader(async () => {
        const { StellarWalletsKit } = await ensureKitInitialized();
        StellarWalletsKit.setWallet(selectedWalletId);

        const result = (await StellarWalletsKit.authModal()) as { address?: string };
        if (result.address) {
          setAddress(result.address);
          walletTracker.track("connect", "success", "Wallet connected");
          await checkNetwork();
          localStorage.setItem(STORAGE_KEY, "true");
          if (selectedWalletId === "freighter") {
            freighterActiveAddress.setActiveAddress({
              address: result.address,
              network: NETWORK_PASSPHRASE,
              connectedAt: Date.now(),
            });
          }
        }
      });
    } catch (e) {
      walletTracker.track("connect", "error", "Wallet connection failed", e);
      showToast("Failed to connect wallet.", "error");
    } finally {
      setIsConnecting(false);
    }
  }, [ensureKitInitialized, selectedWalletId, checkNetwork, showToast]);

  const disconnect = useCallback(() => {
    void withWalletLoader(async () => {
      try {
        // Do not load the kit just to disconnect a session that never used it.
        if (walletKitPromise) {
          const { StellarWalletsKit } = await ensureKitInitialized();
          await StellarWalletsKit.disconnect();
        }
      } catch (e) {
        walletTracker.track("disconnect", "error", "Wallet disconnect failed", e);
      }
    });
    walletStateStore.clear();
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    ledgerActiveAddresses.clear();
    freighterActiveAddress.clear();
    clearAllWalletSessionStorage();
    setNetworkMismatchMessage(null);
    setAddress(null);
  }, [ensureKitInitialized]);

  const signTransaction = useCallback(async (xdr: string): Promise<string> => {
    if (!address) throw new Error("Wallet not connected");
    setSignatureTimeoutError(null);
    setSignatureTimeoutXdr(null);

    return withWalletLoader(async () => {
      try {
        const { StellarWalletsKit } = await ensureKitInitialized();
        StellarWalletsKit.setWallet(selectedWalletId);

        const result = await signWalletWithTimeout(
          { xdr },
          async (transactionXdr) =>
            (await StellarWalletsKit.signTransaction(transactionXdr, {
              address,
              networkPassphrase: NETWORK_PASSPHRASE,
            })) as KitSignResult
        );

        return result.signedTxXdr ?? "";
      } catch (e) {
        const rejected = isWalletRejectedError(e);
        walletTracker.track(
          "sign",
          "error",
          rejected
            ? "Wallet signTransaction rejected by user"
            : "Wallet signTransaction failed",
          e
        );

        if (e instanceof WalletSignatureTimeoutError) {
          setSignatureTimeoutError(e);
          setSignatureTimeoutXdr(xdr);
        }

        // A user declining in their wallet is an expected outcome, not a
        // fault: surface it as a warning and normalise it to
        // WalletRejectedError so callers can branch on it. Every other
        // failure is rethrown untouched.
        if (rejected) {
          showToast(
            "Signature cancelled - you rejected the request in your wallet.",
            "warning"
          );
          throw new WalletRejectedError();
        }

        throw e;
      }
    });
  }, [address, ensureKitInitialized, selectedWalletId, showToast]);

  const clearSignatureTimeout = useCallback(() => {
    setSignatureTimeoutError(null);
    setSignatureTimeoutXdr(null);
  }, []);

  const assembleMultiSigTransaction = useCallback(
    async (
      splits: WalletMultiSigSplit[],
      options?: WalletMultiSigAssemblyOptions
    ): Promise<WalletMultiSigAssemblyResult> => {
      return withWalletLoader(async () => {
        try {
          return validateMultiSigAssembly(splits, options);
        } catch (e) {
          walletTracker.track(
            "multisig",
            "error",
            "Multi-sig transaction assembly failed",
            e
          );
          throw e;
        }
      });
    },
    []
  );

  return (
    <WalletContext.Provider
      value={{
        address,
        assembleMultiSigTransaction,
        connect,
        disconnect,
        isConnecting,
        networkMismatchMessage,
        selectedWalletId,
        setSelectedWalletId,
        signTransaction,
        signatureTimeoutError,
        signatureTimeoutXdr,
        clearSignatureTimeout,
        simulationResult,
        setSimulationResult,
        gasWarning,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
