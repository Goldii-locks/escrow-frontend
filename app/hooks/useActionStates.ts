"use client";

import { useCallback, useState } from "react";

import { TxPhase, isTxPending } from "@/app/lib/transactions";

export interface ActionState {
  phase: TxPhase;
  error: string | null;
  txHash: string | null;
  /**
   * Whether a spinner should be shown for this action. Optional so the many
   * existing `{ phase, error, txHash }` literals stay valid; `defaultState`
   * fills it in and `isLoading()` treats a missing value as `false`.
   */
  isLoading?: boolean;
}

const defaultState: ActionState = {
  phase: "idle",
  error: null,
  txHash: null,
  isLoading: false,
};

export function useActionStates() {
  const [states, setStates] = useState<Record<string, ActionState>>({});

  const getState = useCallback(
    (key: string): ActionState => states[key] ?? defaultState,
    [states]
  );

  const isPending = useCallback(
    (key: string) => isTxPending(getState(key).phase),
    [getState]
  );

  const isLoading = useCallback(
    (key: string) => getState(key).isLoading ?? false,
    [getState]
  );

  const setPhase = useCallback((key: string, phase: TxPhase) => {
    setStates((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? defaultState), phase },
    }));
  }, []);

  const setError = useCallback((key: string, error: string | null) => {
    setStates((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? defaultState), error },
    }));
  }, []);

  const setTxHash = useCallback((key: string, txHash: string | null) => {
    setStates((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? defaultState), txHash },
    }));
  }, []);

  const setLoading = useCallback((key: string, value: boolean) => {
    setStates((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? defaultState), isLoading: value },
    }));
  }, []);

  const resetAction = useCallback((key: string) => {
    setStates((prev) => ({
      ...prev,
      [key]: defaultState,
    }));
  }, []);

  return {
    getState,
    isPending,
    isLoading,
    setPhase,
    setError,
    setTxHash,
    setLoading,
    resetAction,
  };
}
