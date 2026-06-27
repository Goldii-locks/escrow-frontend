const STELLAR_EXPERT_TESTNET = "https://stellar.expert/explorer/testnet";

export function getStellarExpertTxUrl(txHash: string): string {
  return `${STELLAR_EXPERT_TESTNET}/tx/${txHash}`;
}
