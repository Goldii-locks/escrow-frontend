import { describe, expect, it } from "vitest";
import {
  FEE_CONFIG_UNAUTHORIZED_WARNING,
  getFeeConfigAccess,
  guardFeeConfig,
} from "@/app/lib/admin_fee_configuration_access";

describe("admin_fee_configuration access", () => {
  it("allows the admin wallet", () => {
    expect(getFeeConfigAccess("GADMIN", "GADMIN")).toEqual({ allowed: true });
  });
  it("blocks unauthorized wallets with a warning", () => {
    const a = getFeeConfigAccess("GOTHER", "GADMIN");
    expect(a).toMatchObject({ allowed: false, reason: "not_admin", warning: FEE_CONFIG_UNAUTHORIZED_WARNING });
  });
  it("blocks when no wallet is connected", () => {
    expect(getFeeConfigAccess(null, "GADMIN")).toMatchObject({ allowed: false, reason: "no_wallet" });
  });
  it("renders fallback instead of content when blocked", () => {
    const a = getFeeConfigAccess("GOTHER", "GADMIN");
    expect(guardFeeConfig(a, () => "form", (w) => w)).toBe(FEE_CONFIG_UNAUTHORIZED_WARNING);
    expect(guardFeeConfig({ allowed: true }, () => "form", (w) => w)).toBe("form");
  });
});
