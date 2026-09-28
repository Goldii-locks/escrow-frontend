"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/app/context/WalletContext";
import Navbar from "@/app/components/Navbar";
import AdminAccessGate from "@/app/components/AdminAccessGate";
import AdminWhitelistSkeleton from "@/app/components/AdminWhitelistSkeleton";
import ButtonSpinner from "@/app/components/ButtonSpinner";
import TxStatusBanner from "@/app/components/TxStatusBanner";
import { useActionStates } from "@/app/hooks/useActionStates";
import { useIsAdmin } from "@/app/hooks/useIsAdmin";
import { useToast } from "@/app/context/ToastContext";
import { formatTxError } from "@/app/lib/errors";
import WhitelistConfirmModal from "@/app/components/WhitelistConfirmModal";
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
  CONTRACT_ID,
  getPhaseLabel,
  runContractAction,
  submitContractTransaction,
} from "@/app/lib/transactions";

export default function AdminPage() {
  const { address, signTransaction } = useWallet();
  const { loading: adminCheckLoading, isAdminUser } = useIsAdmin(address);
  const [tokenAddress, setTokenAddress] = useState("");
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [pendingAction, setPendingAction] = useState<WhitelistAction | null>(
    null,
  );
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const { showToast } = useToast();
  const { getState, isPending, setPhase, setError, setTxHash } =
    useActionStates();

  const fetchWhitelist = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/jobs/whitelisted-tokens?contractId=${CONTRACT_ID}`,
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
  }, [showToast]);

  useEffect(() => {
    let active = true;

    // Only fetch whitelist if user is admin
    Promise.resolve().then(() => {
      if (active && address && isAdminUser && !adminCheckLoading) {
        void fetchWhitelist();
      }
    });

    return () => {
      active = false;
    };
  }, [address, isAdminUser, adminCheckLoading, fetchWhitelist]);

  const executeTx = async (
    actionKey: string,
    action: WhitelistActionKind,
    token: string,
    method: string,
    args: { type: string; value: unknown }[],
  ) => {
    if (!address) return;

    let failure: string | null = null;
    const txHash = await runContractAction(
      actionKey,
      async (onPhase) => {
        try {
          return await submitContractTransaction({
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
      { isPending, setPhase, setError, setTxHash },
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

  // Input containing code tags is ignored; the field keeps its previous value.
  const handleTokenAddressChange = (raw: string) => {
    if (containsCodeTags(raw)) return;
    setTokenAddress(sanitizeTokenAddress(raw));
  };

  // Submitting only opens the confirmation dialog; nothing is signed yet.
  const handleAddToken = (e: React.FormEvent) => {
    e.preventDefault();
    const token = sanitizeTokenAddress(tokenAddress);
    if (!address || !token) return;
    setPendingAction({ kind: "add", token });
  };

  const handleRemoveToken = (token: string) => {
    if (!address) return;
    setPendingAction({ kind: "remove", token });
  };

  const handleConfirm = async (action: WhitelistAction) => {
    setPendingAction(null);
    if (!address) return;

    await executeTx(
      action.kind === "add" ? "add-token" : `remove-${action.token}`,
      action.kind,
      action.token,
      action.kind === "add" ? "add_whitelisted_token" : "remove_whitelisted_token",
      [
        { type: "address", value: address },
        { type: "address", value: action.token },
      ],
    );
  };

  const addState = getState("add-token");
  const addPending = isPending("add-token");
  const addBadge = getAddStatusBadge(addState.phase);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <main
        className={`mx-auto px-6 py-12 ${
          address && isAdminUser && !adminCheckLoading
            ? "max-w-5xl"
            : "max-w-xl"
        }`}
      >
        <h1 className="text-2xl font-bold mb-2">Token Whitelist Admin</h1>
        <p className="text-sm text-gray-400 mb-8">
          Manage whitelisted payment tokens for the escrow contract. Admin
          wallet required.
        </p>

        <AdminAccessGate
          address={address}
          loading={adminCheckLoading}
          isAdmin={isAdminUser}
        >
          <div
            data-testid="whitelist-grid"
            className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start"
          >
            <form
              onSubmit={handleAddToken}
              className="space-y-4 border border-gray-800 rounded-xl bg-gray-900 p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Add Token</h2>
                {addBadge && <Badge badge={addBadge} testId="add-status-badge" />}
              </div>
              <div>
                <label
                  htmlFor="token-address"
                  className="block text-sm text-gray-400 mb-1"
                >
                  Token Contract Address
                </label>
                <input
                  id="token-address"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  value={tokenAddress}
                  onChange={(e) => handleTokenAddressChange(e.target.value)}
                  placeholder="C..."
                  required
                  disabled={addPending}
                />
              </div>
              <button
                type="submit"
                disabled={addPending || !tokenAddress.trim()}
                className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition"
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

            <section className="border border-gray-800 rounded-xl bg-gray-900 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold">Whitelisted Tokens</h2>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={listLoading}
                  className="inline-flex items-center justify-center min-h-[44px] text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 text-white px-4 py-2.5 rounded-lg transition"
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
                <p className="text-sm text-gray-500">
                  No whitelisted tokens found.
                </p>
              ) : (
                <ul className="space-y-2">
                  {whitelist.map(({ address: token, symbol, name }) => {
                    const removeKey = `remove-${token}`;
                    const removeState = getState(removeKey);
                    const removePending = isPending(removeKey);

                    return (
                      <li
                        key={token}
                        className="flex flex-col gap-2 bg-gray-800 rounded-lg px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex flex-col min-w-0">
                            {(symbol || name) && (
                              <span className="text-sm font-medium truncate">
                                {symbol || name}
                              </span>
                            )}
                            <span className="font-mono text-sm truncate">
                              {token}
                            </span>
                          </span>
                          <Badge
                            badge={getTokenStatusBadge(removeState)}
                            testId={`status-badge-${token}`}
                          />
                          <button
                            onClick={() => handleRemoveToken(token)}
                            disabled={removePending}
                            className="inline-flex items-center justify-center gap-2 shrink-0 min-h-[44px] text-xs bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg transition"
                          >
                            {removePending && <ButtonSpinner />}
                            {removePending
                              ? getPhaseLabel(removeState.phase) ||
                                "Removing..."
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
        </AdminAccessGate>
      </main>
      <WhitelistConfirmModal
        action={pendingAction}
        onCancel={() => setPendingAction(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

function Badge({ badge, testId }: { badge: StatusBadge; testId: string }) {
  return (
    <span
      data-testid={testId}
      data-status={badge.status}
      className={badge.className}
    >
      <span aria-hidden="true">{badge.icon}</span>
      {badge.label}
    </span>
  );
}
