/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "@creit.tech/stellar-wallets-kit" {
  export const Networks: Record<string, string>;
  export class StellarWalletsKit {
    constructor(options: any);
    static init(options: any): void;
    static getNetwork(): Promise<any>;
    static getAddress(): Promise<any>;
    static setWallet(walletId: any): void;
    static authModal(options?: any): Promise<any>;
    static disconnect(): Promise<any>;
    static signTransaction(tx: any, opts?: any): Promise<any>;
    connect(): Promise<any>;
    disconnect(): Promise<any>;
    getPublicKey(): Promise<string>;
    signTransaction(tx: any, opts?: any): Promise<any>;
    setNetwork(network: string): void;
    openModal(options?: any): Promise<any>;
  }
  export const SUPPORTED_WALLETS: any[];
  export const WalletNetwork: Record<string, string>;
}

declare module "@creit.tech/stellar-wallets-kit/modules/utils" {
  export const defaultModules: (options?: any) => any[];
}

declare module "@creit.tech/stellar-wallets-kit/modules/wallet-connect" {
  export const WALLET_CONNECT_ID: string;
  export enum WalletConnectTargetChain {
    PUBLIC = "stellar:pubnet",
    TESTNET = "stellar:testnet",
  }
  export interface TWalletConnectModuleParams {
    projectId: string;
    metadata: {
      name: string;
      description: string;
      url: string;
      icons: string[];
    };
    allowedChains?: WalletConnectTargetChain[];
  }
  export class WalletConnectModule {
    productId: string;
    productName: string;
    constructor(params: TWalletConnectModuleParams);
  }
}

declare module "@creit.tech/stellar-wallets-kit/modules/lobstr" {
  export const LOBSTR_ID: string;
  export class LobstrModule {
    productId: string;
    productName: string;
  }
}
