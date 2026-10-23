// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkRabeAvailability,
  detectRabeExtension,
  RABE_INSTALL_URL,
  RABE_SETUP_INSTRUCTION,
  warnOnMissingRabe,
} from "@/app/lib/rabe_connector";

// ---------------------------------------------------------------------------
// detectRabeExtension
// ---------------------------------------------------------------------------

describe("rabe_connector detectRabeExtension (#133)", () => {
  afterEach(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w["rabeApi"];
    delete w["rabe"];
  });

  it("returns false when no wallet globals are present", () => {
    expect(detectRabeExtension()).toBe(false);
  });

  it("returns true when window.rabeApi is present", () => {
    (window as unknown as Record<string, unknown>)["rabeApi"] = {};
    expect(detectRabeExtension()).toBe(true);
  });

  it("returns true when window.rabe is present", () => {
    (window as unknown as Record<string, unknown>)["rabe"] = {};
    expect(detectRabeExtension()).toBe(true);
  });

  it("returns true when both rabeApi and rabe are present", () => {
    (window as unknown as Record<string, unknown>)["rabeApi"] = {};
    (window as unknown as Record<string, unknown>)["rabe"] = {};
    expect(detectRabeExtension()).toBe(true);
  });

  it("honours an injected detector that returns true", () => {
    expect(detectRabeExtension(() => true)).toBe(true);
  });

  it("honours an injected detector that returns false", () => {
    expect(detectRabeExtension(() => false)).toBe(false);
  });

  it("uses the detector callback even when wallet globals are present", () => {
    (window as unknown as Record<string, unknown>)["rabeApi"] = {};
    // The detector overrides the window check entirely
    expect(detectRabeExtension(() => false)).toBe(false);
  });
});


// ---------------------------------------------------------------------------
// checkRabeAvailability
// ---------------------------------------------------------------------------

describe("rabe_connector checkRabeAvailability (#133)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns available=true and clears all messages when the wallet is present", () => {
    const state = checkRabeAvailability(() => true);

    expect(state.available).toBe(true);
    expect(state.status).toBe("available");
    expect(state.setupInstruction).toBeNull();
    expect(state.warningMessage).toBeNull();
  });

  it("returns available=false with setup instructions when the wallet is missing", () => {
    const state = checkRabeAvailability(() => false);

    expect(state.available).toBe(false);
    expect(state.status).toBe("unavailable");
    expect(state.setupInstruction).toBe(RABE_SETUP_INSTRUCTION);
    expect(state.warningMessage).toBe(RABE_SETUP_INSTRUCTION);
  });

  it("setup instruction mentions install and refresh", () => {
    const state = checkRabeAvailability(() => false);

    expect(state.setupInstruction).toMatch(/install/i);
    expect(state.setupInstruction).toMatch(/refresh/i);
  });

  it("setup instruction mentions rabe", () => {
    const state = checkRabeAvailability(() => false);
    expect(state.setupInstruction).toMatch(/rabe/i);
  });

  it("returns error status and fallback messages when the detector throws", () => {
    const state = checkRabeAvailability(() => {
      throw new Error("detector boom");
    });

    expect(state.available).toBe(false);
    expect(state.status).toBe("error");
    expect(state.setupInstruction).toBe(RABE_SETUP_INSTRUCTION);
    expect(state.warningMessage).toMatch(/Unable to verify wallet availability/i);
  });

  it("logs a formatted rabe_connector warning block when the detector throws", () => {
    checkRabeAvailability(() => {
      throw new Error("detector exploded");
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[rabe_connector]");
    expect(logged).toContain("WALLET UNAVAILABLE");
    expect(logged).toContain("--- stack trace ---");
  });

  it("error warningMessage prefixes with the inability notice and includes RABE_SETUP_INSTRUCTION", () => {
    const state = checkRabeAvailability(() => {
      throw new Error("boom");
    });

    expect(state.warningMessage).toContain(RABE_SETUP_INSTRUCTION);
    expect(state.warningMessage!.startsWith("Unable to verify")).toBe(true);
  });

  it("does not log when the wallet is available", () => {
    checkRabeAvailability(() => true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not log when the wallet is simply missing (unavailable)", () => {
    checkRabeAvailability(() => false);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});


// ---------------------------------------------------------------------------
// warnOnMissingRabe
// ---------------------------------------------------------------------------

describe("rabe_connector warnOnMissingRabe (#133)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("shows a warning toast with setup instructions when the wallet is missing", () => {
    const showToast = vi.fn();
    const state = warnOnMissingRabe(showToast, () => false);

    expect(state.available).toBe(false);
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(RABE_SETUP_INSTRUCTION, "warning");
  });

  it("does not call showToast when the wallet is available", () => {
    const showToast = vi.fn();
    const state = warnOnMissingRabe(showToast, () => true);

    expect(state.available).toBe(true);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("calls showToast with the error message when the detector throws", () => {
    const showToast = vi.fn();
    const state = warnOnMissingRabe(showToast, () => {
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
    const state = warnOnMissingRabe(showToast, () => false);

    expect(state.status).toBe("unavailable");
    expect(state.setupInstruction).toBe(RABE_SETUP_INSTRUCTION);
    expect(state.warningMessage).toBe(RABE_SETUP_INSTRUCTION);
  });

  it("returns the full availability state on available wallet", () => {
    const showToast = vi.fn();
    const state = warnOnMissingRabe(showToast, () => true);

    expect(state.status).toBe("available");
    expect(state.setupInstruction).toBeNull();
    expect(state.warningMessage).toBeNull();
  });

  it("returns the full availability state on detector error", () => {
    const showToast = vi.fn();
    const state = warnOnMissingRabe(showToast, () => {
      throw new Error("boom");
    });

    expect(state.available).toBe(false);
    expect(state.status).toBe("error");
    expect(state.setupInstruction).toBe(RABE_SETUP_INSTRUCTION);
  });

  it("toast type is always 'warning' regardless of status", () => {
    const showToast = vi.fn();

    warnOnMissingRabe(showToast, () => false);
    warnOnMissingRabe(showToast, () => {
      throw new Error("boom");
    });

    for (const call of showToast.mock.calls) {
      expect(call[1]).toBe("warning");
    }
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("rabe_connector availability constants (#133)", () => {
  it("RABE_SETUP_INSTRUCTION is a non-empty helpful string", () => {
    expect(typeof RABE_SETUP_INSTRUCTION).toBe("string");
    expect(RABE_SETUP_INSTRUCTION.length).toBeGreaterThan(0);
    expect(RABE_SETUP_INSTRUCTION).toMatch(/rabe/i);
    expect(RABE_SETUP_INSTRUCTION).toMatch(/install/i);
    expect(RABE_SETUP_INSTRUCTION).toMatch(/refresh/i);
  });

  it("RABE_INSTALL_URL points to the rabe.app domain", () => {
    expect(typeof RABE_INSTALL_URL).toBe("string");
    expect(RABE_INSTALL_URL).toContain("rabe.app");
  });

  it("RABE_INSTALL_URL is a valid https URL", () => {
    expect(RABE_INSTALL_URL).toMatch(/^https:\/\//);
  });
});
