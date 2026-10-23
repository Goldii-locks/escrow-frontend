// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ALBEDO_INSTALL_URL,
  ALBEDO_SETUP_INSTRUCTION,
  checkAlbedoAvailability,
  detectAlbedoExtension,
  warnOnMissingAlbedo,
} from "@/app/lib/albedo_connector";

describe("albedo_connector detectAlbedoExtension (#123)", () => {
  afterEach(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w["albedo"];
    delete w["albedoApi"];
  });

  it("returns false when no wallet globals are present", () => {
    expect(detectAlbedoExtension()).toBe(false);
  });

  it("returns true when window.albedo is present", () => {
    (window as unknown as Record<string, unknown>)["albedo"] = {};
    expect(detectAlbedoExtension()).toBe(true);
  });

  it("returns true when window.albedoApi is present", () => {
    (window as unknown as Record<string, unknown>)["albedoApi"] = {};
    expect(detectAlbedoExtension()).toBe(true);
  });

  it("honours an injected detector callback", () => {
    expect(detectAlbedoExtension(() => true)).toBe(true);
    expect(detectAlbedoExtension(() => false)).toBe(false);
  });

  it("uses the detector callback even when wallet globals are present", () => {
    (window as unknown as Record<string, unknown>)["albedo"] = {};
    expect(detectAlbedoExtension(() => false)).toBe(false);
  });
});

describe("albedo_connector checkAlbedoAvailability (#123)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns available=true and clears all messages when the wallet is present", () => {
    const state = checkAlbedoAvailability(() => true);

    expect(state.available).toBe(true);
    expect(state.status).toBe("available");
    expect(state.setupInstruction).toBeNull();
    expect(state.warningMessage).toBeNull();
  });

  it("returns available=false with setup instructions when the wallet is missing", () => {
    const state = checkAlbedoAvailability(() => false);

    expect(state.available).toBe(false);
    expect(state.status).toBe("unavailable");
    expect(state.setupInstruction).toBe(ALBEDO_SETUP_INSTRUCTION);
    expect(state.warningMessage).toBe(ALBEDO_SETUP_INSTRUCTION);
  });

  it("setup instruction mentions install, refresh, and albedo", () => {
    const state = checkAlbedoAvailability(() => false);

    expect(state.setupInstruction).toMatch(/install/i);
    expect(state.setupInstruction).toMatch(/refresh/i);
    expect(state.setupInstruction).toMatch(/albedo/i);
  });

  it("returns error status and fallback messages when the detector throws", () => {
    const state = checkAlbedoAvailability(() => {
      throw new Error("detector boom");
    });

    expect(state.available).toBe(false);
    expect(state.status).toBe("error");
    expect(state.setupInstruction).toBe(ALBEDO_SETUP_INSTRUCTION);
    expect(state.warningMessage).toMatch(/Unable to verify wallet availability/i);
  });

  it("logs a formatted albedo_connector warning block when the detector throws", () => {
    checkAlbedoAvailability(() => {
      throw new Error("detector exploded");
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[albedo_connector]");
    expect(logged).toContain("--- stack trace ---");
  });

  it("does not log when the wallet is available", () => {
    checkAlbedoAvailability(() => true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not log when the wallet is simply missing (unavailable)", () => {
    checkAlbedoAvailability(() => false);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("albedo_connector warnOnMissingAlbedo (#123)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("shows a warning toast with setup instructions when the wallet is missing", () => {
    const showToast = vi.fn();
    const state = warnOnMissingAlbedo(showToast, () => false);

    expect(state.available).toBe(false);
    expect(showToast).toHaveBeenCalledWith(ALBEDO_SETUP_INSTRUCTION, "warning");
  });

  it("does not call showToast when the wallet is available", () => {
    const showToast = vi.fn();
    const state = warnOnMissingAlbedo(showToast, () => true);

    expect(state.available).toBe(true);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("calls showToast with the error message when the detector throws", () => {
    const showToast = vi.fn();
    const state = warnOnMissingAlbedo(showToast, () => {
      throw new Error("extension check failed");
    });

    expect(state.status).toBe("error");
    expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/Unable to verify wallet availability/i),
      "warning"
    );
  });
});

describe("albedo_connector availability constants (#123)", () => {
  it("ALBEDO_SETUP_INSTRUCTION is a non-empty helpful string", () => {
    expect(typeof ALBEDO_SETUP_INSTRUCTION).toBe("string");
    expect(ALBEDO_SETUP_INSTRUCTION.length).toBeGreaterThan(0);
    expect(ALBEDO_SETUP_INSTRUCTION).toMatch(/albedo/i);
    expect(ALBEDO_SETUP_INSTRUCTION).toMatch(/install/i);
    expect(ALBEDO_SETUP_INSTRUCTION).toMatch(/refresh/i);
  });

  it("ALBEDO_INSTALL_URL is a valid https URL pointing at albedo.link", () => {
    expect(typeof ALBEDO_INSTALL_URL).toBe("string");
    expect(ALBEDO_INSTALL_URL).toMatch(/^https:\/\//);
    expect(ALBEDO_INSTALL_URL).toContain("albedo.link");
  });
});
