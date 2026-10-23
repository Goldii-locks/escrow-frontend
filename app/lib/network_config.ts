/**
 * Deploy-time network constants with no @stellar/stellar-sdk dependency, so
 * the landing page can read them without pulling the SDK into its bundle.
 * Values match the SDK's `Networks` enum.
 */
export const NETWORK_PASSPHRASES = {
  TESTNET: "Test SDF Network ; September 2015",
  PUBLIC: "Public Global Stellar Network ; September 2015",
  FUTURENET: "Test SDF Future Network ; October 2022",
} as const;

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_SOROBAN_NETWORK_PASSPHRASE || NETWORK_PASSPHRASES.TESTNET;
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "";
