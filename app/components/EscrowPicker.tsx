"use client";

import { useEffect, useState } from "react";
import {
  contractIdInputError,
  fetchIndexedEscrows,
  normalizeContractIdInput,
  type EscrowOption,
} from "@/app/lib/escrow_picker";

export interface EscrowPickerProps {
  /** Connected wallet; its indexed escrows populate the list. */
  address: string | null;
  /** Currently selected escrow contract, or "" for none. */
  value: string;
  onSelect: (contractId: string) => void;
}

/**
 * Chooses the escrow /admin acts on (#837): type a contract ID, or pick one
 * of the wallet's indexed escrows. Pause/resume and whitelist overrides then
 * target that escrow instead of a single configured contract.
 */
export default function EscrowPicker({ address, value, onSelect }: EscrowPickerProps) {
  const [input, setInput] = useState(value);
  const [inputError, setInputError] = useState<string | null>(null);
  const [indexed, setIndexed] = useState<{
    address: string;
    options: EscrowOption[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!address) return;
    const controller = new AbortController();
    fetchIndexedEscrows(address, { signal: controller.signal })
      .then((options) => {
        if (!controller.signal.aborted) setIndexed({ address, options, error: null });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setIndexed({ address, options: [], error: "Couldn't load indexed escrows." });
        }
      });
    return () => controller.abort();
  }, [address]);

  const current = indexed?.address === address ? indexed : null;
  const listLoading = Boolean(address) && current === null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const error = contractIdInputError(input);
    setInputError(error);
    if (error) return;
    onSelect(normalizeContractIdInput(input));
  };

  return (
    <section
      data-testid="escrow-picker"
      aria-labelledby="escrow-picker-title"
      className="space-y-4 border border-border-strong rounded-xl bg-surface-card p-6"
    >
      <div>
        <h2 id="escrow-picker-title" className="font-semibold">
          Escrow
        </h2>
        <p className="text-sm text-text-muted">
          Every escrow is its own contract. Choose the one to pause, resume or manage.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1 min-w-0">
          <label htmlFor="escrow-contract-id" className="block text-sm text-text-muted mb-1">
            Escrow contract ID
          </label>
          <input
            id="escrow-contract-id"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setInputError(null);
            }}
            placeholder="C..."
            aria-invalid={inputError !== null}
            aria-describedby={inputError ? "escrow-contract-id-error" : undefined}
            className="w-full bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500"
          />
          {inputError && (
            <p id="escrow-contract-id-error" role="alert" className="mt-1 text-xs text-red-400">
              {inputError}
            </p>
          )}
        </div>
        <button
          type="submit"
          className="sm:mt-6 min-h-[44px] shrink-0 bg-indigo-600 hover:bg-indigo-500 text-text-primary text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          Select escrow
        </button>
      </form>

      <div>
        <label htmlFor="escrow-indexed" className="block text-sm text-text-muted mb-1">
          Or pick an indexed escrow
        </label>
        <select
          id="escrow-indexed"
          value={current?.options.some((o) => o.contractId === value) ? value : ""}
          disabled={listLoading || !current || current.options.length === 0}
          onChange={(e) => {
            if (!e.target.value) return;
            setInput(e.target.value);
            setInputError(null);
            onSelect(e.target.value);
          }}
          className="w-full bg-surface-field border border-border-subtle rounded-lg px-4 py-2 text-sm disabled:opacity-50"
        >
          <option value="">
            {listLoading
              ? "Loading escrows…"
              : current?.error
                ? current.error
                : current && current.options.length === 0
                  ? "No indexed escrows for this wallet"
                  : "Select an escrow"}
          </option>
          {current?.options.map((option) => (
            <option key={option.contractId} value={option.contractId}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {value && (
        <p data-testid="escrow-picker-selected" className="text-xs text-text-muted">
          Managing <span className="font-mono break-all text-text-primary">{value}</span>
        </p>
      )}
    </section>
  );
}
