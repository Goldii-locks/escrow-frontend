/**
 * Every localStorage key that can hold wallet identity (addresses, sessions).
 * Disconnect must clear all of them so a shared computer does not leak the
 * previous user's identity. Strings are duplicated here on purpose so this
 * module has no dependency on the individual connector modules.
 */
export const WALLET_SESSION_STORAGE_KEYS: readonly string[] = [
  "milesto_wallet_connected",
  "wallet_state_store_active_state",
  "freighter_connector_active_address",
  "ledger_usb_bridge_active_addresses",
  "albedo_connector_active_session",
  "rabe_active_address_cache",
  "transaction_signer_active_session",
  "wallet_selector_modal_active_key",
  "wallet_disconnect_active_keys",
  "network_sync_active_address_state",
  "signature_timeout_alert_active_address",
];

/** Removes all known wallet session keys from the given storage. */
export function clearAllWalletSessionStorage(storage?: Pick<Storage, "removeItem"> | null): void {
  let target = storage;
  if (target === undefined) {
    try {
      target = typeof window !== "undefined" ? window.localStorage : null;
    } catch {
      target = null;
    }
  }
  if (!target) return;
  for (const key of WALLET_SESSION_STORAGE_KEYS) {
    try {
      target.removeItem(key);
    } catch {
      // Storage may be unavailable; keep clearing the remaining keys.
    }
  }
}
