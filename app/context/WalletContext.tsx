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
import { Networks, StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";
import {
  WalletConnectModule,
  WalletConnectTargetChain,
  type TWalletConnectModuleParams,
} from "@creit.tech/stellar-wallets-kit/modules/wallet-connect";
import { NETWORK_PASSPHRASE } from "@/app/lib/config";
import { useToast } from "./ToastContext";
import {
  ledgerActiveAddresses,
  checkSimulationFeeWarning,
  type LedgerSimulationResult,
  type LedgerGasWarningState,
} from "@/app/lib/ledger_usb_bridge";
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
import { submitContractTransaction, type ContractArg } from "@/app/lib/transactions";

const LEGACY_STORAGE_KEY = "milesto_wallet_connected";
const STORAGE_KEY = LEGACY_STORAGE_KEY;

const APP_NETWORK_DISPLAY = "Testnet";

function buildMismatchMessage(walletId: string, walletNetwork: string): string {
  const walletDisplay =
    walletId === "freighter"     ? "Freighter"      :
    walletId === "albedo"        ? "Albedo"          :
    walletId === "xbull"         ? "xBull"           :
    walletId === "hana"          ? "Hana"            :
    walletId === "lobstr"        ? "LOBSTR"          :
    walletId === "wallet_connect" ? "WalletConnect"  : "your wallet";

  return `Network mismatch: your ${walletDisplay} is on ${walletNetwork} but this app expects Stellar ${APP_NETWORK_DISPLAY}. Please switch networks.`;
}

export const SUPPORTED_WALLETS = [
  { id: "freighter", label: "Freighter" },
  { id: "albedo", label: "Albedo" },
  { id: "xbull", label: "xBull" },
  { id: "hana", label: "Hana" },
  { id: "lobstr", label: "LOBSTR" },
  { id: "wallet_connect", label: "WalletConnect" },
] as const;

export type SupportedWalletId = (typeof SUPPORTED_WALLETS)[number]["id"];

interface KitSignResult {
  signedTxXdr?: string;
}

interface PendingContractAction {
  method: string;
  args: ContractArg[];
  sourceAddress: string;
}

interface WalletContextType {
  address: string | null;
  assembleMultiSigTransaction: (
    splits: WalletMultiSigSplit[],
    options?: WalletMultiSigAssemblyOptions
  ) => Promise<WalletMultiSigAssemblyResult>;
  /**
   * Open the wallet flow. Pass `walletId` to connect a provider chosen in the
   * same event, before the `selectedWalletId` state update has rendered.
   */
  connect: (walletId?: SupportedWalletId) => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
  networkMismatchMessage: string | null;
  selectedWalletId: SupportedWalletId;
  setSelectedWalletId: (walletId: SupportedWalletId) => void;
  signTransaction: (xdr: string) => Promise<string>;
  signatureTimeoutError: WalletSignatureTimeoutError | null;
  signatureTimeoutXdr: string | null;
  clearSignatureTimeout: () => void;
  /** Last contract action submitted, kept so a timed-out signature can be retried with a fresh XDR. */
  lastPendingAction: PendingContractAction | null;
  /** Stage an action so {@link retryLastAction} can rebuild and re-sign it after a timeout. */
  registerPendingAction: (action: PendingContractAction) => void;
  /** Rebuild the last pending transaction (fresh XDR) and request a signature again. */
  retryLastAction: () => Promise<string | null>;
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
  lastPendingAction: null,
  registerPendingAction: () => {},
  retryLastAction: async () => null,
  simulationResult: null,
  setSimulationResult: () => {},
  gasWarning: null,
});

/** Shared transaction/debug tracker for the active wallet context store. */
const walletTracker = new WalletTransactionTracker();

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  // Start from the static default so prerendered markup and the first client
  // render match; the persisted choice is restored after mount below.
  const [selectedWalletId, setSelectedWalletId] = useState<SupportedWalletId>(
    SUPPORTED_WALLETS[0].id
  );

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      const persisted = walletStateStore.getActiveState();
      if (active && persisted?.selectedWalletId) {
        setSelectedWalletId(persisted.selectedWalletId as SupportedWalletId);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  const [networkMismatchMessage, setNetworkMismatchMessage] = useState<
    string | null
  >(null);
  const [signatureTimeoutError, setSignatureTimeoutError] =
    useState<WalletSignatureTimeoutError | null>(null);
  const [signatureTimeoutXdr, setSignatureTimeoutXdr] = useState<string | null>(
    null
  );
  /** Last contract action submitted, retained so a timed-out signature can be retried with a fresh XDR. */
  const [lastPendingAction, setLastPendingAction] =
    useState<PendingContractAction | null>(null);
  const [simulationResult, setSimulationResult] =
    useState<LedgerSimulationResult | null>(null);
  const initializedRef = useRef(false);
  const { showToast } = useToast();

  const gasWarning: LedgerGasWarningState | null = simulationResult
    ? checkSimulationFeeWarning(simulationResult)
    : null;

  const checkNetwork = useCallback(async () => {
    try {
      let walletPassphrase: string;

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
  }, [selectedWalletId]);

  const ensureKitInitialized = useCallback(() => {
    if (initializedRef.current) return;

    const allowedIds = new Set<string>(SUPPORTED_WALLETS.map((wallet) => wallet.id));

    // Build the WalletConnect module when a project ID is available.
    // NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID must be set at build time.
    const walletConnectProjectId =
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

    const wcModules = walletConnectProjectId
      ? (() => {
          const wcParams: TWalletConnectModuleParams = {
            projectId: walletConnectProjectId,
            metadata: {
              name: "Goldii Escrow",
              description: "Soroban milestone escrow on Stellar",
              url: typeof window !== "undefined" ? window.location.origin : "https://goldii.app",
              icons: [
                typeof window !== "undefined"
                  ? `${window.location.origin}/favicon.ico`
                  : "https://goldii.app/favicon.ico",
              ],
            },
            allowedChains: [WalletConnectTargetChain.TESTNET],
          };
          return [new WalletConnectModule(wcParams)];
        })()
      : [];

    // LobstrModule is included in defaultModules already; no extra config needed.
    StellarWalletsKit.init({
      modules: [
        ...defaultModules({
          filterBy: (module: { productId: string }) => allowedIds.has(module.productId),
        }),
        // Add WalletConnect separately (requires project ID configuration).
        ...wcModules,
      ],
      network: Networks.TESTNET,
      authModal: {
        showInstallLabel: true,
        hideUnsupportedWallets: false,
      },
    });

    initializedRef.current = true;
  }, []);

  const initialRehydrationDone = useRef(false);

  useEffect(() => {
    if (initialRehydrationDone.current) return;
    initialRehydrationDone.current = true;

    const persisted = walletStateStore.getActiveState();
    const hadLegacyFlag = localStorage.getItem(LEGACY_STORAGE_KEY) === "true";

    if (!persisted && !hadLegacyFlag) return;

    const walletId = persisted?.selectedWalletId ?? selectedWalletId;

    ensureKitInitialized();

    let active = true;

    const rehydrate = async () => {
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

      StellarWalletsKit.getAddress()
        .then(async (result: { address?: string }) => {
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
        })
        .catch(() => {
          if (!active) return;
          walletStateStore.clear();
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          setAddress(null);
        });
    };

    rehydrate();

    return () => {
      active = false;
    };
  }, [ensureKitInitialized, checkNetwork, selectedWalletId]);

  const connect = useCallback(async (requestedWalletId?: SupportedWalletId) => {
    // Guard against being wired straight to onClick, which passes an event.
    const walletId =
      typeof requestedWalletId === "string" ? requestedWalletId : selectedWalletId;
    setIsConnecting(true);
    walletTracker.track("connect", "connecting", "Opening wallet selector");
    try {
      await withWalletLoader(async () => {
        ensureKitInitialized();
        StellarWalletsKit.setWallet(walletId);

        const result = (await StellarWalletsKit.authModal()) as { address?: string };
        if (result.address) {
          setAddress(result.address);
          walletTracker.track("connect", "success", "Wallet connected");
          await checkNetwork();
          localStorage.setItem(STORAGE_KEY, "true");
          if (walletId === "freighter") {
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
        await StellarWalletsKit.disconnect();
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
  }, []);

  const signTransaction = useCallback(async (xdr: string): Promise<string> => {
    if (!address) throw new Error("Wallet not connected");
    setSignatureTimeoutError(null);
    setSignatureTimeoutXdr(null);

    return withWalletLoader(async () => {
      try {
        ensureKitInitialized();
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

  /** Stage the last submitted contract action so it can be retried after a signature timeout. */
  const registerPendingAction = useCallback(
    (action: PendingContractAction) => {
      setLastPendingAction(action);
    },
    []
  );

  /**
   * Rebuild the last pending transaction (fresh XDR from the backend) and
   * request a wallet signature again. Called by the global
   * SignatureTimeoutAlert after a signing timeout.
   */
  const retryLastAction = useCallback(async (): Promise<string | null> => {
    const action = lastPendingAction;
    if (!action) return null;
    // Clear the staged action so a stale retry cannot re-submit it twice.
    setLastPendingAction(null);
    try {
      return await submitContractTransaction({
        method: action.method,
        args: action.args,
        sourceAddress: action.sourceAddress,
        signTransaction,
      });
    } catch (err) {
      logWalletWarning("RETRY LAST ACTION FAILED", "Retrying the last contract action failed", {
        err: err instanceof Error ? err : new Error(String(err)),
        phase: "error",
      });
      return null;
    }
  }, [lastPendingAction, signTransaction]);

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
        lastPendingAction,
        registerPendingAction,
        retryLastAction,
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
