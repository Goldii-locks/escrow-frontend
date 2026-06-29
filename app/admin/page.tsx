"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/app/context/WalletContext";
import Navbar from "@/app/components/Navbar";
import ButtonSpinner from "@/app/components/ButtonSpinner";
import TxStatusBanner from "@/app/components/TxStatusBanner";
import { useActionStates } from "@/app/hooks/useActionStates";
import { useIsAdmin } from "@/app/hooks/useIsAdmin";
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
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
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
      if (data.success && Array.isArray(data.data)) {
        setWhitelist(data.data);
      } else if (res.ok && Array.isArray(data)) {
        setWhitelist(data);
      } else {
        setListError(data.error || "Could not load whitelisted tokens.");
      }
    } catch {
      setListError("Could not connect to backend to load whitelist.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch whitelist if user is admin
    if (address && isAdminUser && !adminCheckLoading) {
      fetchWhitelist();
    }
  }, [address, isAdminUser, adminCheckLoading, fetchWhitelist]);

  const executeTx = async (
    actionKey: string,
    method: string,
    args: { type: string; value: unknown }[],
  ) => {
    if (!address) return;

    const txHash = await runContractAction(
      actionKey,
      (onPhase) =>
        submitContractTransaction({
          method,
          args,
          sourceAddress: address,
          signTransaction,
          onPhase,
        }),
      { isPending, setPhase, setError, setTxHash },
    );

    if (txHash !== null) {
      setTokenAddress("");
      await fetchWhitelist();
    }
  };

  const handleAddToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !tokenAddress.trim()) return;

    await executeTx("add-token", "add_whitelisted_token", [
      { type: "address", value: address },
      { type: "address", value: tokenAddress.trim() },
    ]);
  };

  const handleRemoveToken = async (token: string) => {
    if (!address) return;

    await executeTx(`remove-${token}`, "remove_whitelisted_token", [
      { type: "address", value: address },
      { type: "address", value: token },
    ]);
  };

  const addState = getState("add-token");
  const addPending = isPending("add-token");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <main className="max-w-xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-2">Token Whitelist Admin</h1>
        <p className="text-sm text-gray-400 mb-8">
          Manage whitelisted payment tokens for the escrow contract. Admin
          wallet required.
        </p>

        {!address ? (
          <p className="text-center text-gray-500">
            Connect your wallet to manage the whitelist.
          </p>
        ) : adminCheckLoading ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-2 text-gray-400">
              <ButtonSpinner className="h-5 w-5" />
              <span>Verifying admin access...</span>
            </div>
          </div>
        ) : !isAdminUser ? (
          <div
            role="alert"
            className="border border-red-800 bg-red-950/30 rounded-xl p-8 text-center space-y-3"
          >
            <div className="text-4xl" aria-hidden="true">
              🔒
            </div>
            <h2 className="text-lg font-semibold text-red-400">
              Access Denied
            </h2>
            <p className="text-sm text-gray-400">
              This page is restricted to the contract admin. Your wallet address
              does not have admin privileges.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <form
              onSubmit={handleAddToken}
              className="space-y-4 border border-gray-800 rounded-xl bg-gray-900 p-6"
            >
              <h2 className="font-semibold">Add Token</h2>
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
                  onChange={(e) => setTokenAddress(e.target.value)}
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
              <h2 className="font-semibold">Whitelisted Tokens</h2>
              {listLoading ? (
                <p className="text-sm text-gray-400">Loading whitelist...</p>
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
                  {whitelist.map((token) => {
                    const removeKey = `remove-${token}`;
                    const removeState = getState(removeKey);
                    const removePending = isPending(removeKey);

                    return (
                      <li
                        key={token}
                        className="flex flex-col gap-2 bg-gray-800 rounded-lg px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-sm truncate min-w-0">
                            {token}
                          </span>
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
        )}
      </main>
    </div>
  );
}
