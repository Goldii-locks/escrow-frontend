import { describe, expect, it } from "vitest";
import {
  FREELANCER_CLAIM_NO_WALLET_MESSAGE,
  FREELANCER_CLAIM_UNAUTHORIZED_WARNING,
  getFreelancerClaimFallbackMessage,
  guardFreelancerClaimPanel,
  resolveFreelancerClaimAccess,
} from "@/app/lib/freelancer_claim_panel_access";

describe("freelancer_claim_panel access restrictions (#490)", () => {
  const FREELANCER = "GFREELANCER123456789";
  const OTHER = "GCLIENT987654321";

  it("allows access when wallet matches freelancer address", () => {
    const access = resolveFreelancerClaimAccess(FREELANCER, "freelancer", FREELANCER);
    expect(access.allowed).toBe(true);
    expect(access.reason).toBeNull();
  });

  it("denies access for unauthorized wallets", () => {
    const access = resolveFreelancerClaimAccess(OTHER, "client", FREELANCER);
    expect(access.allowed).toBe(false);
    expect(access.reason).toBe("unauthorized");
    expect(access.warning).toBe(FREELANCER_CLAIM_UNAUTHORIZED_WARNING);
  });

  it("denies access when wallet is not connected", () => {
    expect(resolveFreelancerClaimAccess(null).reason).toBe("no_wallet");
    expect(resolveFreelancerClaimAccess("").reason).toBe("no_wallet");
    expect(resolveFreelancerClaimAccess("   ").reason).toBe("no_wallet");
    expect(resolveFreelancerClaimAccess(null).warning).toBe(
      FREELANCER_CLAIM_NO_WALLET_MESSAGE,
    );
  });

  it("returns fallback warning messages correctly", () => {
    const allowed = resolveFreelancerClaimAccess(FREELANCER, "freelancer");
    expect(getFreelancerClaimFallbackMessage(allowed)).toBeNull();

    const unauthorized = resolveFreelancerClaimAccess(OTHER, "client");
    expect(getFreelancerClaimFallbackMessage(unauthorized)).toBe(
      FREELANCER_CLAIM_UNAUTHORIZED_WARNING,
    );
  });

  it("guards freelancer claim panel rendering based on access", () => {
    const render = (wallet: string | null) =>
      guardFreelancerClaimPanel(
        resolveFreelancerClaimAccess(wallet, "freelancer", FREELANCER),
        () => "panel-content",
        (warning) => `warning:${warning}`,
      );

    expect(render(FREELANCER)).toBe("panel-content");
    expect(render(OTHER)).toBe(`warning:${FREELANCER_CLAIM_UNAUTHORIZED_WARNING}`);
    expect(render(null)).toBe(`warning:${FREELANCER_CLAIM_NO_WALLET_MESSAGE}`);
  });
});
