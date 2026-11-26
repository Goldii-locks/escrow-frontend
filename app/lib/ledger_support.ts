/**
 * ledger_support: browser capability checks and copy for Ledger hardware
 * wallet signing (issue #853). The kit's Ledger module talks to the device
 * over WebHID/WebUSB, which Firefox and Safari do not implement.
 */

export const LEDGER_WALLET_ID = "ledger";

export const LEDGER_UNSUPPORTED_MESSAGE =
  "Ledger needs WebHID or WebUSB, which this browser does not support. Use Chrome, Edge, Brave or Opera on desktop, or pick another wallet.";

export const LEDGER_CONFIRM_MESSAGE = "Confirm on your device";

/** Ledger requires user confirmation on the device, so allow more than the 60s default. */
export const LEDGER_SIGNATURE_TIMEOUT_MS = 180_000;

export function isLedgerSupported(nav: unknown = typeof navigator === "undefined" ? undefined : navigator): boolean {
  if (!nav || typeof nav !== "object") return false;
  return "hid" in nav || "usb" in nav;
}
