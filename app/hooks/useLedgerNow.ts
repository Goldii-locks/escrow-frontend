"use client";

import { useEffect, useState } from "react";
import { gatedNowMs, syncLedgerOffset } from "@/app/lib/ledgerTime";

/** Current ledger time (epoch ms, with safety margin) for time-gated eligibility checks. */
export function useLedgerNow(intervalMs = 1000): number {
  const [now, setNow] = useState<number>(() => gatedNowMs());
  useEffect(() => {
    let active = true;
    void syncLedgerOffset().then(() => active && setNow(gatedNowMs()));
    const id = setInterval(() => setNow(gatedNowMs()), intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}
