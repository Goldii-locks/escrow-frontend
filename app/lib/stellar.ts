const STELLAR_EXPERT_TESTNET = "https://stellar.expert/explorer/testnet";

export function getStellarExpertTxUrl(txHash: string): string {
  return `${STELLAR_EXPERT_TESTNET}/tx/${txHash}`;
}

/** Link to a contract's Stellar Expert page (shows its transaction history). */
export function getStellarExpertContractUrl(contractId: string): string {
  return `${STELLAR_EXPERT_TESTNET}/contract/${contractId}`;
}
