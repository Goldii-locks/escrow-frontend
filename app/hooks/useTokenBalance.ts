"use client";

import { useEffect, useState } from "react";
import { fetchTokenBalance } from "@/app/lib/token_balance";

interface BalanceState {
  token: string;
  holder: string;
  balance: string | null;
}

export function useTokenBalance(token: string | null, holder: string | null) {
  const [state, setState] = useState<BalanceState | null>(null);
  const key = token && holder ? `${token}:${holder}` : null;
  const current = state && key === `${state.token}:${state.holder}` ? state : null;

  useEffect(() => {
    if (!token || !holder) return;

    let active = true;
    const controller = new AbortController();

    void fetchTokenBalance(token, holder, { signal: controller.signal }).then((balance) => {
      if (!active) return;
      setState({ token, holder, balance });
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [token, holder]);

  return {
    balance: current?.balance ?? null,
    loading: key !== null && current === null,
  };
}
