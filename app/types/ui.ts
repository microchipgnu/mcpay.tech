/**
 * UI components and React context types
 */

import type { Network } from '@/lib/commons';

/** Theme context type for dark/light mode switching */
export interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

/** Account modal tab types */
export type AccountModalTab = 'profile' | 'wallets' | 'settings';

/** Return type for useAccountModal hook */
export interface UseAccountModalReturn {
  isOpen: boolean;
  defaultTab: AccountModalTab;
  openModal: (tab?: AccountModalTab) => void;
  closeModal: () => void;
}

/** Props for AccountModal component */
export interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'profile' | 'wallets' | 'settings';
}

/** Chain balance information */
export interface ChainBalance {
  chain: string;
  network: string;
  balance: string;
  balanceUsd: number;
  tokens: Array<{
    symbol: string;
    balance: string;
    balanceUsd: number;
    address?: string;
  }>;
}

/** Balances grouped by chain */
export interface BalancesByChain {
  [chainName: string]: Array<{
    address: string;
    chain: string;
    chainId: number;
    chainName: string;
    architecture: string;
    isTestnet: boolean;
    stablecoin: string;
    stablecoinName: string;
    tokenIdentifier: string;
    balance: string;
    formattedBalance: string;
    decimals: number;
    priceUsd: number;
    fiatValue: number;
    balanceUsd: number;
  }>;
}

/** Props for ExplorerLink component */
export interface ExplorerLinkProps {
  hash: string;
  network: Network;
  type?: 'address' | 'tx';
  variant?: 'link' | 'button' | 'badge';
  showIcon?: boolean;
  showExplorerName?: boolean;
  showCopyButton?: boolean;
  className?: string;
  children?: React.ReactNode;
}

// =============================================================================
// WALLET TYPES
// =============================================================================

/** Ethereum provider interface */
export interface EthereumProvider {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isPorto?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

/** Wallet window interface for browser globals */
export interface WalletWindow {
  ethereum?: EthereumProvider;
  coinbaseWalletExtension?: unknown;
  porto?: unknown;
}

/** Wallet error with error code */
export interface WalletError extends Error {
  code?: number;
}