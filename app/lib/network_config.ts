/**
 * Network constants shared by browser code.
 *
 * This module deliberately has no Stellar SDK imports. It is pulled into the
 * root layout through several shared helpers, so importing the SDK here would
 * put the whole wallet stack in every route's first load (#850).
 */

export const STELLAR_NETWORK_PASSPHRASES = {
  PUBLIC: "Public Global Stellar Network ; September 2015",
  TESTNET: "Test SDF Network ; September 2015",
  FUTURENET: "Test SDF Future Network ; October 2022",
  SANDBOX: "Local Sandbox Stellar Network ; September 2022",
  STANDALONE: "Standalone Network ; February 2017",
} as const;

export const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
  "https://soroban-testnet.stellar.org";

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE ||
  STELLAR_NETWORK_PASSPHRASES.TESTNET;

export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "";
