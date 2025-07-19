// Enhanced types for multi-wallet and blockchain-agnostic support
import type { UserWallet, User } from '@/types';

// Re-export database types for convenience
export type { UserWallet, User } from '@/types';

/** Enhanced user type extending database User with additional fields */
export interface EnhancedUser extends User {
  // Associated wallets
  wallets?: UserWallet[];
}

export interface WalletRegistrationInfo {
  blockchain: string;
  network: string;
  walletType: 'external' | 'managed' | 'custodial';
  provider?: string;
  primaryWallet: boolean;
}

export interface EnhancedServerRegistration {
  mcpOrigin: string;
  receiverAddress: string;
  name?: string;
  description?: string;
  requireAuth?: boolean;
  authHeaders?: Record<string, unknown>;
  tools?: Array<{
    name: string;
    payment?: {
      maxAmountRequired: string; // Base units as string for precision
      asset: string;
      network: string;
      resource?: string;
      description?: string;
    };
  }>;
  walletInfo?: WalletRegistrationInfo;
  metadata?: Record<string, unknown>;
}

// Re-export commonly used types from tokens
export type { Network, TokenInfo, NetworkInfo } from '@/lib/commons'; 