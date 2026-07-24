declare module "@creit.tech/stellar-wallets-kit" {
  export enum Networks {
    PUBLIC = "Public Global Stellar Network ; September 2015",
    TESTNET = "Test SDF Network ; September 2015",
    STANDALONE = "Standalone Network ; February 2017",
    FUTURENET = "Test SDF Future Network ; October 2022",
    SANDBOX = "Local Sandbox Stellar Network ; September 2022",
  }

  export interface ModuleProduct {
    productId: string;
    [key: string]: unknown;
  }

  export interface InitParams {
    modules?: ModuleProduct[];
    network?: Networks;
    authModal?: {
      showInstallLabel?: boolean;
      hideUnsupportedWallets?: boolean;
    };
  }

  export interface NetworkResult {
    network: Networks;
    networkPassphrase: string;
  }

  export interface AddressResult {
    address?: string;
  }

  export interface SignTransactionParams {
    address: string;
    networkPassphrase: string;
    [key: string]: unknown;
  }

  export interface SignTransactionResult {
    signedTxXdr?: string;
    [key: string]: unknown;
  }

  export const StellarWalletsKit: {
    init: (params: InitParams) => Promise<void> | void;
    setWallet: (id: string) => Promise<void> | void;
    getAddress: () => Promise<AddressResult>;
    authModal: () => Promise<AddressResult>;
    disconnect: () => Promise<void> | void;
    signTransaction: (
      xdr: string,
      params: SignTransactionParams
    ) => Promise<SignTransactionResult>;
    getNetwork: () => Promise<NetworkResult>;
  };
}

declare module "@creit.tech/stellar-wallets-kit/modules/utils" {
  export interface DefaultModulesOptions {
    filterBy?: (module: { productId: string }) => boolean;
  }

  export function defaultModules(
    options?: DefaultModulesOptions
  ): { productId: string }[];
}
