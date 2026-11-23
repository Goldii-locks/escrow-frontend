/**
 * Deploy-time contract configuration.
 *
 * The SDK-dependent helpers that used to live here were never called by the
 * application (all transaction building happens in the backend). Keeping this
 * entry point free of `@stellar/stellar-sdk` prevents the SDK from landing in
 * every route's first-load bundle (#850).
 */
export {
  CONTRACT_ID,
  NETWORK_PASSPHRASE,
  RPC_URL,
  STELLAR_NETWORK_PASSPHRASES,
} from "./network_config";
