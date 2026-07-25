import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkNetworkSync,
  isNetworkSyncUserRejected,
  NetworkSyncUserRejectedError,
  runNetworkSyncSign,
  validateNetworkSyncWithSignature,
} from "@/app/lib/network_sync_checker";

describe("network_sync_checker user rejection handling", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("detects user rejected transaction exceptions", () => {
    expect(isNetworkSyncUserRejected(new NetworkSyncUserRejectedError())).toBe(
      true
    );
    expect(isNetworkSyncUserRejected(new Error("user rejected transaction"))).toBe(
      true
    );
    expect(
      isNetworkSyncUserRejected(new Error("User Declined the request"))
    ).toBe(true);
    expect(isNetworkSyncUserRejected(new Error("request rejected"))).toBe(
      true
    );
    expect(
      isNetworkSyncUserRejected(new Error("denied by the user"))
    ).toBe(true);
    expect(isNetworkSyncUserRejected(new Error("rpc timeout"))).toBe(false);
  });

  it("catches rejection during network sync sign and shows a warning toast", async () => {
    const showToast = vi.fn();

    const result = await runNetworkSyncSign(async () => {
      throw new Error("user rejected transaction");
    }, showToast);

    expect(result).toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      "Network sync cancelled — you rejected the signature in your wallet.",
      "warning"
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[network_sync_checker]");
    expect(logged).toContain("signature rejected during network sync");
  });

  it("re-throws non-rejection errors without toasting", async () => {
    const showToast = vi.fn();

    await expect(
      runNetworkSyncSign(async () => {
        throw new Error("horizon unreachable");
      }, showToast)
    ).rejects.toThrow("horizon unreachable");

    expect(showToast).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("returns the signed payload when the user approves", async () => {
    const showToast = vi.fn();
    const result = await runNetworkSyncSign(
      async () => ({ hash: "abc123" }),
      showToast
    );
    expect(result).toEqual({ hash: "abc123" });
    expect(showToast).not.toHaveBeenCalled();
  });
});

describe("network_sync_checker network alignment", () => {
  it("reports synced when wallet and app networks match", () => {
    const state = checkNetworkSync("testnet", "testnet");
    expect(state.synced).toBe(true);
    expect(state.warningMessage).toBeNull();
  });

  it("reports out of sync with a warning message when networks diverge", () => {
    const state = checkNetworkSync("mainnet", "testnet");
    expect(state.synced).toBe(false);
    expect(state.walletNetwork).toBe("mainnet");
    expect(state.appNetwork).toBe("testnet");
    expect(state.warningMessage).toMatch(/Network out of sync/i);
    expect(state.warningMessage).toMatch(/Mainnet/);
    expect(state.warningMessage).toMatch(/Testnet/);
  });
});

describe("validateNetworkSyncWithSignature", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("blocks the sign probe when networks are out of sync", async () => {
    const showToast = vi.fn();
    const signFn = vi.fn();

    const result = await validateNetworkSyncWithSignature(
      "mainnet",
      "testnet",
      signFn,
      showToast
    );

    expect(result).toBeNull();
    expect(signFn).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/Network out of sync/i),
      "warning"
    );
  });

  it("runs the sign probe when networks are aligned", async () => {
    const showToast = vi.fn();

    const result = await validateNetworkSyncWithSignature(
      "testnet",
      "testnet",
      async () => "signed",
      showToast
    );

    expect(result).toBe("signed");
    expect(showToast).not.toHaveBeenCalled();
  });

  it("catches user rejection during an aligned sync probe", async () => {
    const showToast = vi.fn();

    const result = await validateNetworkSyncWithSignature(
      "testnet",
      "testnet",
      async () => {
        throw new NetworkSyncUserRejectedError();
      },
      showToast
    );

    expect(result).toBeNull();
    expect(showToast).toHaveBeenCalledWith(
      "Network sync cancelled — you rejected the signature in your wallet.",
      "warning"
    );
    expect(warnSpy).toHaveBeenCalled();
  });
});
