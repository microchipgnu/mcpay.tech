/**
 * Blockchain & Chain Configurations for MCPay Commons
 * 
 * This module provides comprehensive blockchain architecture support and
 * chain configurations for multi-chain operations including balance checking,
 * stablecoin tracking, and cross-chain compatibility.
 * 
 * Supported Blockchain Architectures:
 * - EVM: Ethereum Virtual Machine compatible chains
 * - Solana: Solana blockchain
 * - Near: Near Protocol
 * - Cosmos: Cosmos ecosystem
 * - Bitcoin: Bitcoin-based chains
 */

import type {
  BlockchainArchitecture,
  StablecoinSymbol,
  StablecoinConfig,
  ChainConfig,
  EVMChainConfig,
  SolanaChainConfig,
  NearChainConfig,
  EVMTokenConfig,
  SolanaTokenConfig,
  NearTokenConfig,
  BlockchainAddress,
  PriceProvider
} from '@/types';

// =============================================================================
// STABLECOIN CONFIGURATIONS
// =============================================================================

export const STABLECOIN_CONFIGS: Record<StablecoinSymbol, StablecoinConfig> = {
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    coingeckoId: 'usd-coin',
    isPegged: true,
    pegTarget: 1.0,
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    coingeckoId: 'tether',
    isPegged: true,
    pegTarget: 1.0,
  },
  DAI: {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    coingeckoId: 'dai',
    isPegged: true,
    pegTarget: 1.0,
  },
  BUSD: {
    symbol: 'BUSD',
    name: 'Binance USD',
    decimals: 18,
    coingeckoId: 'binance-usd',
    isPegged: true,
    pegTarget: 1.0,
  },
  FRAX: {
    symbol: 'FRAX',
    name: 'Frax',
    decimals: 18,
    coingeckoId: 'frax',
    isPegged: false,
    pegTarget: 1.0,
  },
  TUSD: {
    symbol: 'TUSD',
    name: 'TrueUSD',
    decimals: 18,
    coingeckoId: 'true-usd',
    isPegged: true,
    pegTarget: 1.0,
  },
  USDP: {
    symbol: 'USDP',
    name: 'Pax Dollar',
    decimals: 18,
    coingeckoId: 'paxos-standard',
    isPegged: true,
    pegTarget: 1.0,
  },
};

// =============================================================================
// SUPPORTED CHAINS CONFIGURATION
// =============================================================================

export const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  // EVM Chains
  baseSepolia: {
    architecture: 'evm',
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    isTestnet: true,
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    stablecoins: [
      { address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', symbol: 'USDC' },
      { address: '0x036cec1a199234fc02f72d29e596a58034100694', symbol: 'USDT' },
      { address: '0xf59d77573c53e81809c7d9eb7d83be9f4f412c4c', symbol: 'DAI' },
    ],
  } as EVMChainConfig,
  
  base: {
    architecture: 'evm',
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    isTestnet: false,
    nativeCurrency: { symbol: 'ETH', decimals: 18 },
    stablecoins: [
      { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC' },
      { address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', symbol: 'USDT' },
      { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI' },
    ],
  } as EVMChainConfig,

  seiTestnet: {
    architecture: 'evm',
    chainId: 1328,
    name: 'Sei Testnet',
    rpcUrl: 'https://evm-rpc-testnet.sei-apis.com',
    isTestnet: true,
    nativeCurrency: { symbol: 'SEI', decimals: 6 },
    stablecoins: [
      { address: '0x4fCF1784B31630811181f670Aea7A7bEF803eaED', symbol: 'USDC' },
    ],
  } as EVMChainConfig,

  // Additional EVM chains can be added here
  avalancheFuji: {
    architecture: 'evm',
    chainId: 43113,
    name: 'Avalanche Fuji',
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    isTestnet: true,
    nativeCurrency: { symbol: 'AVAX', decimals: 18 },
    stablecoins: [
      { address: '0x5425890298aed601595a70AB815c96711a31Bc65', symbol: 'USDC' },
    ],
  } as EVMChainConfig,

  avalanche: {
    architecture: 'evm',
    chainId: 43114,
    name: 'Avalanche',
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    isTestnet: false,
    nativeCurrency: { symbol: 'AVAX', decimals: 18 },
    stablecoins: [
      { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', symbol: 'USDC' },
      { address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', symbol: 'USDT' },
      { address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70', symbol: 'DAI' },
    ],
  } as EVMChainConfig,

  // Solana Chains
  solanaMainnet: {
    architecture: 'solana',
    chainId: 'mainnet-beta',
    name: 'Solana Mainnet',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    isTestnet: false,
    nativeCurrency: { symbol: 'SOL', decimals: 9 },
    stablecoins: [
      { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC' },
      { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', symbol: 'USDT' },
    ],
  } as SolanaChainConfig,

  solanaDevnet: {
    architecture: 'solana',
    chainId: 'devnet',
    name: 'Solana Devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    isTestnet: true,
    nativeCurrency: { symbol: 'SOL', decimals: 9 },
    stablecoins: [
      { mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', symbol: 'USDC' },
    ],
  } as SolanaChainConfig,

  // Near Chains
  nearMainnet: {
    architecture: 'near',
    chainId: 'mainnet',
    name: 'NEAR Mainnet',
    rpcUrl: 'https://rpc.mainnet.near.org',
    isTestnet: false,
    nativeCurrency: { symbol: 'NEAR', decimals: 24 },
    stablecoins: [
      { contract: 'a0b86991c431e3a7e3cd0c6b8b3a5e3b4e3a7e3cd0c.near', symbol: 'USDC' },
      { contract: 'usdt.tether-token.near', symbol: 'USDT' },
    ],
  } as NearChainConfig,

  nearTestnet: {
    architecture: 'near',
    chainId: 'testnet',
    name: 'NEAR Testnet',
    rpcUrl: 'https://rpc.testnet.near.org',
    isTestnet: true,
    nativeCurrency: { symbol: 'NEAR', decimals: 24 },
    stablecoins: [
      { contract: 'usdc.testnet', symbol: 'USDC' },
    ],
  } as NearChainConfig,
};

// SupportedChain type is now centralized in @/types

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isEVMChain(config: ChainConfig): config is EVMChainConfig {
  return config.architecture === 'evm';
}

export function isSolanaChain(config: ChainConfig): config is SolanaChainConfig {
  return config.architecture === 'solana';
}

export function isNearChain(config: ChainConfig): config is NearChainConfig {
  return config.architecture === 'near';
}

// =============================================================================
// CHAIN UTILITY FUNCTIONS
// =============================================================================

/**
 * Get all supported chains list
 */
export function getSupportedChains(): SupportedChain[] {
  return Object.keys(SUPPORTED_CHAINS) as SupportedChain[];
}

/**
 * Get chain info by chain key
 */
export function getChainInfo(chain: SupportedChain): ChainConfig | undefined {
  return SUPPORTED_CHAINS[chain];
}

/**
 * Get chains by blockchain architecture
 */
export function getChainsByArchitecture(architecture: BlockchainArchitecture): SupportedChain[] {
  return Object.entries(SUPPORTED_CHAINS)
    .filter(([, config]) => config.architecture === architecture)
    .map(([chainKey]) => chainKey as SupportedChain);
}

/**
 * Get all EVM chains
 */
export function getEVMChains(): SupportedChain[] {
  return getChainsByArchitecture('evm');
}

/**
 * Get all Solana chains
 */
export function getSolanaChains(): SupportedChain[] {
  return getChainsByArchitecture('solana');
}

/**
 * Get all Near chains
 */
export function getNearChains(): SupportedChain[] {
  return getChainsByArchitecture('near');
}

/**
 * Get all mainnet chains
 */
export function getMainnetChains(): SupportedChain[] {
  return Object.entries(SUPPORTED_CHAINS)
    .filter(([, config]) => !config.isTestnet)
    .map(([chainKey]) => chainKey as SupportedChain);
}

/**
 * Get all testnet chains
 */
export function getTestnetChains(): SupportedChain[] {
  return Object.entries(SUPPORTED_CHAINS)
    .filter(([, config]) => config.isTestnet)
    .map(([chainKey]) => chainKey as SupportedChain);
}

/**
 * Filter chains by testnet status
 */
export function filterChainsByTestnetStatus(chains: SupportedChain[], isTestnet: boolean): SupportedChain[] {
  return chains.filter(chain => {
    const config = SUPPORTED_CHAINS[chain];
    return config && config.isTestnet === isTestnet;
  });
}

/**
 * Check if a chain is a testnet
 */
export function isTestnetChain(chain: SupportedChain): boolean {
  const config = SUPPORTED_CHAINS[chain];
  return config ? config.isTestnet : false;
}

/**
 * Get network by chain ID
 */
export function getChainByChainId(chainId: number | string): SupportedChain | undefined {
  for (const [chainKey, config] of Object.entries(SUPPORTED_CHAINS)) {
    if (config.chainId === chainId) {
      return chainKey as SupportedChain;
    }
  }
  return undefined;
}

// =============================================================================
// BLOCKCHAIN ARCHITECTURE MAPPING
// =============================================================================

export const BLOCKCHAIN_TO_ARCHITECTURE: Record<string, BlockchainArchitecture> = {
  // EVM-based blockchains
  'ethereum': 'evm',
  'polygon': 'evm',
  'base': 'evm',
  'base-sepolia': 'evm',
  'base-mainnet': 'evm',
  'avalanche': 'evm',
  'avalanche-fuji': 'evm',
  'iotex': 'evm',
  'sei-testnet': 'evm',
  'sei': 'evm',
  'arbitrum': 'evm',
  'optimism': 'evm',
  'bsc': 'evm',
  'binance-smart-chain': 'evm',

  // Solana-based blockchains
  'solana': 'solana',
  'solana-mainnet': 'solana',
  'solana-devnet': 'solana',
  'solana-testnet': 'solana',

  // NEAR-based blockchains
  'near': 'near',
  'near-mainnet': 'near',
  'near-testnet': 'near',

  // Cosmos-based blockchains
  'cosmos': 'cosmos',
  'cosmoshub': 'cosmos',
  'osmosis': 'cosmos',
  'juno': 'cosmos',

  // Bitcoin-based blockchains
  'bitcoin': 'bitcoin',
  'btc': 'bitcoin',
  'litecoin': 'bitcoin',
  'dogecoin': 'bitcoin',
};

/**
 * Determines the blockchain architecture from a blockchain name
 */
export function getBlockchainArchitecture(blockchain: string | null | undefined): BlockchainArchitecture {
  if (!blockchain) {
    return 'evm'; // Default fallback to EVM
  }

  const normalizedBlockchain = blockchain.toLowerCase().trim();
  
  // Direct mapping
  if (BLOCKCHAIN_TO_ARCHITECTURE[normalizedBlockchain]) {
    return BLOCKCHAIN_TO_ARCHITECTURE[normalizedBlockchain];
  }

  // Pattern matching for unknown blockchains
  if (normalizedBlockchain.includes('solana')) return 'solana';
  if (normalizedBlockchain.includes('near')) return 'near';
  if (normalizedBlockchain.includes('cosmos')) return 'cosmos';
  if (normalizedBlockchain.includes('bitcoin') || normalizedBlockchain.includes('btc')) return 'bitcoin';

  // Default to EVM for unknown blockchains
  return 'evm';
}

/**
 * Gets all supported blockchains for a specific architecture
 */
export function getBlockchainsForArchitecture(architecture: BlockchainArchitecture): string[] {
  return Object.entries(BLOCKCHAIN_TO_ARCHITECTURE)
    .filter(([, arch]) => arch === architecture)
    .map(([blockchain]) => blockchain);
}

/**
 * Validates if a blockchain name is supported
 */
export function isSupportedBlockchain(blockchain: string): boolean {
  return Boolean(BLOCKCHAIN_TO_ARCHITECTURE[blockchain.toLowerCase().trim()]);
}

// =============================================================================
// ADDRESS VALIDATION
// =============================================================================

/**
 * Check if an address format matches a blockchain architecture
 */
export function validateAddressFormat(address: BlockchainAddress, architecture: BlockchainArchitecture): boolean {
  switch (architecture) {
    case 'evm':
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    case 'solana':
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    case 'near':
      return /^([a-z\d]+[\-_])*[a-z\d]+\.near$|^[a-f0-9]{64}$/.test(address);
    default:
      return false;
  }
}

/**
 * Get supported architectures
 */
export function getSupportedArchitectures(): BlockchainArchitecture[] {
  const architectures = new Set<BlockchainArchitecture>();
  Object.values(SUPPORTED_CHAINS).forEach(config => {
    architectures.add(config.architecture);
  });
  return Array.from(architectures);
}

// =============================================================================
// PRICE PROVIDER
// =============================================================================

/**
 * Simple price provider that assumes 1:1 USD peg for stablecoins
 */
export class SimplePriceProvider implements PriceProvider {
  async getPrice(symbol: StablecoinSymbol): Promise<number> {
    const config = STABLECOIN_CONFIGS[symbol];
    return config.isPegged ? (config.pegTarget || 1.0) : 1.0;
  }

  async getPrices(symbols: StablecoinSymbol[]): Promise<Record<StablecoinSymbol, number>> {
    const prices = {} as Record<StablecoinSymbol, number>;
    for (const symbol of symbols) {
      prices[symbol] = await this.getPrice(symbol);
    }
    return prices;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { SUPPORTED_CHAINS as default }; 