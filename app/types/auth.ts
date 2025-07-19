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