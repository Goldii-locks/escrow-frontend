import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkLedgerAvailability,
  classifyTransportType,
  detectLedgerTransport,
  LEDGER_SETUP_INSTRUCTION,
  LEDGER_SETUP_URL,
  LEDGER_SUPPORTED_BROWSERS,
  warnOnMissingLedgerTransport,
} from "@/app/lib/ledger_usb_bridge";

describe("ledger_usb_bridge transport availability detection", () => {
  afterEach(() => {
    const nav = navigator as unknown as Record<string, unknown>;
    delete nav["usb"];
    delete nav["hid"];
  });

  it("detectLedgerTransport returns both false when no APIs are present", () => {
    expect(detectLedgerTransport()).toEqual({
      hasWebUsb: false,
      hasWebHid: false,
    });
  });

  it("detectLedgerTransport reports hasWebUsb when navigator.usb exists", () => {
    (navigator as unknown as Record<string, unknown>)["usb"] = {};
    expect(detectLedgerTransport()).toEqual({
      hasWebUsb: true,
      hasWebHid: false,
    });
  });

  it("detectLedgerTransport reports hasWebHid when navigator.hid exists", () => {
    (navigator as unknown as Record<string, unknown>)["hid"] = {};
    expect(detectLedgerTransport()).toEqual({
      hasWebUsb: false,
      hasWebHid: true,
    });
  });

  it("detectLedgerTransport reports both true when both APIs exist", () => {
    const nav = navigator as unknown as Record<string, unknown>;
    nav["usb"] = {};
    nav["hid"] = {};
    expect(detectLedgerTransport()).toEqual({
      hasWebUsb: true,
      hasWebHid: true,
    });
  });

  it("honours an injected detector callback", () => {
    expect(
      detectLedgerTransport(() => ({ hasWebUsb: true, hasWebHid: false }))
    ).toEqual({ hasWebUsb: true, hasWebHid: false });
    expect(
      detectLedgerTransport(() => ({ hasWebUsb: false, hasWebHid: true }))
    ).toEqual({ hasWebUsb: false, hasWebHid: true });
    expect(
      detectLedgerTransport(() => ({ hasWebUsb: false, hasWebHid: false }))
    ).toEqual({ hasWebUsb: false, hasWebHid: false });
  });

  it("classifyTransportType returns the correct combined label", () => {
    expect(classifyTransportType(true, true)).toBe("both");
    expect(classifyTransportType(true, false)).toBe("webusb");
    expect(classifyTransportType(false, true)).toBe("webhid");
    expect(classifyTransportType(false, false)).toBe("none");
  });

  it("checkLedgerAvailability returns setup instructions when no transport is available", () => {
    const state = checkLedgerAvailability(() => ({
      hasWebUsb: false,
      hasWebHid: false,
    }));
    expect(state.available).toBe(false);
    expect(state.status).toBe("unavailable");
    expect(state.transportType).toBe("none");
    expect(state.setupInstruction).toBe(LEDGER_SETUP_INSTRUCTION);
    expect(state.warningMessage).toBe(LEDGER_SETUP_INSTRUCTION);
    expect(state.setupInstruction).toMatch(/browser/i);
    expect(state.setupInstruction).toMatch(/WebUSB|WebHID/i);
    expect(state.setupInstruction).toContain(LEDGER_SUPPORTED_BROWSERS);
  });

  it("checkLedgerAvailability clears instructions when WebUSB is present", () => {
    const state = checkLedgerAvailability(() => ({
      hasWebUsb: true,
      hasWebHid: false,
    }));
    expect(state.available).toBe(true);
    expect(state.status).toBe("available");
    expect(state.transportType).toBe("webusb");
    expect(state.setupInstruction).toBeNull();
    expect(state.warningMessage).toBeNull();
  });

  it("checkLedgerAvailability clears instructions when only WebHID is present", () => {
    const state = checkLedgerAvailability(() => ({
      hasWebUsb: false,
      hasWebHid: true,
    }));
    expect(state.available).toBe(true);
    expect(state.status).toBe("available");
    expect(state.transportType).toBe("webhid");
    expect(state.setupInstruction).toBeNull();
    expect(state.warningMessage).toBeNull();
  });

  it("checkLedgerAvailability reports 'both' transport type when supported", () => {
    const state = checkLedgerAvailability(() => ({
      hasWebUsb: true,
      hasWebHid: true,
    }));
    expect(state.available).toBe(true);
    expect(state.transportType).toBe("both");
  });

  it("checkLedgerAvailability returns error status when the detector throws", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = checkLedgerAvailability(() => {
      throw new Error("detector boom");
    });

    expect(state.available).toBe(false);
    expect(state.status).toBe("error");
    expect(state.transportType).toBe("none");
    expect(state.setupInstruction).toBe(LEDGER_SETUP_INSTRUCTION);
    expect(state.warningMessage).toMatch(
      /Unable to verify Ledger transport support/i
    );
    expect(warnSpy).toHaveBeenCalled();
    const logged = String(warnSpy.mock.calls[0][0]);
    expect(logged).toContain("[ledger_usb_bridge]");
    warnSpy.mockRestore();
  });

  it("LEDGER_SETUP_INSTRUCTION and LEDGER_SETUP_URL are helpful fallbacks", () => {
    expect(LEDGER_SETUP_INSTRUCTION).toMatch(/Ledger/i);
    expect(LEDGER_SETUP_INSTRUCTION).toMatch(/USB|Bluetooth/i);
    expect(LEDGER_SETUP_URL).toContain("ledger.com");
  });

  it("available transport does not imply a device is connected (separate concern)", () => {
    const state = checkLedgerAvailability(() => ({
      hasWebUsb: true,
      hasWebHid: true,
    }));
    expect(state.available).toBe(true);
    expect(state.warningMessage).toBeNull();
  });
});

describe("warnOnMissingLedgerTransport", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("shows a warning toast with setup instructions when transport is missing", () => {
    const showToast = vi.fn();
    const state = warnOnMissingLedgerTransport(showToast, () => ({
      hasWebUsb: false,
      hasWebHid: false,
    }));

    expect(state.available).toBe(false);
    expect(showToast).toHaveBeenCalledWith(
      LEDGER_SETUP_INSTRUCTION,
      "warning"
    );
  });

  it("does not toast when transport APIs are available (WebUSB only)", () => {
    const showToast = vi.fn();
    const state = warnOnMissingLedgerTransport(showToast, () => ({
      hasWebUsb: true,
      hasWebHid: false,
    }));

    expect(state.available).toBe(true);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("does not toast when transport APIs are available (WebHID only)", () => {
    const showToast = vi.fn();
    const state = warnOnMissingLedgerTransport(showToast, () => ({
      hasWebUsb: false,
      hasWebHid: true,
    }));

    expect(state.available).toBe(true);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("toasts when the availability check errors", () => {
    const showToast = vi.fn();
    const state = warnOnMissingLedgerTransport(showToast, () => {
      throw new Error("boom");
    });

    expect(state.status).toBe("error");
    expect(showToast).toHaveBeenCalledWith(
      expect.stringMatching(/Unable to verify Ledger transport support/i),
      "warning"
    );
  });
});
