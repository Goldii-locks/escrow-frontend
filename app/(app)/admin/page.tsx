"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/app/context/WalletContext";
import Navbar from "@/app/components/Navbar";
import AdminAccessGate from "@/app/components/AdminAccessGate";
import AdminWhitelistSkeleton from "@/app/components/AdminWhitelistSkeleton";
import ButtonSpinner from "@/app/components/ButtonSpinner";
import CopyButton from "@/app/components/CopyButton";
import TxStatusBanner from "@/app/components/TxStatusBanner";
import EscrowPicker from "@/app/components/EscrowPicker";
import FactoryAdminPanel from "@/app/components/FactoryAdminPanel";
import { useActionStates } from "@/app/hooks/useActionStates";
import { useIsAdmin } from "@/app/hooks/useIsAdmin";
import { useToast } from "@/app/context/ToastContext";
import { formatTxError } from "@/app/lib/errors";
import WhitelistConfirmModal from "@/app/components/WhitelistConfirmModal";
import AdminContractHeader from "@/app/components/AdminContractHeader";
import { adminPermissions, fetchEscrowFunded, type AdminPermissions } from "@/app/lib/admin";
import {
  containsCodeTags,
  downloadWhitelistCsv,
  getAddStatusBadge,
  getTokenStatusBadge,
  mapWhitelistResponse,
  sanitizeTokenAddress,
  type StatusBadge,
  type WhitelistAction,
  type WhitelistActionKind,
  type WhitelistEntry,
  whitelistErrorToast,
  whitelistExportEmptyToast,
  whitelistExportSuccessToast,
  whitelistLoadErrorToast,
  whitelistSuccessToast,
} from "@/app/lib/admin_whitelist_panel";
import {
  BACKEND_URL,
  FACTORY_CONTRACT_ID,
  getPhaseLabel,
  runContractAction,
  submitContractTransaction,
} from "@/app/lib/transactions";
import ContractPauseSwitch from "@/app/components/ContractPauseSwitch";
import {
  contractPauseErrorToast,
  contractPauseSuccessToast,
} from "@/app/lib/contract_pause_switch";

const PAUSE_KEY = "toggle-pause";

/**
 * /admin (#837, #838).
 *
 * - Factory section: tokens `create_escrow` accepts and the escrow WASM hash,
 *   for the factory admin.
 * - Escrow section: every escrow is its own contract, so the admin picks one;
 *   pause/resume and whitelist overrides then target that escrow.
 *
 * Access is per contract: the factory admin sees the factory section, and the
 * selected escrow's admin or delegated role holders see the escrow controls
 * their role allows (Operator: pause/resume; FeeManager: whitelist).
 */
export default function AdminPage() {
  const { address, signTransaction } = useWallet();
  const [selectedEscrow, setSelectedEscrow] = useState("");

  const factoryAccess = useIsAdmin(address, FACTORY_CONTRACT_ID);
  const escrowAccess = useIsAdmin(address, selectedEscrow);

  // With no factory configured the hook settles as "no access", not loading.
  const factoryIsAdmin = factoryAccess.isAdminUser;
  const escrowPermissions = adminPermissions({
    isAdmin: escrowAccess.isAdminUser,
    roles: escrowAccess.roles ?? [],
  });

  const accessLoading = factoryAccess.loading || (Boolean(selectedEscrow) && escrowAccess.loading);
  const hasAccess = factoryIsAdmin || escrowPermissions.hasAnyAccess;

  const headerAccess = selectedEscrow
    ? escrowPermissions
    : adminPermissions({
        isAdmin: factoryAccess.isAdminUser,
        roles: factoryAccess.roles ?? [],
      });

  return (
    <div className="min-h-screen bg-surface-page text-text-primary">
      <Navbar />
      <main
        className={`mx-auto px-6 py-12 ${
          address && hasAccess && !accessLoading ? "max-w-5xl" : "max-w-xl"
        }`}
      >
        <h1 className="text-2xl font-bold mb-2">Escrow Admin</h1>
        <p className="text-sm text-text-muted mb-8">
          Manage the escrow factory and individual escrows. Admin wallet or a delegated role
          required.
        </p>
        <AdminContractHeader
          contractId={selectedEscrow || FACTORY_CONTRACT_ID}
          contractLabel={selectedEscrow ? "Escrow" : "Factory"}
          {...(address ? { isAdmin: headerAccess.isAdmin, roles: headerAccess.roles } : {})}
        />

        <div className="space-y-8">
          {address && (
            <EscrowPicker address={address} value={selectedEscrow} onSelect={setSelectedEscrow} />
          )}

          <AdminAccessGate address={address} loading={accessLoading} isAdmin={hasAccess}>
            <div className="space-y-8">
              {factoryIsAdmin && FACTORY_CONTRACT_ID && address && (
                <FactoryAdminPanel
                  factoryId={FACTORY_CONTRACT_ID}
                  address={address}
                  signTransaction={signTransaction}
                />
              )}

              {selectedEscrow && address ? (
                <EscrowAdminControls
                  // Keyed so switching escrows starts from fresh state.
                  key={selectedEscrow}
                  contractId={selectedEscrow}
                  address={address}
                  signTransaction={signTransaction}
                  permissions={escrowPermissions}
                />
              ) : (
                <p data-testid="escrow-not-selected" className="text-sm text-text-muted">
                  Select an escrow above to pause, resume or manage its token whitelist.
                </p>
              )}
            </div>
          </AdminAccessGate>
        </div>
      </main>
    </div>
  );
}

/**
 * Pause/resume and whitelist overrides for one escrow, each shown only when
 * the wallet's role on that escrow allows it (#838).
 */
function EscrowAdminControls({
  contractId,
  address,
  signTransaction,
  permissions,
}: {
  contractId: string;
  address: string;
  signTransaction: (xdr: string) => Promise<string>;
  permissions: AdminPermissions;
}) {
  const { canPause, canManageWhitelist, hasAnyAccess } = permissions;
  const [tokenAddress, setTokenAddress] = useState("");
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [pendingAction, setPendingAction] = useState<WhitelistAction | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  // The escrow's whitelist is locked once it is funded, so the actions are
  // disabled then; platform-wide token control is the factory's (#572).
  const [escrowFunded, setEscrowFunded] = useState<boolean | null>(null);
  const { showToast } = useToast();
  const { getState, isPending, setPhase, setError, setTxHash } = useActionStates();

  const handlePauseToggle = useCallback(
    async (nextPaused: boolean) => {
      if (!canPause) return;
      let failure: string | null = null;
      const txHash = await runContractAction(
        PAUSE_KEY,
        async (onPhase) => {
          try {
            return await submitContractTransaction({
              contractId,
              // Separate pause and resume endpoints, each taking the caller
              // (the escrow admin or its Operator).
              method: nextPaused ? "admin_pause_escrow" : "admin_resume_escrow",
              args: [{ type: "address", value: address }],
              sourceAddress: address,
              signTransaction,
              onPhase,
            });
          } catch (err) {
            failure = formatTxError(err);
            throw err;
          }
        },
        { isPending, setPhase, setError, setTxHash }
      );

      if (txHash !== null) {
        const toast = contractPauseSuccessToast(nextPaused);
        showToast(toast.message, toast.type);
      } else if (failure !== null) {
        const toast = contractPauseErrorToast(failure);
        showToast(toast.message, toast.type);
      }
    },
    [
      canPause,
      contractId,
      address,
      signTransaction,
      showToast,
      isPending,
      setPhase,
      setError,
      setTxHash,
    ]
  );

  const fetchWhitelist = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/jobs/whitelisted-tokens?contractId=${encodeURIComponent(contractId)}`
      );
      const data = await res.json();
      const entries = mapWhitelistResponse(data);
      if (entries && (res.ok || data?.success)) {
        setWhitelist(entries);
      } else {
        const message = data?.error || "Could not load whitelisted tokens.";
        setListError(message);
        const toast = whitelistLoadErrorToast(message);
        showToast(toast.message, toast.type);
      }
    } catch {
      const message = "Could not connect to backend to load whitelist.";
      setListError(message);
      const toast = whitelistLoadErrorToast(message);
      showToast(toast.message, toast.type);
    } finally {
      setListLoading(false);
    }
  }, [contractId, showToast]);

  useEffect(() => {
    let active = true;

    // Only load the whitelist for wallets allowed to manage it.
    Promise.resolve().then(() => {
      if (active && canManageWhitelist) {
        void fetchWhitelist();
        void fetchEscrowFunded(contractId).then((funded) => {
          if (active) setEscrowFunded(funded);
        });
      }
    });

    return () => {
      active = false;
    };
  }, [contractId, canManageWhitelist, fetchWhitelist]);

  const executeTx = async (
    actionKey: string,
    action: WhitelistActionKind,
    token: string,
    method: string,
    args: { type: string; value: unknown }[]
  ) => {
    if (!canManageWhitelist) return;

    let failure: string | null = null;
    const txHash = await runContractAction(
      actionKey,
      async (onPhase) => {
        try {
          return await submitContractTransaction({
            contractId,
            method,
            args,
            sourceAddress: address,
            signTransaction,
            onPhase,
          });
        } catch (err) {
          failure = formatTxError(err);
          throw err;
        }
      },
      { isPending, setPhase, setError, setTxHash }
    );

    if (txHash !== null) {
      const toast = whitelistSuccessToast(action, token);
      showToast(toast.message, toast.type);
      if (action === "add") setTokenAddress("");
      await fetchWhitelist();
    } else if (failure !== null) {
      const toast = whitelistErrorToast(action, token, failure);
      showToast(toast.message, toast.type);
    }
  };

  const handleExport = () => {
    if (whitelist.length === 0) {
      const toast = whitelistExportEmptyToast();
      showToast(toast.message, toast.type);
      return;
    }
    downloadWhitelistCsv(whitelist.map((entry) => entry.address));
    const toast = whitelistExportSuccessToast(whitelist.length);
    showToast(toast.message, toast.type);
  };

  const whitelistLocked = escrowFunded === true;

  // Input containing code tags is ignored; the field keeps its previous value.
  const handleTokenAddressChange = (raw: string) => {
    if (containsCodeTags(raw)) return;
    setTokenAddress(sanitizeTokenAddress(raw));
  };

  // Submitting only opens the confirmation dialog; nothing is signed yet.
  const handleAddToken = (e: React.FormEvent) => {
    e.preventDefault();
    const token = sanitizeTokenAddress(tokenAddress);
    if (!token || whitelistLocked) return;
    setPendingAction({ kind: "add", token });
  };

  const handleRemoveToken = (token: string) => {
    if (whitelistLocked) return;
    setPendingAction({ kind: "remove", token });
  };

  const handleConfirm = async (action: WhitelistAction) => {
    setPendingAction(null);

    await executeTx(
      action.kind === "add" ? "add-token" : `remove-${action.token}`,
      action.kind,
      action.token,
      action.kind === "add" ? "add_whitelisted_token" : "remove_whitelisted_token",
      [
        { type: "address", value: address },
        { type: "address", value: action.token },
      ]
    );
  };

  const addState = getState("add-token");
  const addPending = isPending("add-token");
  const addBadge = getAddStatusBadge(addState.phase);

  if (!hasAnyAccess) {
    return (
      <p
        role="alert"
        data-testid="escrow-no-access"
        className="text-sm text-amber-300 border border-amber-800 bg-amber-950/40 rounded-lg px-4 py-3"
      >
        Your wallet is not the admin of this escrow and holds no delegated role on it.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {canPause ? (
        <>
          <ContractPauseSwitch
            contractId={contractId}
            isPending={isPending(PAUSE_KEY)}
            onToggle={handlePauseToggle}
          />
          {getState(PAUSE_KEY).phase !== "idle" && (
            <TxStatusBanner
              state={getState(PAUSE_KEY)}
              successMessage="Contract freeze state updated."
            />
          )}
        </>
      ) : (
        <p data-testid="pause-restricted" className="text-sm text-text-muted">
          Pausing and resuming this escrow requires the Operator role or the escrow admin.
        </p>
      )}

      {canManageWhitelist ? (
        <>
          <p data-testid="escrow-funded-status" className="text-sm text-text-muted">
            Escrow status:{" "}
            {escrowFunded === null ? "Unknown" : escrowFunded ? "Funded" : "Not funded"}
          </p>
          {whitelistLocked && (
            <p
              data-testid="whitelist-locked-notice"
              className="text-sm text-amber-300 border border-amber-800 bg-amber-950/40 rounded-lg px-4 py-3"
            >
              This escrow is funded, so its token whitelist can no longer be changed. The whitelist
              is per escrow and only editable before funding; platform-wide token management is on
              the escrow factory.
            </p>
          )}
          <div
            data-testid="whitelist-grid"
            className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start"
          >
            <form
              onSubmit={handleAddToken}
              className="space-y-4 border border-border-strong rounded-xl bg-surface-card p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Add Token</h2>
                {addBadge && <Badge badge={addBadge} testId="add-status-badge" />}
              </div>
              <div>
                <label htmlFor="token-address" className="block text-sm text-text-muted mb-1">
                  Token Contract Address
                </label>
                <input
                  id="token-address"
                  className="w-full bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  value={tokenAddress}
                  onChange={(e) => handleTokenAddressChange(e.target.value)}
                  placeholder="C..."
                  required
                  disabled={addPending}
                />
              </div>
              <button
                type="submit"
                disabled={addPending || whitelistLocked || !tokenAddress.trim()}
                className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-text-primary font-medium py-3 rounded-lg transition"
              >
                {addPending && <ButtonSpinner className="h-4 w-4" />}
                {addPending
                  ? getPhaseLabel(addState.phase) || "Processing..."
                  : "Add to Whitelist"}
              </button>
              <TxStatusBanner
                state={addState}
                successMessage="Token added to whitelist successfully."
              />
            </form>

            <section className="border border-border-strong rounded-xl bg-surface-card p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">Whitelisted Tokens</h2>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={listLoading}
                  className="inline-flex items-center justify-center min-h-[44px] text-xs bg-surface-field hover:bg-surface-raised disabled:opacity-50 border border-border-subtle text-text-primary px-4 py-2.5 rounded-lg transition"
                >
                  Export CSV
                </button>
              </div>
              {listLoading ? (
                <AdminWhitelistSkeleton variant="list" />
              ) : listError ? (
                <p role="alert" className="text-sm text-red-400">
                  {listError}
                </p>
              ) : whitelist.length === 0 ? (
                <p className="text-sm text-text-disabled">No whitelisted tokens found.</p>
              ) : (
                <ul className="space-y-2">
                  {whitelist.map(({ address: token, symbol, name }) => {
                    const removeKey = `remove-${token}`;
                    const removeState = getState(removeKey);
                    const removePending = isPending(removeKey);

                    return (
                      <li
                        key={token}
                        className="flex flex-col gap-2 bg-surface-field rounded-lg px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex flex-col min-w-0">
                            {(symbol || name) && (
                              <span className="text-sm font-medium truncate">
                                {symbol || name}
                              </span>
                            )}
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-sm truncate">{token}</span>
                              <CopyButton value={token} label="Token address" />
                            </span>
                          </span>
                          <Badge
                            badge={getTokenStatusBadge(removeState)}
                            testId={`status-badge-${token}`}
                          />
                          <button
                            onClick={() => handleRemoveToken(token)}
                            disabled={removePending || whitelistLocked}
                            className="inline-flex items-center justify-center gap-2 shrink-0 min-h-[44px] text-xs bg-red-800 hover:bg-red-700 disabled:opacity-50 text-text-primary px-4 py-2.5 rounded-lg transition"
                          >
                            {removePending && <ButtonSpinner />}
                            {removePending
                              ? getPhaseLabel(removeState.phase) || "Removing..."
                              : "Remove"}
                          </button>
                        </div>
                        <TxStatusBanner
                          state={removeState}
                          successMessage="Token removed from whitelist successfully."
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
          <WhitelistConfirmModal
            action={pendingAction}
            onCancel={() => setPendingAction(null)}
            onConfirm={handleConfirm}
            contractId={contractId}
          />
        </>
      ) : (
        <p data-testid="whitelist-restricted" className="text-sm text-text-muted">
          Managing this escrow&apos;s token whitelist requires the FeeManager role or the escrow
          admin.
        </p>
      )}
    </div>
  );
}

function Badge({ badge, testId }: { badge: StatusBadge; testId: string }) {
  return (
    <span data-testid={testId} data-status={badge.status} className={badge.className}>
      <span aria-hidden="true">{badge.icon}</span>
      {badge.label}
    </span>
  );
}
