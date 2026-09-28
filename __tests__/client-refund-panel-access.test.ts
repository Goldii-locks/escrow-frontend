import { describe, expect, it } from "vitest";
import {
  CLIENT_REFUND_NO_WALLET_MESSAGE,
  CLIENT_REFUND_UNAUTHORIZED_WARNING,
  getClientRefundFallbackMessage,
  guardClientRefundPanel,
  resolveClientRefundAccess,
} from "@/app/lib/client_refund_panel_access";

describe("client_refund_panel access restrictions (#500)", () => {
  const CLIENT = "GCLIENT123456789";
  const OTHER = "GFREELANCER987654321";

  it("allows access when wallet matches client address", () => {
    const access = resolveClientRefundAccess(CLIENT, "client", CLIENT);
    expect(access.allowed).toBe(true);
    expect(access.reason).toBeNull();
  });

  it("denies access for unauthorized wallets", () => {
    const access = resolveClientRefundAccess(OTHER, "freelancer", CLIENT);
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe("unauthorized");
    expect(access.warning).toBe(CLIENT_REFUND_UNAUTHORIZED_WARNING);
  });

  it("denies access when wallet is disconnected", () => {
    expect(resolveClientRefundAccess(null).reason).toBe("no_wallet");
    expect(resolveClientRefundAccess("").reason).toBe("no_wallet");
    expect(resolveClientRefundAccess(null).warning).toBe(
      CLIENT_REFUND_NO_WALLET_MESSAGE,
    );
  });

  it("returns fallback warning messages correctly", () => {
    const allowed = resolveClientRefundAccess(CLIENT, "client");
    expect(getClientRefundFallbackMessage(allowed)).toBeNull();

    const denied = resolveClientRefundAccess(OTHER, "freelancer");
    expect(getClientRefundFallbackMessage(denied)).toBe(
      CLIENT_REFUND_UNAUTHORIZED_WARNING,
    );
  });

  it("guards client refund panel rendering with conditional wrapper", () => {
    const render = (wallet: string | null) =>
      guardClientRefundPanel(
        resolveClientRefundAccess(wallet, "client", CLIENT),
        () => "refund-content",
        (warning) => `warning:${warning}`,
      );

    expect(render(CLIENT)).toBe("refund-content");
    expect(render(OTHER)).toBe(`warning:${CLIENT_REFUND_UNAUTHORIZED_WARNING}`);
    expect(render(null)).toBe(`warning:${CLIENT_REFUND_NO_WALLET_MESSAGE}`);
  });
});
