/**
 * Blockchain & Network Types
 * 
 * Centralized blockchain, network, and token type definitions for MCPay.tech
 * Includes chain configurations, token information, and balance tracking types.
 */

// =============================================================================
// CORE BLOCKCHAIN TYPES
// =============================================================================

export type Network = 'base-sepolia' | 'sei-testnet';

export type BlockchainArchitecture = 'evm' | 'solana' | 'near' | 'cosmos' | 'bitcoin';

export type TokenCategory = 'stablecoin' | 'utility' | 'defi' | 'meme' | 'governance' | 'wrapped';

export type StablecoinSymbol = 'USDC' | 'USDT' | 'DAI' | 'BUSD' | 'FRAX' | 'TUSD' | 'USDP';

/** Generic address type that can handle different blockchain address formats */
export type BlockchainAddress = string;

// =============================================================================
// TOKEN TYPES
// =============================================================================

export interface TokenInfo {
  symbol: string;
  name: string;
  network: Network;
  decimals: number;
  category: TokenCategory;
  logoUri?: string;
  coingeckoId?: string;
  isStablecoin: boolean;
  isNative: boolean;
  chainId: number;
  tags: string[];
  description?: string;
  website?: string;
  twitter?: string;
  discord?: string;
  // Payment-specific metadata
  popularityScore: number; // 1-100, higher = more popular for payments
  liquidityTier: 'high' | 'medium' | 'low';
  recommendedForPayments: boolean;
  // Data source verification
  verified: boolean;
  verificationSource?: string;
}

export interface NetworkInfo {
  name: string;
  chainId: number;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  iconUrl?: string;
  isTestnet: boolean;
}

// =============================================================================
// AMOUNT AND FORMATTING TYPES
// =============================================================================

export interface FormatAmountOptions {
  /** Token symbol to display (e.g., "USDC", "ETH") */
  symbol?: string;
  /** Maximum number of decimal places to show */
  precision?: number;
  /** Whether to use compact notation for large numbers (K, M, B, T) */
  compact?: boolean;
  /** Minimum number of decimal places to show (pads with zeros) */
  minDecimals?: number;
  /** Whether to show the symbol */
  showSymbol?: boolean;
  /** Locale for number formatting */
  locale?: string;
  /** Number notation style */
  notation?: 'standard' | 'scientific' | 'engineering' | 'compact';
  /** Currency for formatting */
  currency?: string;
  /** Minimum fraction digits */
  minimumFractionDigits?: number;
  /** Maximum fraction digits */
  maximumFractionDigits?: number;
  /** Whether to use grouping separators */
  useGrouping?: boolean;
  /** Sign display options */
  signDisplay?: 'auto' | 'never' | 'always' | 'exceptZero';
}

export interface DbAmountRecord {
  amount: string;
  currency: string;
  network: Network;
  timestamp: Date;
  // Additional DB format
  amount_raw?: string;
  token_decimals?: number;
}

export type RevenueByCurrency = Record<string, string>;

// =============================================================================
// STABLECOIN TYPES
// =============================================================================

export interface StablecoinConfig {
  symbol: StablecoinSymbol;
  name: string;
  decimals: number;
  coingeckoId?: string;
  isPegged: boolean;
  pegTarget?: number;
  networks?: Record<Network, {
    address: BlockchainAddress;
    isNative?: boolean;
  }>;
}

export interface StablecoinBalance {
  address: BlockchainAddress;
  chain: string;
  chainId: string | number;
  chainName: string;
  architecture: BlockchainArchitecture;
  isTestnet: boolean;
  stablecoin: StablecoinSymbol;
  stablecoinName: string;
  tokenIdentifier: string;
  balance: bigint;
  formattedBalance: string;
  decimals: number;
  priceUsd: number;
  fiatValue: number;
  // Additional fields from different implementations
  symbol?: StablecoinSymbol;
  name?: string;
  usdValue?: string;
  network?: Network;
  isNative?: boolean;
  error?: string;
  isLoading?: boolean;
  lastUpdated?: Date;
  pricePerToken?: string;
}

export interface StablecoinBalanceError {
  address: BlockchainAddress;
  chain: string;
  chainId: string | number;
  chainName: string;
  architecture: BlockchainArchitecture;
  isTestnet: boolean;
  stablecoin: StablecoinSymbol;
  tokenIdentifier: string;
  error: string;
  // Additional error details
  symbol?: StablecoinSymbol;
  network?: Network;
  code?: string;
  details?: any;
  timestamp?: Date;
  retryable?: boolean;
  retryAfter?: number;
  context?: {
    address?: BlockchainAddress;
    rpcUrl?: string;
    blockNumber?: number;
  };
}

// =============================================================================
// MULTI-CHAIN BALANCE TRACKING
// =============================================================================

export interface MultiChainStablecoinResult {
  balances: StablecoinBalance[];
  errors: StablecoinBalanceError[];
  totalUsdValue: string;
  lastUpdated: Date;
  isLoading: boolean;
  networks: Network[];
}

export interface StablecoinClient {
  getBalance(address: BlockchainAddress): Promise<StablecoinBalance>;
  getPrice(): Promise<number>;
}

// =============================================================================
// CHAIN CONFIGURATION TYPES
// =============================================================================

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
  // Additional fields
  displayName?: string;
  currency?: string;
  blockExplorer?: string;
  rpcUrls?: string[];
  blockExplorers?: string[];
  blockExplorerUrls?: string[];
}

export interface EVMTokenConfig {
  address: string;
  symbol: StablecoinSymbol;
  decimals?: number;
}

export interface SolanaTokenConfig {
  mint: string;
  symbol: StablecoinSymbol;
  decimals?: number;
}

export interface NearTokenConfig {
  contract: string;
  symbol: StablecoinSymbol;
  decimals?: number;
}

export interface EVMChainConfig extends BaseChainConfig {
  architecture: 'evm';
  chainId: number;
  stablecoins: EVMTokenConfig[];
  // Legacy support
  tokens?: Record<StablecoinSymbol, EVMTokenConfig>;
}

export interface SolanaChainConfig extends BaseChainConfig {
  architecture: 'solana';
  chainId: string;
  cluster?: 'devnet' | 'testnet' | 'mainnet-beta';
  stablecoins: SolanaTokenConfig[];
  // Legacy support
  tokens?: Record<StablecoinSymbol, SolanaTokenConfig>;
}

export interface NearChainConfig extends BaseChainConfig {
  architecture: 'near';
  chainId: string;
  networkId?: string;
  stablecoins: NearTokenConfig[];
  // Legacy support
  tokens?: Record<StablecoinSymbol, NearTokenConfig>;
}

export type ChainConfig = EVMChainConfig | SolanaChainConfig | NearChainConfig;

// =============================================================================
// PRICE PROVIDER TYPES
// =============================================================================

export interface PriceProvider {
  getPrice(symbol: StablecoinSymbol): Promise<number>;
  getPrices(symbols: StablecoinSymbol[]): Promise<Record<StablecoinSymbol, number>>;
  // Legacy support
  getPrices?(symbols: string[]): Promise<Record<string, number>>;
  getPrice?(symbol: string): Promise<number>;
}

// =============================================================================
// UI BALANCE TYPES
// =============================================================================

export interface ChainBalance {
  chainId: number;
  chainName: string;
  balance: string;
  formattedBalance: string;
  usdValue?: string;
}

export interface BalancesByChain {
  [chainId: number]: {
    chainName: string;
    balances: {
      [tokenSymbol: string]: ChainBalance;
    };
  };
}

// =============================================================================
// WALLET PROVIDER TYPES
// =============================================================================

export interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (eventName: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (eventName: string, handler: (...args: unknown[]) => void) => void;
}

export interface WalletWindow {
  ethereum?: EthereumProvider;
}

export interface WalletError extends Error {
  code: number;
  data?: unknown;
}

// =============================================================================
// LEGACY SUPPORT TYPES
// =============================================================================

/** Legacy type for backward compatibility */
/** Supported blockchain chains - these should match the keys in SUPPORTED_CHAINS */
export type SupportedChain = 'ethereum' | 'base' | 'polygon' | 'arbitrum' | 'optimism' | 'avalanche' | 'bsc' | 'sei' | 'near' | 'base-sepolia' | 'sei-testnet';

// =============================================================================
// CONSTANTS
// =============================================================================

// =============================================================================
// BALANCE TRACKING TYPES
// =============================================================================

/** Multi-chain stablecoin balance result with mainnet/testnet separation */
export interface MultiChainStablecoinResult {
  balances: StablecoinBalance[];
  errors: StablecoinBalanceError[];
  // Separate totals for mainnet and testnet
  totalFiatValue: number; // Total fiat value from mainnet chains only
  testnetTotalFiatValue: number; // Total fiat value from testnet chains (for display purposes)
  mainnetBalances: StablecoinBalance[]; // Mainnet balances only
  testnetBalances: StablecoinBalance[]; // Testnet balances only
  balancesByChain: Partial<Record<SupportedChain, StablecoinBalance[]>>;
  balancesByStablecoin: Partial<Record<StablecoinSymbol, StablecoinBalance[]>>;
  // Separate groupings for mainnet and testnet
  mainnetBalancesByChain: Partial<Record<SupportedChain, StablecoinBalance[]>>;
  testnetBalancesByChain: Partial<Record<SupportedChain, StablecoinBalance[]>>;
  mainnetBalancesByStablecoin: Partial<Record<StablecoinSymbol, StablecoinBalance[]>>;
  testnetBalancesByStablecoin: Partial<Record<StablecoinSymbol, StablecoinBalance[]>>;
  summary: {
    totalAccounts: number;
    totalChainsChecked: number;
    totalStablecoinsChecked: number;
    successfulChecks: number;
    failedChecks: number;
    // Additional testnet/mainnet breakdown
    mainnetChainsChecked: number;
    testnetChainsChecked: number;
    mainnetSuccessfulChecks: number;
    testnetSuccessfulChecks: number;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const COMMON_DECIMALS = {
  USDC: 6,
  USDT: 6,
  ETH: 18,
  WETH: 18,
  DAI: 18,
  WBTC: 8,
  BTC: 8,
} as const;