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
import { NETWORK_PASSPHRASE } from "@/app/lib/config";
import { assertWalletNetwork } from "@/app/lib/network";
import { useToast } from "./ToastContext";
import {
  checkSimulationFeeWarning,
  freighterActiveAddress,
  verifyAndRehydrateFreighterAddress,
  type WalletSimulationResult,
  type WalletGasWarningState,
} from "@/app/lib/wallet_session";
import {
  logWalletWarning,
  validateMultiSigAssembly,
  withWalletLoader,
  WalletTransactionTracker,
  signWalletWithTimeout,
  DEFAULT_WALLET_SIGNATURE_TIMEOUT_MS,
  type WalletMultiSigAssemblyOptions,
  type WalletMultiSigAssemblyResult,
  type WalletMultiSigSplit,
  WalletSignatureTimeoutError,
  readTransactionMaxTimeSecs,
} from "@/app/lib/wallet_state_context";
import { walletStateStore } from "@/app/lib/wallet_state_store";
import {
  WalletRejectedError,
  WalletUnavailableError,
  isWalletAvailabilityError,
  isWalletRejectedError,
} from "@/app/lib/errors";
import { submitContractTransaction, type ContractArg } from "@/app/lib/transactions";

const LEGACY_STORAGE_KEY = "milesto_wallet_connected";
const STORAGE_KEY = LEGACY_STORAGE_KEY;

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
  simulationResult: WalletSimulationResult | null;
  /** Set after a Soroban simulation completes; triggers fee warning evaluation. */
  setSimulationResult: (result: WalletSimulationResult | null) => void;
  /** Derived gas/fee warning state from the latest simulation result. */
  gasWarning: WalletGasWarningState | null;
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
  const [networkMismatchMessage, setNetworkMismatchMessage] = useState<string | null>(null);
  const [signatureTimeoutError, setSignatureTimeoutError] =
    useState<WalletSignatureTimeoutError | null>(null);
  const [signatureTimeoutXdr, setSignatureTimeoutXdr] = useState<string | null>(null);
  /** Last contract action submitted, retained so a timed-out signature can be retried with a fresh XDR. */
  const [lastPendingAction, setLastPendingAction] = useState<PendingContractAction | null>(null);
  const [simulationResult, setSimulationResult] = useState<WalletSimulationResult | null>(null);
  const kitInitRef = useRef<Promise<void> | null>(null);
  const { showToast } = useToast();

  const gasWarning: WalletGasWarningState | null = simulationResult
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

      const walletLabel = SUPPORTED_WALLETS.find((w) => w.id === selectedWalletId)?.label;
      setNetworkMismatchMessage(assertWalletNetwork(walletPassphrase, walletLabel));
    } catch (e) {
      logWalletWarning("NETWORK CHECK FAILED", "Failed to check network", {
        err: e,
        phase: "error",
      });
      setNetworkMismatchMessage(null);
    }
  }, [selectedWalletId]);

  const ensureKitInitialized = useCallback((): Promise<void> => {
    if (kitInitRef.current) return kitInitRef.current;

    kitInitRef.current = (async () => {
      const allowedIds = new Set<string>(SUPPORTED_WALLETS.map((wallet) => wallet.id));

      // WalletConnect pulls in a large SDK, so it is only downloaded when a
      // project ID was set at build time (NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID).
      const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";
      const wcModules = [];
      if (walletConnectProjectId) {
        const { WalletConnectModule, WalletConnectTargetChain } = await import(
          "@creit.tech/stellar-wallets-kit/modules/wallet-connect"
        );
        wcModules.push(
          new WalletConnectModule({
            projectId: walletConnectProjectId,
            metadata: {
              name: "Goldii Escrow",
              description: "Soroban milestone escrow on Stellar",
              url: window.location.origin,
              icons: [`${window.location.origin}/favicon.ico`],
            },
            allowedChains: [WalletConnectTargetChain.TESTNET],
          })
        );
      }

      // LobstrModule is included in defaultModules already; no extra config needed.
      StellarWalletsKit.init({
        modules: [
          ...defaultModules({
            filterBy: (module: { productId: string }) => allowedIds.has(module.productId),
          }),
          ...wcModules,
        ],
        network: Networks.TESTNET,
        authModal: {
          showInstallLabel: true,
          hideUnsupportedWallets: false,
        },
      });
    })();

    return kitInitRef.current;
  }, []);

  const initialRehydrationDone = useRef(false);

  useEffect(() => {
    if (initialRehydrationDone.current) return;
    initialRehydrationDone.current = true;

    const persisted = walletStateStore.getActiveState();
    const hadLegacyFlag = localStorage.getItem(LEGACY_STORAGE_KEY) === "true";

    if (!persisted && !hadLegacyFlag) return;

    const walletId = persisted?.selectedWalletId ?? selectedWalletId;

    let active = true;

    const rehydrate = async () => {
      await ensureKitInitialized();
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
          logWalletWarning("REHYDRATE FAILED", "Failed to rehydrate freighter active address", {
            err: e,
            phase: "error",
          });
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

  const connect = useCallback(
    async (requestedWalletId?: SupportedWalletId) => {
      // Guard against being wired straight to onClick, which passes an event.
      const walletId = typeof requestedWalletId === "string" ? requestedWalletId : selectedWalletId;
      setIsConnecting(true);
      walletTracker.track("connect", "connecting", "Opening wallet selector");
      try {
        await withWalletLoader(async () => {
          await ensureKitInitialized();
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
    },
    [ensureKitInitialized, selectedWalletId, checkNetwork, showToast]
  );

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
    freighterActiveAddress.clear();
    clearAllWalletSessionStorage();
    setNetworkMismatchMessage(null);
    setAddress(null);
  }, []);

  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      if (!address) throw new Error("Wallet not connected");
      if (networkMismatchMessage) throw new Error(networkMismatchMessage);
      setSignatureTimeoutError(null);
      setSignatureTimeoutXdr(null);

      return withWalletLoader(async () => {
        try {
          await ensureKitInitialized();
          StellarWalletsKit.setWallet(selectedWalletId);

          // Single timeout source (#628): derive the bound from the
          // transaction's own maxTime when it advertises one, falling back to
          // the default bound. The wallet context owns the timeout, the
          // sensitive-memory cleanup, and the `signatureTimeoutError` alert
          // state — `submitContractTransaction` no longer wraps the call.
          const maxTimeSecs = readTransactionMaxTimeSecs(xdr);
          const timeoutMs =
            maxTimeSecs !== null
              ? Math.min(maxTimeSecs * 1000, DEFAULT_WALLET_SIGNATURE_TIMEOUT_MS)
              : DEFAULT_WALLET_SIGNATURE_TIMEOUT_MS;

          const result = await signWalletWithTimeout(
            { xdr },
            async (transactionXdr) =>
              (await StellarWalletsKit.signTransaction(transactionXdr, {
                address,
                networkPassphrase: NETWORK_PASSPHRASE,
              })) as KitSignResult,
            timeoutMs
          );

          return result.signedTxXdr ?? "";
        } catch (e) {
          const rejected = isWalletRejectedError(e);
          walletTracker.track(
            "sign",
            "error",
            rejected ? "Wallet signTransaction rejected by user" : "Wallet signTransaction failed",
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
            showToast("Signature cancelled - you rejected the request in your wallet.", "warning");
            throw new WalletRejectedError();
          }

          // Name the wallet the user actually picked, so formatTxError links
          // to its install page rather than Freighter's (#687).
          if (isWalletAvailabilityError(e) && !(e instanceof WalletUnavailableError)) {
            throw new WalletUnavailableError(selectedWalletId);
          }

          throw e;
        }
      });
    },
    [address, networkMismatchMessage, ensureKitInitialized, selectedWalletId, showToast]
  );

  const clearSignatureTimeout = useCallback(() => {
    setSignatureTimeoutError(null);
    setSignatureTimeoutXdr(null);
  }, []);

  /** Stage the last submitted contract action so it can be retried after a signature timeout. */
  const registerPendingAction = useCallback((action: PendingContractAction) => {
    setLastPendingAction(action);
  }, []);

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
          walletTracker.track("multisig", "error", "Multi-sig transaction assembly failed", e);
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
