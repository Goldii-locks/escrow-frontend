import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkWalletAvailability,
  detectWalletExtension,
  WALLET_INSTALL_URL,
  WALLET_SETUP_INSTRUCTION,
  warnOnMissingWallet,
} from "@/app/lib/network_sync_checker";

describe("network_sync_checker wallet availability (#153)", () => {
  afterEach(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w["freighterApi"];
    delete w["freighter"];
    delete w["albedo"];
    delete w["xBullSDK"];
    delete w["hanaWallet"];
  });

  it("detectWalletExtension returns false when no wallet globals are present", () => {
    expect(detectWalletExtension()).toBe(false);
  });

  it("detectWalletExtension returns true when freighterApi is present", () => {
    (window as unknown as Record<string, unknown>)["freighterApi"] = {};
    expect(detectWalletExtension()).toBe(true);
  });

  it("detectWalletExtension returns true for albedo / xBull / hana globals", () => {
    const w = window as unknown as Record<string, unknown>;
    w["albedo"] = {};
    expect(detectWalletExtension()).toBe(true);
    delete w["albedo"];

    w["xBullSDK"] = {};
    expect(detectWalletExtension()).toBe(true);
    delete w["xBullSDK"];

    w["hanaWallet"] = {};
    expect(detectWalletExtension()).toBe(true);
  });

  it("honours an injected detector callback", () => {
    expect(detectWalletExtension(() => true)).toBe(true);
    expect(detectWalletExtension(() => false)).toBe(false);
  });

  it("checkWalletAvailability returns setup instructions when wallet is missing", () => {
    const state = checkWalletAvailability(() => false);
    expect(state.available).toBe(false);
    expect(state.status).toBe("unavailable");
    expect(state.setupInstruction).toBe(WALLET_SETUP_INSTRUCTION);
    expect(state.warningMessage).toBe(WALLET_SETUP_INSTRUCTION);
    expect(state.setupInstruction).toMatch(/install/i);
    expect(state.setupInstruction).toMatch(/refresh/i);
  });

  it("checkWalletAvailability clears instructions when wallet is present", () => {
    const state = checkWalletAvailability(() => true);
    expect(state.available).toBe(true);
    expect(state.status).toBe("available");
    expect(state.setupInstruction).toBeNull();
    expect(state.warningMessage).toBeNull();
  });

  it("checkWalletAvailability returns error status when the detector throws", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = checkWalletAvailability(() => {
      throw new Error("detector boom");
    });

    expect(state.available).toBe(false);
    expect(state.status).toBe("error");
    expect(state.setupInstruction).toBe(WALLET_SETUP_INSTRUCTION);
    expect(state.warningMessage).toMatch(/Unable to verify wallet availability/i);
    expect(warnSpy).toHaveBeenCalled();
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[network_sync_checker]");
    warnSpy.mockRestore();
  });

  it("WALLET_SETUP_INSTRUCTION and WALLET_INSTALL_URL are helpful fallbacks", () => {
    expect(WALLET_SETUP_INSTRUCTION).toMatch(/wallet/i);
    expect(WALLET_SETUP_INSTRUCTION).toMatch(/Freighter|Albedo|xBull|Hana/);
    expect(WALLET_INSTALL_URL).toContain("freighter.app");
  });
});

describe("warnOnMissingWallet (#153)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("shows a warning toast with setup instructions when wallet is missing", () => {
    const showToast = vi.fn();
    const state = warnOnMissingWallet(showToast, () => false);

    expect(state.available).toBe(false);
    expect(showToast).toHaveBeenCalledWith(WALLET_SETUP_INSTRUCTION, "warning");
  });

  it("does not toast when the wallet is available", () => {
    const showToast = vi.fn();
    const state = warnOnMissingWallet(showToast, () => true);

    expect(state.available).toBe(true);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("toasts when the availability check errors", () => {
    const showToast = vi.fn();
    const state = warnOnMissingWallet(showToast, () => {
      throw new Error("boom");
    });

    expect(state.status).toBe("error");
    expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/Unable to verify wallet availability/i),
      "warning"
    );
  });
});
