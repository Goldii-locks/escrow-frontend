"use client";

import { useCallback, useEffect, useState } from "react";
import ButtonSpinner from "@/app/components/ButtonSpinner";
import CopyButton from "@/app/components/CopyButton";
import TxStatusBanner from "@/app/components/TxStatusBanner";
import { useActionStates } from "@/app/hooks/useActionStates";
import { useToast } from "@/app/context/ToastContext";
import { formatTxError } from "@/app/lib/errors";
import {
  FACTORY_METHODS,
  factoryTokenArgs,
  fetchFactoryAllowedTokens,
  fetchFactoryWasmHash,
  isContractAddress,
} from "@/app/lib/factory_admin";
import {
  getPhaseLabel,
  runContractAction,
  submitContractTransaction,
} from "@/app/lib/transactions";

export interface FactoryAdminPanelProps {
  /** The escrow factory contract. */
  factoryId: string;
  /** Connected factory admin; signs `allow_token` / `disallow_token`. */
  address: string;
  signTransaction: (xdr: string) => Promise<string>;
  /** Show the remove buttons; off for factories without `disallow_token`. */
  supportsRemoval?: boolean;
}

const ADD_KEY = "factory-allow-token";
const removeKey = (token: string) => `factory-disallow-${token}`;

/**
 * Factory administration (#837): the tokens `create_escrow` accepts, and the
 * WASM hash new escrows are deployed from. Replaces the per-escrow whitelist
 * as the platform-wide token control (#572).
 */
export default function FactoryAdminPanel({
  factoryId,
  address,
  signTransaction,
  supportsRemoval = true,
}: FactoryAdminPanelProps) {
  const { showToast } = useToast();
  const { getState, isPending, setPhase, setError, setTxHash } = useActionStates();
  const [tokens, setTokens] = useState<string[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [tokensError, setTokensError] = useState<string | null>(null);
  const [wasmHash, setWasmHash] = useState<string | null>(null);
  const [wasmLoading, setWasmLoading] = useState(true);
  const [tokenInput, setTokenInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    fetchFactoryAllowedTokens(factoryId, { signal })
      .then((list) => {
        if (signal.aborted) return;
        setTokens(list);
        setTokensError(null);
      })
      .catch(() => {
        if (!signal.aborted) setTokensError("Couldn't load the factory's allowed tokens.");
      })
      .finally(() => {
        if (!signal.aborted) setTokensLoading(false);
      });

    fetchFactoryWasmHash(factoryId, { signal })
      .then((hash) => {
        if (!signal.aborted) setWasmHash(hash);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!signal.aborted) setWasmLoading(false);
      });

    return () => controller.abort();
  }, [factoryId, reloadKey]);

  const runTokenTx = useCallback(
    async (key: string, method: string, token: string, verb: "added" | "removed") => {
      let failure: string | null = null;
      const txHash = await runContractAction(
        key,
        async (onPhase) => {
          try {
            return await submitContractTransaction({
              contractId: factoryId,
              method,
              args: factoryTokenArgs(address, token),
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
        showToast(`Token ${verb} ${verb === "added" ? "to" : "from"} the factory.`, "success");
        if (verb === "added") setTokenInput("");
        setReloadKey((k) => k + 1);
      } else if (failure !== null) {
        showToast(`Factory token update failed: ${failure}`, "error");
      }
    },
    [factoryId, address, signTransaction, showToast, isPending, setPhase, setError, setTxHash]
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const token = tokenInput.trim().toUpperCase();
    if (!isContractAddress(token)) {
      setInputError("Enter a token contract ID (C followed by 55 letters and digits).");
      return;
    }
    if (tokens.includes(token)) {
      setInputError("That token is already allowed.");
      return;
    }
    setInputError(null);
    void runTokenTx(ADD_KEY, FACTORY_METHODS.allowToken, token, "added");
  };

  const addState = getState(ADD_KEY);
  const addPending = isPending(ADD_KEY);

  return (
    <section
      data-testid="factory-admin-panel"
      aria-labelledby="factory-admin-title"
      className="space-y-6 border border-border-strong rounded-xl bg-surface-card p-6"
    >
      <div>
        <h2 id="factory-admin-title" className="font-semibold">
          Escrow factory
        </h2>
        <p className="text-sm text-text-muted">
          Tokens accepted by every new escrow, and the escrow code new escrows are deployed from.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-1">Escrow WASM hash</h3>
        <p data-testid="factory-wasm-hash" className="flex items-center gap-2 min-w-0 text-sm">
          {wasmLoading ? (
            <span className="text-text-muted">Loading…</span>
          ) : wasmHash ? (
            <>
              <span className="font-mono truncate" title={wasmHash}>
                {wasmHash}
              </span>
              <CopyButton value={wasmHash} label="WASM hash" />
            </>
          ) : (
            <span className="text-text-muted">Unavailable</span>
          )}
        </p>
      </div>

      <form onSubmit={handleAdd} className="space-y-2">
        <label htmlFor="factory-token-address" className="block text-sm text-text-muted">
          Allow a token
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="factory-token-address"
            value={tokenInput}
            onChange={(e) => {
              setTokenInput(e.target.value);
              setInputError(null);
            }}
            placeholder="C..."
            disabled={addPending}
            aria-invalid={inputError !== null}
            className="flex-1 min-w-0 bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={addPending || !tokenInput.trim()}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-text-primary text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            {addPending && <ButtonSpinner className="h-4 w-4" />}
            {addPending ? getPhaseLabel(addState.phase) || "Processing..." : "Allow token"}
          </button>
        </div>
        {inputError && (
          <p role="alert" className="text-xs text-red-400">
            {inputError}
          </p>
        )}
        <TxStatusBanner state={addState} successMessage="Token allowed on the factory." />
      </form>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Allowed tokens</h3>
        {tokensLoading ? (
          <p className="text-sm text-text-muted">Loading allowed tokens…</p>
        ) : tokensError ? (
          <p role="alert" data-testid="factory-tokens-error" className="text-sm text-red-400">
            {tokensError}
          </p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-text-disabled">No tokens are allowed yet.</p>
        ) : (
          <ul data-testid="factory-allowed-tokens" className="space-y-2">
            {tokens.map((token) => {
              const key = removeKey(token);
              const pending = isPending(key);
              return (
                <li
                  key={token}
                  data-testid={`factory-token-${token}`}
                  className="flex flex-col gap-2 bg-surface-field rounded-lg px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-sm truncate">{token}</span>
                      <CopyButton value={token} label="Token address" />
                    </span>
                    {supportsRemoval && (
                      <button
                        type="button"
                        onClick={() =>
                          void runTokenTx(key, FACTORY_METHODS.disallowToken, token, "removed")
                        }
                        disabled={pending}
                        aria-label={`Remove ${token} from the factory`}
                        className="inline-flex items-center justify-center gap-2 shrink-0 min-h-[44px] text-xs bg-red-800 hover:bg-red-700 disabled:opacity-50 text-text-primary px-4 py-2.5 rounded-lg transition"
                      >
                        {pending && <ButtonSpinner />}
                        {pending ? getPhaseLabel(getState(key).phase) || "Removing..." : "Remove"}
                      </button>
                    )}
                  </div>
                  <TxStatusBanner state={getState(key)} successMessage="Token removed." />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
