/**
 * Blockchain and chain-related types
 */

import type { Address } from "viem";

/** Simple chain configuration with USDC info */
export type ChainConfig = {
    usdcAddress: Address;
    usdcName: string;
};

// =============================================================================
// COMPREHENSIVE BLOCKCHAIN CONFIGURATION TYPES
// =============================================================================

/** Blockchain architecture types */
export type BlockchainArchitecture = 'evm' | 'solana' | 'near';

/** Stablecoin symbols */
export type StablecoinSymbol = 'USDC' | 'USDT' | 'DAI' | 'BUSD' | 'FRAX' | 'LUSD' | 'sUSD' | 'TUSD' | 'USDP' | 'USTC' | 'DOLA' | 'MIMATIC' | 'MIM' | 'FEI' | 'TERRA_USD' | 'AGEUR' | 'EURT' | 'EURS' | 'JEUR' | 'PAR' | 'XCHF' | 'TRYB' | 'XIDR' | 'XSGD' | 'CADC' | 'BIDR' | 'IDRT' | 'MXNT' | 'TCAD';

/** EVM token configuration */
export interface EVMTokenConfig {
  address: Address;
  symbol: StablecoinSymbol;
}

/** Solana token configuration */
export interface SolanaTokenConfig {
  mint: string;
  symbol: StablecoinSymbol;
}

/** Near token configuration */
export interface NearTokenConfig {
  contract: string;
  symbol: StablecoinSymbol;
}

/** Base chain configuration */
export interface BaseChainConfig {
  chainId: string | number;
  name: string;
  architecture: BlockchainArchitecture;
  rpcUrl: string;
  isTestnet: boolean;
  nativeCurrency: {
    symbol: string;
    decimals: number;
  };
}

/** EVM chain configuration */
export interface EVMChainConfig extends BaseChainConfig {
  architecture: 'evm';
  chainId: number;
  stablecoins: EVMTokenConfig[];
}

/** Solana chain configuration */
export interface SolanaChainConfig extends BaseChainConfig {
  architecture: 'solana';
  chainId: string;
  stablecoins: SolanaTokenConfig[];
}

/** Near chain configuration */
export interface NearChainConfig extends BaseChainConfig {
  architecture: 'near';
  chainId: string;
  stablecoins: NearTokenConfig[];
}

/** Comprehensive chain configuration union */
export type ChainConfigExtended = EVMChainConfig | SolanaChainConfig | NearChainConfig;

// =============================================================================
// PRICE PROVIDER TYPES
// =============================================================================

/** Price provider interface */
export interface PriceProvider {
  getPrice(symbol: StablecoinSymbol): Promise<number>;
  getPrices(symbols: StablecoinSymbol[]): Promise<Record<StablecoinSymbol, number>>;
}

// =============================================================================
// COMMON DECIMALS
// =============================================================================

/** Common token decimals */
export const COMMON_DECIMALS = {
  USDC: 6,
  USDT: 6,
  ETH: 18,
  WETH: 18,
  DAI: 18,
  WBTC: 8,
  BTC: 8,
} as const;