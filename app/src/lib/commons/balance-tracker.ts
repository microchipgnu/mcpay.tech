/**
 * Multi-Chain Stablecoin Balance Tracker for MCPay Commons
 * 
 * This library provides a chain-agnostic interface for checking stablecoin balances
 * across multiple blockchain architectures and calculating total fiat value.
 * 
 * ## Supported Stablecoins:
 * - **USDC**: USD Coin (Circle)
 * - **USDT**: Tether USD
 * - **DAI**: MakerDAO Stablecoin
 * - **BUSD**: Binance USD (where available)
 * - **FRAX**: Frax Stablecoin
 * 
 * ## Supported Blockchain Architectures:
 * - **EVM**: Ethereum Virtual Machine compatible chains (using viem)
 * - **Solana**: Solana blockchain (placeholder for @solana/web3.js implementation)
 * - **Near**: Near Protocol (placeholder for near-api-js implementation)
 * 
 * ## Key Features:
 * 
 * 1. **Multi-Stablecoin Support**: Track USDC, USDT, DAI, and other stablecoins
 * 2. **Fiat Value Calculation**: Get USD-denominated balances across all tokens
 * 3. **Price Integration**: Real-time or configured pricing for accurate fiat values
 * 4. **Chain-Agnostic**: Works across EVM, Solana, Near, and other architectures
 * 5. **Aggregated Reporting**: Total fiat balance across all accounts, tokens, and chains
 * 6. **Mainnet/Testnet Separation**: Proper handling of test vs real money
 */

import { createPublicClient, http, formatUnits, type Address } from 'viem';
import type {
  BlockchainArchitecture,
  StablecoinSymbol,
  StablecoinConfig,
  StablecoinBalance,
  StablecoinBalanceError,
  ChainConfig,
  EVMChainConfig,
  SolanaChainConfig,
  NearChainConfig,
  EVMTokenConfig,
  SolanaTokenConfig,
  NearTokenConfig,
  BlockchainAddress,
  PriceProvider,
  StablecoinClient
} from '@/types';
import {
  STABLECOIN_CONFIGS,
  SUPPORTED_CHAINS,
  isEVMChain,
  isSolanaChain,
  isNearChain,
  type SupportedChain,
  SimplePriceProvider,
  getMainnetChains,
  getTestnetChains,
  getEVMChains,
  getSolanaChains,
  getNearChains
} from './chains';

// =============================================================================
// BALANCE RESULT TYPES
// =============================================================================

// MultiChainStablecoinResult type is now centralized in @/types

// =============================================================================
// STABLECOIN CLIENT INTERFACES & IMPLEMENTATIONS
// =============================================================================



// EVM client implementation using viem
class EVMStablecoinClient implements StablecoinClient {
  private erc20Abi = [
    {
      inputs: [{ name: '_owner', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: 'balance', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
  ] as const;

  async getTokenBalance(
    address: BlockchainAddress, 
    tokenConfig: EVMTokenConfig | SolanaTokenConfig | NearTokenConfig, 
    chainConfig: ChainConfig
  ): Promise<bigint> {
    if (!isEVMChain(chainConfig) || !('address' in tokenConfig)) {
      throw new Error('Invalid EVM configuration');
    }

    const client = createPublicClient({
      transport: http(chainConfig.rpcUrl),
    });

    const balance = await client.readContract({
      address: tokenConfig.address as Address,
      abi: this.erc20Abi,
      functionName: 'balanceOf',
      args: [address as Address],
    }) as bigint;

    return balance;
  }
}

// Solana client implementation (placeholder - would use @solana/web3.js)
class SolanaStablecoinClient implements StablecoinClient {
  async getTokenBalance(
    address: BlockchainAddress, 
    tokenConfig: EVMTokenConfig | SolanaTokenConfig | NearTokenConfig, 
    chainConfig: ChainConfig
  ): Promise<bigint> {
    if (!isSolanaChain(chainConfig) || !('mint' in tokenConfig)) {
      throw new Error('Invalid Solana configuration');
    }

    // TODO: Implement Solana SPL token balance checking
    // This would use @solana/web3.js and @solana/spl-token
    throw new Error('Solana balance checking not implemented yet');
  }
}

// Near client implementation (placeholder - would use near-api-js)
class NearStablecoinClient implements StablecoinClient {
  async getTokenBalance(
    address: BlockchainAddress, 
    tokenConfig: EVMTokenConfig | SolanaTokenConfig | NearTokenConfig, 
    chainConfig: ChainConfig
  ): Promise<bigint> {
    if (!isNearChain(chainConfig) || !('contract' in tokenConfig)) {
      throw new Error('Invalid Near configuration');
    }

    // TODO: Implement Near fungible token balance checking
    // This would use near-api-js
    throw new Error('Near balance checking not implemented yet');
  }
}

// Factory to create appropriate client based on chain architecture
function createStablecoinClient(architecture: BlockchainArchitecture): StablecoinClient {
  switch (architecture) {
    case 'evm':
      return new EVMStablecoinClient();
    case 'solana':
      return new SolanaStablecoinClient();
    case 'near':
      return new NearStablecoinClient();
    default:
      throw new Error(`Unsupported blockchain architecture: ${architecture}`);
  }
}

// =============================================================================
// CORE BALANCE CHECKING FUNCTIONS
// =============================================================================

/**
 * Check balance for a single stablecoin on a single chain for a single account
 */
export async function getStablecoinBalanceOnChain(
  address: BlockchainAddress,
  chain: SupportedChain,
  stablecoinSymbol: StablecoinSymbol,
  priceProvider: PriceProvider = new SimplePriceProvider()
): Promise<StablecoinBalance | StablecoinBalanceError> {
  const chainConfig = SUPPORTED_CHAINS[chain];
  if (!chainConfig) {
    return {
      address,
      chain,
      chainId: 'unknown',
      chainName: 'Unknown',
      architecture: 'evm', // default fallback
      isTestnet: false, // default fallback
      stablecoin: stablecoinSymbol,
      tokenIdentifier: 'unknown',
      error: `Unsupported chain: ${chain}`,
    };
  }

  // Find the stablecoin configuration for this chain
  const tokenConfig = chainConfig.stablecoins.find(token => token.symbol === stablecoinSymbol);
  if (!tokenConfig) {
    return {
      address,
      chain,
      chainId: chainConfig.chainId,
      chainName: chainConfig.name,
      architecture: chainConfig.architecture,
      isTestnet: chainConfig.isTestnet,
      stablecoin: stablecoinSymbol,
      tokenIdentifier: 'not_found',
      error: `${stablecoinSymbol} not supported on ${chainConfig.name}`,
    };
  }

  const stablecoinConfig = STABLECOIN_CONFIGS[stablecoinSymbol];
  
  try {
    const client = createStablecoinClient(chainConfig.architecture);
    const balance = await client.getTokenBalance(address, tokenConfig, chainConfig);
    const priceUsd = await priceProvider.getPrice(stablecoinSymbol);

    // Format balance using the stablecoin's decimals
    const formattedBalance = formatUnits(balance, stablecoinConfig.decimals);
    const fiatValue = parseFloat(formattedBalance) * priceUsd;

    // Get the appropriate token identifier based on chain architecture
    let tokenIdentifier: string;
    if ('address' in tokenConfig) {
      tokenIdentifier = tokenConfig.address;
    } else if ('mint' in tokenConfig) {
      tokenIdentifier = tokenConfig.mint;
    } else if ('contract' in tokenConfig) {
      tokenIdentifier = tokenConfig.contract;
    } else {
      tokenIdentifier = 'unknown';
    }

    return {
      address,
      chain,
      chainId: chainConfig.chainId,
      chainName: chainConfig.name,
      architecture: chainConfig.architecture,
      isTestnet: chainConfig.isTestnet,
      stablecoin: stablecoinSymbol,
      stablecoinName: stablecoinConfig.name,
      tokenIdentifier,
      balance,
      formattedBalance,
      decimals: stablecoinConfig.decimals,
      priceUsd,
      fiatValue,
    };
  } catch (error) {
    const tokenIdentifier = 'address' in tokenConfig ? tokenConfig.address :
                           'mint' in tokenConfig ? tokenConfig.mint :
                           'contract' in tokenConfig ? tokenConfig.contract : 'unknown';

    return {
      address,
      chain,
      chainId: chainConfig.chainId,
      chainName: chainConfig.name,
      architecture: chainConfig.architecture,
      isTestnet: chainConfig.isTestnet,
      stablecoin: stablecoinSymbol,
      tokenIdentifier,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check stablecoin balances for multiple accounts across all supported chains
 */
export async function getStablecoinBalances(
  addresses: BlockchainAddress[],
  stablecoins: StablecoinSymbol[] = ['USDC', 'USDT', 'DAI'],
  priceProvider: PriceProvider = new SimplePriceProvider()
): Promise<MultiChainStablecoinResult> {
  if (!addresses || addresses.length === 0) {
    return createEmptyResult();
  }

  const balances: StablecoinBalance[] = [];
  const errors: StablecoinBalanceError[] = [];

  // Create promises for all address-chain-stablecoin combinations
  const promises: Promise<StablecoinBalance | StablecoinBalanceError>[] = [];
  
  for (const address of addresses) {
    for (const chain of Object.keys(SUPPORTED_CHAINS) as SupportedChain[]) {
      for (const stablecoin of stablecoins) {
        promises.push(getStablecoinBalanceOnChain(address, chain, stablecoin, priceProvider));
      }
    }
  }

  // Execute all balance checks in parallel
  const results = await Promise.allSettled(promises);
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const balanceResult = result.value;
      if ('balance' in balanceResult) {
        balances.push(balanceResult);
      } else {
        errors.push(balanceResult);
      }
    } else {
      console.error('Unexpected promise rejection:', result.reason);
    }
  }

  return aggregateResults(balances, errors, addresses, stablecoins);
}

/**
 * Get stablecoin balances for accounts on specific chains only
 */
export async function getStablecoinBalancesOnChains(
  addresses: BlockchainAddress[],
  chains: SupportedChain[],
  stablecoins: StablecoinSymbol[] = ['USDC', 'USDT', 'DAI'],
  priceProvider: PriceProvider = new SimplePriceProvider()
): Promise<MultiChainStablecoinResult> {
  if (!addresses || addresses.length === 0 || !chains || chains.length === 0) {
    return createEmptyResult();
  }

  const balances: StablecoinBalance[] = [];
  const errors: StablecoinBalanceError[] = [];

  // Create promises for specified address-chain-stablecoin combinations only
  const promises: Promise<StablecoinBalance | StablecoinBalanceError>[] = [];
  
  for (const address of addresses) {
    for (const chain of chains) {
      if (chain in SUPPORTED_CHAINS) {
        for (const stablecoin of stablecoins) {
          promises.push(getStablecoinBalanceOnChain(address, chain, stablecoin, priceProvider));
        }
      }
    }
  }

  // Execute all balance checks in parallel
  const results = await Promise.allSettled(promises);
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const balanceResult = result.value;
      if ('balance' in balanceResult) {
        balances.push(balanceResult);
      } else {
        errors.push(balanceResult);
      }
    }
  }

  return aggregateResults(balances, errors, addresses, stablecoins, chains);
}

/**
 * Get mainnet-only stablecoin balances (excludes testnet balances from fiat calculations)
 */
export async function getMainnetStablecoinBalances(
  addresses: BlockchainAddress[],
  stablecoins: StablecoinSymbol[] = ['USDC', 'USDT', 'DAI'],
  priceProvider: PriceProvider = new SimplePriceProvider()
): Promise<MultiChainStablecoinResult> {
  const mainnetChains = getMainnetChains();
  return getStablecoinBalancesOnChains(addresses, mainnetChains, stablecoins, priceProvider);
}

/**
 * Get testnet-only stablecoin balances
 */
export async function getTestnetStablecoinBalances(
  addresses: BlockchainAddress[],
  stablecoins: StablecoinSymbol[] = ['USDC', 'USDT', 'DAI'],
  priceProvider: PriceProvider = new SimplePriceProvider()
): Promise<MultiChainStablecoinResult> {
  const testnetChains = getTestnetChains();
  return getStablecoinBalancesOnChains(addresses, testnetChains, stablecoins, priceProvider);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function createEmptyResult(): MultiChainStablecoinResult {
  return {
    balances: [],
    errors: [],
    totalFiatValue: 0,
    testnetTotalFiatValue: 0,
    mainnetBalances: [],
    testnetBalances: [],
    balancesByChain: {},
    balancesByStablecoin: {},
    mainnetBalancesByChain: {},
    testnetBalancesByChain: {},
    mainnetBalancesByStablecoin: {},
    testnetBalancesByStablecoin: {},
    summary: {
      totalAccounts: 0,
      totalChainsChecked: 0,
      totalStablecoinsChecked: 0,
      successfulChecks: 0,
      failedChecks: 0,
      mainnetChainsChecked: 0,
      testnetChainsChecked: 0,
      mainnetSuccessfulChecks: 0,
      testnetSuccessfulChecks: 0,
    },
  };
}

function aggregateResults(
  balances: StablecoinBalance[],
  errors: StablecoinBalanceError[],
  addresses: BlockchainAddress[],
  stablecoins: StablecoinSymbol[],
  specificChains?: SupportedChain[]
): MultiChainStablecoinResult {
  // Separate mainnet and testnet balances
  const mainnetBalances = balances.filter(balance => !balance.isTestnet);
  const testnetBalances = balances.filter(balance => balance.isTestnet);

  // Calculate aggregated results - only mainnet balances count toward real fiat value
  const totalFiatValue = mainnetBalances.reduce((sum, balance) => sum + balance.fiatValue, 0);
  const testnetTotalFiatValue = testnetBalances.reduce((sum, balance) => sum + balance.fiatValue, 0);

  // Group all balances by chain
  const balancesByChain: Partial<Record<SupportedChain, StablecoinBalance[]>> = {};
  const mainnetBalancesByChain: Partial<Record<SupportedChain, StablecoinBalance[]>> = {};
  const testnetBalancesByChain: Partial<Record<SupportedChain, StablecoinBalance[]>> = {};

  for (const balance of balances) {
    if (!balancesByChain[balance.chain]) {
      balancesByChain[balance.chain] = [];
    }
    balancesByChain[balance.chain]!.push(balance);

    if (balance.isTestnet) {
      if (!testnetBalancesByChain[balance.chain]) {
        testnetBalancesByChain[balance.chain] = [];
      }
      testnetBalancesByChain[balance.chain]!.push(balance);
    } else {
      if (!mainnetBalancesByChain[balance.chain]) {
        mainnetBalancesByChain[balance.chain] = [];
      }
      mainnetBalancesByChain[balance.chain]!.push(balance);
    }
  }

  // Group all balances by stablecoin
  const balancesByStablecoin: Partial<Record<StablecoinSymbol, StablecoinBalance[]>> = {};
  const mainnetBalancesByStablecoin: Partial<Record<StablecoinSymbol, StablecoinBalance[]>> = {};
  const testnetBalancesByStablecoin: Partial<Record<StablecoinSymbol, StablecoinBalance[]>> = {};

  for (const balance of balances) {
    if (!balancesByStablecoin[balance.stablecoin]) {
      balancesByStablecoin[balance.stablecoin] = [];
    }
    balancesByStablecoin[balance.stablecoin]!.push(balance);

    if (balance.isTestnet) {
      if (!testnetBalancesByStablecoin[balance.stablecoin]) {
        testnetBalancesByStablecoin[balance.stablecoin] = [];
      }
      testnetBalancesByStablecoin[balance.stablecoin]!.push(balance);
    } else {
      if (!mainnetBalancesByStablecoin[balance.stablecoin]) {
        mainnetBalancesByStablecoin[balance.stablecoin] = [];
      }
      mainnetBalancesByStablecoin[balance.stablecoin]!.push(balance);
    }
  }

  // Count chains by type
  const allChains = specificChains || Object.values(SUPPORTED_CHAINS);
  const mainnetChains = allChains.filter(chain => {
    const config = typeof chain === 'string' ? SUPPORTED_CHAINS[chain] : chain;
    return config && !config.isTestnet;
  });
  const testnetChains = allChains.filter(chain => {
    const config = typeof chain === 'string' ? SUPPORTED_CHAINS[chain] : chain;
    return config && config.isTestnet;
  });

  return {
    balances,
    errors,
    totalFiatValue,
    testnetTotalFiatValue,
    mainnetBalances,
    testnetBalances,
    balancesByChain,
    balancesByStablecoin,
    mainnetBalancesByChain,
    testnetBalancesByChain,
    mainnetBalancesByStablecoin,
    testnetBalancesByStablecoin,
    summary: {
      totalAccounts: addresses.length,
      totalChainsChecked: allChains.length,
      totalStablecoinsChecked: stablecoins.length,
      successfulChecks: balances.length,
      failedChecks: errors.length,
      mainnetChainsChecked: mainnetChains.length,
      testnetChainsChecked: testnetChains.length,
      mainnetSuccessfulChecks: mainnetBalances.length,
      testnetSuccessfulChecks: testnetBalances.length,
    },
  };
}

// =============================================================================
// EXAMPLE USAGE FUNCTION
// =============================================================================

/**
 * Example usage function - demonstrating how to use the stablecoin balance checker with testnet/mainnet separation
 */
export async function exampleUsage() {
  const addresses: BlockchainAddress[] = [
    '0x742d35Cc6634C0532925a3b8D41E5b8F7c5c5C04', // EVM addresses
    '0x742d35Cc6634C0532925a3b8D41E5b8F7c5c5C05',
    'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK', // Solana addresses
    'alice.near', // Near addresses
  ];

  // Check all stablecoin balances across all supported chains (with testnet/mainnet separation)
  console.log('Checking stablecoin balances across all chains with testnet/mainnet separation...');
  const allChainsResult = await getStablecoinBalances(addresses);
  
  console.log(`Real money (mainnet) total: $${allChainsResult.totalFiatValue.toFixed(2)}`);
  console.log(`Test money (testnet) total: $${allChainsResult.testnetTotalFiatValue.toFixed(2)}`);
  console.log(`Mainnet successful checks: ${allChainsResult.summary.mainnetSuccessfulChecks}`);
  console.log(`Testnet successful checks: ${allChainsResult.summary.testnetSuccessfulChecks}`);

  // Check only mainnet balances (real money)
  console.log('\nChecking mainnet balances only (real money)...');
  const mainnetResult = await getMainnetStablecoinBalances(addresses);
  console.log(`Total real money value: $${mainnetResult.totalFiatValue.toFixed(2)}`);

  // Check only testnet balances
  console.log('\nChecking testnet balances only...');
  const testnetResult = await getTestnetStablecoinBalances(addresses);
  console.log(`Total test money value: $${testnetResult.totalFiatValue.toFixed(2)}`);

  // Check USDC only on EVM chains
  console.log('\nChecking USDC balances on EVM chains only...');
  const evmChains = getEVMChains();
  const evmResult = await getStablecoinBalancesOnChains(addresses, evmChains, ['USDC']);
  console.log(`Total USDC value on EVM chains: $${evmResult.totalFiatValue.toFixed(2)} (mainnet)`);
  console.log(`Total USDC test value on EVM chains: $${evmResult.testnetTotalFiatValue.toFixed(2)} (testnet)`);

  return allChainsResult;
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export {
  // Chain functions re-exported for convenience
  getEVMChains,
  getSolanaChains,
  getNearChains,
  getMainnetChains,
  getTestnetChains,
  // Price provider
  SimplePriceProvider,
}; 