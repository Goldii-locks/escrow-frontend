"use client";

import { useCallback, useState } from "react";
import { TxPhase, isTxPending } from "@/app/lib/transactions";

export interface ActionState {
  phase: TxPhase;
  error: string | null;
  txHash: string | null;
}

const defaultState: ActionState = {
  phase: "idle",
  error: null,
  txHash: null,
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

  const resetAction = useCallback((key: string) => {
    setStates((prev) => ({
      ...prev,
      [key]: defaultState,
    }));
  }, []);

  return {
    getState,
    isPending,
    setPhase,
    setError,
    setTxHash,
    resetAction,
  };
}
