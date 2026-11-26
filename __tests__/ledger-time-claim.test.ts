import { describe, it, expect, afterEach } from "vitest";
import { getClaimEligibility } from "@/app/lib/claimEligibility";
import {
  computeLedgerOffsetMs,
  gatedNowMs,
  setLedgerOffsetMs,
  LEDGER_TIME_MARGIN_MS,
} from "@/app/lib/ledgerTime";

afterEach(() => setLedgerOffsetMs(0));

describe("claim eligibility uses ledger time", () => {
  it("stays disabled while a browser clock 120s ahead has passed the deadline", () => {
    const ledgerNow = 1_700_000_000_000;
    const browserNow = ledgerNow + 120_000;
    const deadlineMs = ledgerNow + 60_000;
    setLedgerOffsetMs(computeLedgerOffsetMs(ledgerNow / 1000, browserNow));
    const e = getClaimEligibility({ backendDeadlineMs: deadlineMs, now: gatedNowMs(browserNow) });
    expect(e.show).toBe(false);
    const later = browserNow + 60_000 + LEDGER_TIME_MARGIN_MS;
    expect(
      getClaimEligibility({ backendDeadlineMs: deadlineMs, now: gatedNowMs(later) }).show
    ).toBe(true);
  });
});
