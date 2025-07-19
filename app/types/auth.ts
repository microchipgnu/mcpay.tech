/**
 * Authentication and user-related types
 */

/** CDP wallet metadata structure */
export interface CDPWalletMetadata {
  cdpAccountId?: string;
  cdpAccountName?: string;
  cdpNetwork?: string;
  isSmartAccount?: boolean;
  ownerAccountId?: string;
  provider?: string;
  type?: string;
  gasSponsored?: boolean;
  createdByService?: boolean;
  managedBy?: string;
  balanceCache?: Record<string, unknown>;
  lastUpdated?: string;
  [key: string]: unknown; // Allow additional properties
}

/** Auth status type */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/** Enhanced user type with wallet information */
export interface AuthUser {
  id: string;
  name?: string;
  email?: string;
  emailVerified?: boolean;
  image?: string;
  displayName?: string;
  walletAddress?: string; // Legacy field
  createdAt: string;
  updatedAt: string;
  wallets?: Array<{
    id: string;
    walletAddress: string;
    blockchain: string;
    walletType: 'external' | 'managed' | 'custodial';
    provider?: string;
    isPrimary: boolean;
    isActive: boolean;
  }>;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/** Generic API response wrapper */
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  details?: unknown;
}

/** API error with additional context */
export interface ApiError extends Error {
  status?: number;
  details?: unknown;
}