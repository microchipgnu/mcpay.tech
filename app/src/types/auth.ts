/**
 * Authentication Types
 * 
 * Centralized authentication type definitions for MCPay.tech
 * Includes user authentication, session management, and wallet connection types.
 */

import { users, userWallets } from "@/lib/gateway/db/schema";

// =============================================================================
// CORE AUTH TYPES
// =============================================================================

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type AuthMethod = 'session' | 'api_key';

// =============================================================================
// USER TYPES (DB-INFERRED)
// =============================================================================

/** User record from database */
export type User = typeof users.$inferSelect;

/** User insert data for database */
export type UserInsert = typeof users.$inferInsert;

/** User wallet record from database */
export type UserWallet = typeof userWallets.$inferSelect;

/** User wallet insert data for database */
export type UserWalletInsert = typeof userWallets.$inferInsert;

// =============================================================================
// ENHANCED USER TYPES
// =============================================================================

/** Enhanced user with wallet information */
export interface AuthUser {
  id: string;
  name?: string;
  email?: string;
  emailVerified?: boolean;
  image?: string;
  displayName?: string;
  walletAddress?: string; // Legacy field for backward compatibility
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  wallets?: UserWallet[];
}

/** User with associated wallets */
export type UserWithWallet = User & {
  wallets: UserWallet[];
};

/** Enhanced user type with additional profile information */
export interface EnhancedUser {
  id: string;
  // Legacy wallet field (for backward compatibility)
  walletAddress?: string;
  // Traditional auth fields
  name?: string;
  email?: string;
  emailVerified?: boolean;
  image?: string;
  // Display fields
  displayName?: string;
  avatarUrl?: string;
  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  // Associated wallets
  wallets?: UserWallet[];
}

// =============================================================================
// WALLET REGISTRATION TYPES
// =============================================================================

export interface WalletRegistrationInfo {
  blockchain: string;
  network: string;
  walletType: 'external' | 'managed' | 'custodial';
  provider?: string;
  primaryWallet: boolean;
}

// =============================================================================
// BETTER-AUTH INTEGRATION TYPES
// =============================================================================

/** Authentication type for better-auth integration */
export interface AuthType {
  schema: any;
  socialProviders: any;
  user: any;
  advanced: any;
  defaultCookieAttributes: any;
}

// =============================================================================
// CDP WALLET METADATA
// =============================================================================

/** CDP (Coinbase Developer Platform) wallet metadata structure */
export interface CDPWalletMetadata {
  seedId: string;
  walletId: string;
  address?: string;
  network?: string;
  isImported?: boolean;
  createdAt?: Date;
  lastUsed?: Date;
  balance?: {
    amount: string;
    currency: string;
    lastUpdated: Date;
  };
  // Additional CDP-specific properties
  cdpAccountId?: string;
  cdpAccountName?: string;
  cdpNetwork?: string;
  isSmartAccount?: boolean;
  ownerAccountId?: string;
  provider?: string;
  type?: string;
  gasSponsored?: boolean;
  [key: string]: unknown; // Allow additional properties
}

// =============================================================================
// SESSION TYPES
// =============================================================================

/** Session detection result */
export interface AuthDetectionResult {
  isAuthenticated: boolean;
  user?: {
    id: string;
    email?: string;
    name?: string;
    displayName?: string;
  };
  method?: AuthMethod;
}

// =============================================================================
// API KEY TYPES
// =============================================================================

/** API key authentication context */
export interface ApiKeyAuth {
  isValid: boolean;
  userId?: string;
  keyHash?: string;
}

/** Better-auth session type structure */
export type AuthType = {
  user: any | null; // TODO: Replace with proper better-auth session types when available
  session: any | null; // TODO: Replace with proper better-auth session types when available
}