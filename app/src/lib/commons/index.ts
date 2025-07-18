/**
 * MCPay Commons Library
 * 
 * A unified library containing all common token operations, amount handling,
 * and blockchain configurations for both frontend and backend usage.
 * 
 * This library consolidates:
 * - Token registry and metadata
 * - Amount conversion and arithmetic utilities  
 * - Blockchain and network configurations
 * - Multi-chain stablecoin tracking
 * - Type definitions and utility functions
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type {
  // Blockchain & Network Types
  Network,
  BlockchainArchitecture,
  TokenCategory,
  StablecoinSymbol,
  BlockchainAddress,
  
  // Token Types
  TokenInfo,
  NetworkInfo,
  
  // Amount Types
  FormatAmountOptions,
  DbAmountRecord,
  RevenueByCurrency,
  
  // Balance Tracking Types
  StablecoinConfig,
  StablecoinBalance,
  StablecoinBalanceError,
  
  // Chain Configuration Types
  EVMTokenConfig,
  SolanaTokenConfig,
  NearTokenConfig,
  BaseChainConfig,
  EVMChainConfig,
  SolanaChainConfig,
  NearChainConfig,
  ChainConfig,
  
  // Price Provider Types
  PriceProvider,
} from '@/types';

// =============================================================================
// AMOUNT UTILITIES EXPORTS
// =============================================================================

export {
  // Core conversion functions
  toBaseUnits,
  fromBaseUnits,
  formatAmount,
  
  // Arithmetic operations
  addAmounts,
  subtractAmounts,
  compareAmounts,
  isZeroAmount,
  
  // User input parsing
  parseUserAmount,
  
  // Validation
  validateBaseAmount,
  
  // Database integration
  toDbAmount,
  fromDbAmount,
  formatDbAmount,
  validateDbAmount,
  aggregateDbAmounts,
  
  // Multi-currency revenue operations
  createCurrencyKey,
  parseCurrencyKey,
  addRevenueToCurrency,
  mergeRevenueByCurrency,
  formatRevenueByCurrency,
  getRevenueByCurrency,
  hasRevenue,
  
  // Error class
  AmountConversionError,
} from './amounts';

// =============================================================================
// TOKEN REGISTRY EXPORTS
// =============================================================================

export {
  // Network configurations
  NETWORKS,
  
  // Token registry
  TOKEN_REGISTRY,
  
  // Search and lookup functions
  getTokenInfo,
  getTokenInfoByAddress,
  getTokensByNetwork,
  getVerifiedTokens,
  getSupportedNetworks,
  getRecommendedPaymentTokens,
  getStablecoins,
  getTokensBySymbol,
  searchTokensByName,
  
  // Network utilities
  getNetworkInfo,
  getNetworkByChainId,
  isValidToken,
  
  // Token formatting
  formatTokenAmount,
  
  // Address utilities
  getNativeTokenAddress,
  isNativeToken,
  getPopularTokens,
  isValidTokenAddress,
  getTokenVerification,
} from './tokens';

// =============================================================================
// CHAIN CONFIGURATION EXPORTS
// =============================================================================

export {
  // Stablecoin configurations
  STABLECOIN_CONFIGS,
  
  // Chain configurations
  SUPPORTED_CHAINS,
  
  // Type guards
  isEVMChain,
  isSolanaChain,
  isNearChain,
  
  // Chain utility functions
  getSupportedChains,
  getChainInfo,
  getChainsByArchitecture,
  getEVMChains,
  getSolanaChains,
  getNearChains,
  getMainnetChains,
  getTestnetChains,
  filterChainsByTestnetStatus,
  isTestnetChain,
  getChainByChainId,
  
  // Blockchain architecture mapping
  BLOCKCHAIN_TO_ARCHITECTURE,
  getBlockchainArchitecture,
  getBlockchainsForArchitecture,
  isSupportedBlockchain,
  
  // Address validation
  validateAddressFormat,
  getSupportedArchitectures,
  
  // Price provider
  SimplePriceProvider,
  
  // Chain types export
  type SupportedChain,
} from './chains';

// =============================================================================
// BALANCE TRACKER EXPORTS
// =============================================================================

export {
  // Balance checking functions
  getStablecoinBalanceOnChain,
  getStablecoinBalances,
  getStablecoinBalancesOnChains,
  getMainnetStablecoinBalances,
  getTestnetStablecoinBalances,
  
  // Result types
  type MultiChainStablecoinResult,
  
  // Example usage
  exampleUsage as balanceTrackerExample,
} from './balance-tracker';

// =============================================================================
// CONSTANTS & ENUMS
// =============================================================================

export { COMMON_DECIMALS } from '@/types';

// =============================================================================
// CONVENIENCE RE-EXPORTS
// =============================================================================

/**
 * Re-export the most commonly used functions for easier access
 */

// Amount operations (most common)
export {
  toBaseUnits as convertToBaseUnits,
  fromBaseUnits as convertFromBaseUnits,
  formatAmount as formatTokenValue,
} from './amounts';

// Token lookups (most common)
export {
  getTokenInfo as findToken,
  getTokensByNetwork as getNetworkTokens,
  getStablecoins as findStablecoins,
} from './tokens';

// Chain operations (most common)
export {
  getChainInfo as findChain,
  isTestnetChain as isTestnet,
  getEVMChains as getEvmChains,
} from './chains';

// Balance tracking (most common)
export {
  getStablecoinBalances as checkBalances,
  getMainnetStablecoinBalances as checkMainnetBalances,
  getTestnetStablecoinBalances as checkTestnetBalances,
} from './balance-tracker';

// =============================================================================
// UTILITY AGGREGATIONS
// =============================================================================

// Import the specific functions we need for utility functions
import type { Network } from '@/types';
import { COMMON_DECIMALS } from '@/types';
import { 
  toBaseUnits,
  fromBaseUnits,
  formatAmount,
  validateBaseAmount
} from './amounts';
import { 
  getTokenInfo, 
  getNetworkInfo, 
  getSupportedNetworks, 
  getRecommendedPaymentTokens, 
  getStablecoins,
  formatTokenAmount,
  TOKEN_REGISTRY,
  NETWORKS,
  isValidToken
} from './tokens';
import {
  STABLECOIN_CONFIGS,
  SUPPORTED_CHAINS,
  getChainInfo,
  validateAddressFormat
} from './chains';

/**
 * Get complete token information including chain config
 */
export function getCompleteTokenInfo(address: string, network: Network) {
  const token = getTokenInfo(address, network);
  const networkInfo = getNetworkInfo(network);
  
  return token && networkInfo ? {
    token,
    network: networkInfo,
    isTestnet: networkInfo.isTestnet,
    chainId: networkInfo.chainId,
  } : null;
}

/**
 * Get all payment-ready tokens across all networks
 */
export function getAllPaymentTokens() {
  const networks = getSupportedNetworks();
  const paymentTokens = [];
  
  for (const network of networks) {
    paymentTokens.push(...getRecommendedPaymentTokens(network));
  }
  
  return paymentTokens.sort((a, b) => b.popularityScore - a.popularityScore);
}

/**
 * Get all stablecoins across all networks
 */
export function getAllStablecoins() {
  const networks = getSupportedNetworks();
  const stablecoins = [];
  
  for (const network of networks) {
    stablecoins.push(...getStablecoins(network));
  }
  
  return stablecoins.sort((a, b) => b.popularityScore - a.popularityScore);
}

/**
 * Format amount with automatic token detection
 */
export function smartFormatAmount(
  amount: string,
  tokenAddress: string,
  network: Network,
  options?: {
    showSymbol?: boolean;
    precision?: number;
    compact?: boolean;
  }
) {
  const token = getTokenInfo(tokenAddress, network);
  if (!token) {
    return amount;
  }
  
  return formatTokenAmount(amount, tokenAddress, network, options);
}

// =============================================================================
// VERSION & METADATA
// =============================================================================

export const COMMONS_VERSION = '1.0.0';
export const COMMONS_NAME = 'MCPay Commons';

// Re-export main modules for direct access if needed
import * as Amounts from './amounts';
import * as Tokens from './tokens';
import * as Chains from './chains';
import * as BalanceTracker from './balance-tracker';
import * as Types from '@/types';

export { Amounts, Tokens, Chains, BalanceTracker, Types };

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

/**
 * Default export with organized namespaces
 */
export default {
  version: COMMONS_VERSION,
  name: COMMONS_NAME,
  
  // Modules
  amounts: Amounts,
  tokens: Tokens,
  chains: Chains,
  balanceTracker: BalanceTracker,
  types: Types,
  
  // Quick access to most common functions
  convert: {
    toBaseUnits,
    fromBaseUnits,
    formatAmount,
  },
  
  find: {
    token: getTokenInfo,
    chain: getChainInfo,
    stablecoins: getStablecoins,
  },
  
  validate: {
    address: validateAddressFormat,
    amount: validateBaseAmount,
    token: isValidToken,
  },
  
  // Balance tracking shortcuts
  balances: {
    check: BalanceTracker.getStablecoinBalances,
    checkMainnet: BalanceTracker.getMainnetStablecoinBalances,
    checkTestnet: BalanceTracker.getTestnetStablecoinBalances,
    checkOnChains: BalanceTracker.getStablecoinBalancesOnChains,
  },
  
  // Constants
  constants: {
    COMMON_DECIMALS,
    STABLECOIN_CONFIGS,
    SUPPORTED_CHAINS,
    TOKEN_REGISTRY,
    NETWORKS,
  },
};
