/**
 * Tests for issue #243 — Handle wallet availability check errors inside
 * signature_timeout_alert.
 *
 * Validates that detectSignatureAlertWallet, checkSignatureAlertAvailability,
 * and warnOnMissingSignatureAlertWallet all surface helpful setup instructions
 * and warning toasts when the wallet extension is missing or the detection
 * call throws.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkSignatureAlertAvailability,
  detectSignatureAlertWallet,
  SIGNATURE_ALERT_INSTALL_URL,
  SIGNATURE_ALERT_SETUP_INSTRUCTION,
  warnOnMissingSignatureAlertWallet,
} from "@/app/lib/signature_timeout_alert";

// ---------------------------------------------------------------------------
// detectSignatureAlertWallet
// ---------------------------------------------------------------------------

describe("signature_timeout_alert detectSignatureAlertWallet (#243)", () => {
  afterEach(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w["freighterApi"];
    delete w["freighter"];
    delete w["albedo"];
    delete w["albedoApi"];
    delete w["rabeApi"];
    delete w["rabe"];
  });

  it("returns false when no wallet globals are present", () => {
    expect(detectSignatureAlertWallet()).toBe(false);
  });

  it("returns true when window.freighterApi is present", () => {
    (window as unknown as Record<string, unknown>)["freighterApi"] = {};
    expect(detectSignatureAlertWallet()).toBe(true);
  });

  it("returns true when window.freighter is present", () => {
    (window as unknown as Record<string, unknown>)["freighter"] = {};
    expect(detectSignatureAlertWallet()).toBe(true);
  });

  it("returns true when window.albedo is present", () => {
    (window as unknown as Record<string, unknown>)["albedo"] = {};
    expect(detectSignatureAlertWallet()).toBe(true);
  });

  it("returns true when window.albedoApi is present", () => {
    (window as unknown as Record<string, unknown>)["albedoApi"] = {};
    expect(detectSignatureAlertWallet()).toBe(true);
  });

  it("returns true when window.rabeApi is present", () => {
    (window as unknown as Record<string, unknown>)["rabeApi"] = {};
    expect(detectSignatureAlertWallet()).toBe(true);
  });

  it("returns true when window.rabe is present", () => {
    (window as unknown as Record<string, unknown>)["rabe"] = {};
    expect(detectSignatureAlertWallet()).toBe(true);
  });

  it("honours an injected detector that returns true", () => {
    expect(detectSignatureAlertWallet(() => true)).toBe(true);
  });

  it("honours an injected detector that returns false", () => {
    expect(detectSignatureAlertWallet(() => false)).toBe(false);
  });

  it("detector callback overrides window globals", () => {
    (window as unknown as Record<string, unknown>)["freighterApi"] = {};
    expect(detectSignatureAlertWallet(() => false)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkSignatureAlertAvailability
// ---------------------------------------------------------------------------

describe("signature_timeout_alert checkSignatureAlertAvailability (#243)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns available=true and clears all messages when the wallet is present", () => {
    const state = checkSignatureAlertAvailability(() => true);

    expect(state.available).toBe(true);
    expect(state.status).toBe("available");
    expect(state.setupInstruction).toBeNull();
    expect(state.warningMessage).toBeNull();
  });

  it("returns available=false with setup instructions when the wallet is missing", () => {
    const state = checkSignatureAlertAvailability(() => false);

    expect(state.available).toBe(false);
    expect(state.status).toBe("unavailable");
    expect(state.setupInstruction).toBe(SIGNATURE_ALERT_SETUP_INSTRUCTION);
    expect(state.warningMessage).toBe(SIGNATURE_ALERT_SETUP_INSTRUCTION);
  });

  it("setup instruction mentions install and refresh", () => {
    const state = checkSignatureAlertAvailability(() => false);

    expect(state.setupInstruction).toMatch(/install/i);
    expect(state.setupInstruction).toMatch(/refresh/i);
  });

  it("setup instruction mentions Freighter", () => {
    const state = checkSignatureAlertAvailability(() => false);
    expect(state.setupInstruction).toMatch(/freighter/i);
  });

  it("returns error status and fallback messages when the detector throws", () => {
    const state = checkSignatureAlertAvailability(() => {
      throw new Error("detector boom");
    });

    expect(state.available).toBe(false);
    expect(state.status).toBe("error");
    expect(state.setupInstruction).toBe(SIGNATURE_ALERT_SETUP_INSTRUCTION);
    expect(state.warningMessage).toMatch(/Unable to verify wallet availability/i);
  });

  it("logs a [signature_timeout_alert] warning block when the detector throws", () => {
    checkSignatureAlertAvailability(() => {
      throw new Error("detector exploded");
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[signature_timeout_alert]");
    expect(logged).toContain("WALLET UNAVAILABLE");
    expect(logged).toContain("--- stack trace ---");
  });

  it("error warningMessage starts with the inability notice", () => {
    const state = checkSignatureAlertAvailability(() => {
      throw new Error("boom");
    });

    expect(state.warningMessage!.startsWith("Unable to verify")).toBe(true);
    expect(state.warningMessage).toContain(SIGNATURE_ALERT_SETUP_INSTRUCTION);
  });

  it("does not log when the wallet is available", () => {
    checkSignatureAlertAvailability(() => true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not log when the wallet is simply missing (unavailable)", () => {
    checkSignatureAlertAvailability(() => false);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// warnOnMissingSignatureAlertWallet
// ---------------------------------------------------------------------------

describe("signature_timeout_alert warnOnMissingSignatureAlertWallet (#243)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("shows a warning toast with setup instructions when the wallet is missing", () => {
    const showToast = vi.fn();
    const state = warnOnMissingSignatureAlertWallet(showToast, () => false);

    expect(state.available).toBe(false);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(
      SIGNATURE_ALERT_SETUP_INSTRUCTION,
      "warning"
    );
  });

  it("does not call showToast when the wallet is available", () => {
    const showToast = vi.fn();
    const state = warnOnMissingSignatureAlertWallet(showToast, () => true);

    expect(state.available).toBe(true);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("calls showToast with an error-context message when the detector throws", () => {
    const showToast = vi.fn();
    const state = warnOnMissingSignatureAlertWallet(showToast, () => {
      throw new Error("extension check failed");
    });

    expect(state.status).toBe("error");
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/Unable to verify wallet availability/i),
      "warning"
    );
  });

  it("returns the full availability state on missing wallet", () => {
    const showToast = vi.fn();
    const state = warnOnMissingSignatureAlertWallet(showToast, () => false);

    expect(state.status).toBe("unavailable");
    expect(state.setupInstruction).toBe(SIGNATURE_ALERT_SETUP_INSTRUCTION);
    expect(state.warningMessage).toBe(SIGNATURE_ALERT_SETUP_INSTRUCTION);
  });

  it("returns the full availability state on available wallet", () => {
    const showToast = vi.fn();
    const state = warnOnMissingSignatureAlertWallet(showToast, () => true);

    expect(state.status).toBe("available");
    expect(state.setupInstruction).toBeNull();
    expect(state.warningMessage).toBeNull();
  });

  it("returns the full availability state on detector error", () => {
    const showToast = vi.fn();
    const state = warnOnMissingSignatureAlertWallet(showToast, () => {
      throw new Error("boom");
    });

    expect(state.available).toBe(false);
    expect(state.status).toBe("error");
    expect(state.setupInstruction).toBe(SIGNATURE_ALERT_SETUP_INSTRUCTION);
  });

  it("toast type is always 'warning' regardless of status", () => {
    const showToast = vi.fn();

    warnOnMissingSignatureAlertWallet(showToast, () => false);
    warnOnMissingSignatureAlertWallet(showToast, () => {
      throw new Error("boom");
    });

    for (const call of showToast.mock.calls) {
      expect(call[1]).toBe("warning");
    }
  });

  it("fallback message is displayed when wallet is missing (no wallet installed case)", () => {
    const showToast = vi.fn();
    warnOnMissingSignatureAlertWallet(showToast, () => false);

    const [message] = showToast.mock.calls[0] as [string, string];
    expect(message).toMatch(/install/i);
    expect(message).toMatch(/refresh/i);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("signature_timeout_alert availability constants (#243)", () => {
  it("SIGNATURE_ALERT_SETUP_INSTRUCTION is a non-empty helpful string", () => {
    expect(typeof SIGNATURE_ALERT_SETUP_INSTRUCTION).toBe("string");
    expect(SIGNATURE_ALERT_SETUP_INSTRUCTION.length).toBeGreaterThan(0);
    expect(SIGNATURE_ALERT_SETUP_INSTRUCTION).toMatch(/install/i);
    expect(SIGNATURE_ALERT_SETUP_INSTRUCTION).toMatch(/refresh/i);
  });

  it("SIGNATURE_ALERT_INSTALL_URL is a valid https URL", () => {
    expect(SIGNATURE_ALERT_INSTALL_URL).toMatch(/^https:\/\//);
  });

  it("SIGNATURE_ALERT_INSTALL_URL points to the freighter.app domain", () => {
    expect(SIGNATURE_ALERT_INSTALL_URL).toContain("freighter.app");
  });
});
