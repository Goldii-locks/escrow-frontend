import { describe, expect, it } from "vitest";
import {
  CONTRACT_PAUSE_NO_WALLET_MESSAGE,
  CONTRACT_PAUSE_UNAUTHORIZED_MESSAGE,
  getContractPauseFallbackMessage,
  guardContractPauseSwitch,
  resolveContractPauseAccess,
} from "../app/lib/contract_pause_switch_access";

describe("contract_pause_switch access", () => {
  it("allows an admin wallet", () => {
    expect(resolveContractPauseAccess("GADMIN", "admin")).toEqual({ allowed: true, reason: null });
  });

  it("denies non-admin roles", () => {
    for (const role of ["arbiter", "user", "none"] as const) {
      expect(resolveContractPauseAccess("GABC", role)).toEqual({
        allowed: false,
        reason: "unauthorized",
      });
    }
    expect(resolveContractPauseAccess("GABC", null).allowed).toBe(false);
  });

  it("denies missing or blank wallets", () => {
    expect(resolveContractPauseAccess(null, "admin").reason).toBe("no_wallet");
    expect(resolveContractPauseAccess("  ", "admin").reason).toBe("no_wallet");
  });

  it("returns fallback warnings only when denied", () => {
    expect(getContractPauseFallbackMessage(resolveContractPauseAccess("G", "admin"))).toBeNull();
    expect(getContractPauseFallbackMessage(resolveContractPauseAccess(null, "admin"))).toBe(
      CONTRACT_PAUSE_NO_WALLET_MESSAGE,
    );
    expect(getContractPauseFallbackMessage(resolveContractPauseAccess("G", "user"))).toBe(
      CONTRACT_PAUSE_UNAUTHORIZED_MESSAGE,
    );
  });

  it("blocks rendering the switch for unauthorized wallets", () => {
    const render = (role: "admin" | "user") =>
      guardContractPauseSwitch(
        resolveContractPauseAccess("G", role),
        () => "switch",
        (m) => `warning:${m}`,
      );
    expect(render("admin")).toBe("switch");
    expect(render("user")).toBe(`warning:${CONTRACT_PAUSE_UNAUTHORIZED_MESSAGE}`);
  });
});
