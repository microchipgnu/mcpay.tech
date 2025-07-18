/**
 * Payment & Transaction Types
 * 
 * Centralized payment, transaction, and payment strategy type definitions for MCPay.tech
 * Includes payment processing, signing strategies, and third-party integrations.
 */

import { z } from "zod";
import { payments, toolPricing } from "@/lib/gateway/db/schema";
import type { 
  Account, 
  Address, 
  Chain, 
  Client, 
  Hex, 
  LocalAccount, 
  PublicActions, 
  RpcSchema, 
  Transport, 
  WalletActions 
} from "viem";
import type { Network } from "./blockchain";
import type { Context } from "hono";

// =============================================================================
// DB-INFERRED PAYMENT TYPES
// =============================================================================

/** Payment record from database */
export type Payment = typeof payments.$inferSelect;

/** Payment insert data for database */
export type PaymentInsert = typeof payments.$inferInsert;

/** Tool pricing record from database */
export type ToolPricing = typeof toolPricing.$inferSelect;

/** Tool pricing insert data for database */
export type ToolPricingInsert = typeof toolPricing.$inferInsert;

// =============================================================================
// SIGNER WALLET TYPES
// =============================================================================

export type SignerWallet<
  chain extends Chain = Chain,
  transport extends Transport = Transport,
  account extends Account = Account,
> = Client<
  transport,
  chain,
  account,
  RpcSchema,
  PublicActions<transport, chain, account> & WalletActions<chain, account>
>;

// =============================================================================
// NETWORK CONFIGURATION TYPES
// =============================================================================

export const NetworkSchema = z.enum([
  "base-sepolia",
  "base",
  "avalanche-fuji", 
  "avalanche",
  "iotex",
  "sei-testnet",
]);

export type SupportedNetwork = z.infer<typeof NetworkSchema>;

export const SupportedEVMNetworks: SupportedNetwork[] = [
  "base-sepolia",
  "base", 
  "avalanche-fuji",
  "avalanche",
  "iotex",
  "sei-testnet",
];

export const EvmNetworkToChainId = new Map<SupportedNetwork, number>([
  ["base-sepolia", 84532],
  ["base", 8453],
  ["avalanche-fuji", 43113],
  ["avalanche", 43114],
  ["iotex", 4689],
  ["sei-testnet", 1328],
]);

export const ChainIdToNetwork = Object.fromEntries(
  SupportedEVMNetworks.map(network => [EvmNetworkToChainId.get(network), network]),
) as Record<number, Network>;

// =============================================================================
// PAYMENT PAYLOAD TYPES
// =============================================================================

export const schemes = ["exact"] as const;

export const ExactEvmPayloadAuthorizationSchema = z.object({
  from: z.string(),
  to: z.string(),
  value: z.string(),
  validAfter: z.string(),
  validBefore: z.string(),
  nonce: z.string(),
});

export type ExactEvmPayloadAuthorization = z.infer<typeof ExactEvmPayloadAuthorizationSchema>;

export const ExactEvmPayloadSchema = z.object({
  signature: z.string(),
  authorization: ExactEvmPayloadAuthorizationSchema,
});

export type ExactEvmPayload = z.infer<typeof ExactEvmPayloadSchema>;

export const PaymentPayloadSchema = z.object({
  x402Version: z.number(),
  scheme: z.enum(schemes),
  network: NetworkSchema,
  payload: ExactEvmPayloadSchema,
});

export type PaymentPayload = z.infer<typeof PaymentPayloadSchema>;

export type UnsignedPaymentPayload = Omit<PaymentPayload, "payload"> & {
  payload: Omit<ExactEvmPayload, "signature"> & { signature: undefined };
};

// =============================================================================
// PAYMENT REQUIREMENTS TYPES
// =============================================================================

export const ExtendedPaymentRequirementsSchema = z.object({
  network: NetworkSchema,
  asset: z.string(),
  payTo: z.string(),
  maxAmountRequired: z.string(),
  maxTimeoutSeconds: z.number(),
  scheme: z.enum(schemes),
  extra: z.object({
    name: z.string().optional(),
    version: z.string().optional(),
  }).optional(),
});

export type ExtendedPaymentRequirements = z.infer<typeof ExtendedPaymentRequirementsSchema>;

export type SupportedPaymentRequirements = Omit<ExtendedPaymentRequirements, 'network'> & {
  network: SupportedNetwork;
};

// =============================================================================
// PAYMENT RESPONSE TYPES
// =============================================================================

export const VerifyResponseSchema = z.object({
  verified: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
});

export type VerifyResponse = z.infer<typeof VerifyResponseSchema>;

export const SettleResponseSchema = z.object({
  settled: z.boolean(),
  transactionHash: z.string().optional(),
  error: z.string().optional(),
});

export type SettleResponse = z.infer<typeof SettleResponseSchema>;

// =============================================================================
// PAYMENT INFO TYPES
// =============================================================================

export interface PaymentInfo {
  id: string;
  amount: string;
  currency: string;
  network: string;
  recipient: string;
  status: 'pending' | 'confirmed' | 'failed';
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  gasPrice?: string;
  effectiveGasPrice?: string;
  createdAt: Date;
  confirmedAt?: Date;
  failedAt?: Date;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ToolPaymentInfo {
  amount: string;
  currency: string;
  network: string;
  recipient: string;
  token: string;
}

// =============================================================================
// PAYMENT STRATEGY TYPES
// =============================================================================

export interface PaymentStrategyConfig {
  name: string;
  description?: string;
  supportedNetworks: string[];
  requiresAuth: boolean;
  settings?: Record<string, any>;
}

export interface PaymentSigningContext {
  toolCall: {
    isPaid: boolean;
    payment: {
      maxAmountRequired: string;
      network: string;
      asset: string;
      payTo?: string;
      resource: string;
      description: string;
    };
  };
  user?: {
    id: string;
    email?: string;
    name?: string;
    displayName?: string;
  };
  paymentRequirements: ExtendedPaymentRequirements[];
}

export interface PaymentSigningResult {
  success: boolean;
  signedPaymentHeader?: string;
  error?: string;
  strategy?: string;
  walletAddress?: string;
  transactionHash?: string;
  metadata?: Record<string, any>;
}

export interface PaymentSigningStrategy {
  name: string;
  priority: number;
  canSign(context: PaymentSigningContext): Promise<boolean>;
  signPayment(context: PaymentSigningContext): Promise<PaymentSigningResult>;
  supportsNetwork?(network: string): boolean;
}

// =============================================================================
// CDP PAYMENT TYPES
// =============================================================================

export type CDPNetwork =
  | "base-sepolia"
  | "base-mainnet"
  | "ethereum-sepolia"
  | "ethereum-mainnet"
  | "polygon-mainnet"
  | "arbitrum-mainnet"
  | "optimism-mainnet";

export type CDPNetworkSmartAccount =
  | "base-sepolia"
  | "base-mainnet";

export interface CDPAccountInfo {
  walletId: string;
  seedId: string;
  address?: string;
  network?: CDPNetwork;
  balance?: {
    amount: string;
    currency: string;
  };
  // Extended properties
  accountId?: string;
  walletAddress?: string;
  isSmartAccount?: boolean;
  smartAccountAddress?: string;
  ownerAccountId?: string;
  accountName?: string;
}

export interface CreateCDPWalletOptions {
  network?: CDPNetworkSmartAccount;
  importSeed?: string;
  accountName?: string;
  createSmartAccount?: boolean;
  ownerAccountId?: string;
}

export interface CDPWalletResult {
  wallet: any; // CDP Wallet instance
  address: string;
  network: CDPNetwork;
  metadata: any; // CDPWalletMetadata - defined in auth.ts
  // Extended result
  account?: CDPAccountInfo;
  smartAccount?: CDPAccountInfo;
}

export interface CDPWallet {
  id: string;
  address: string;
  network: string;
  isActive: boolean;
  metadata: any; // CDPWalletMetadata - defined in auth.ts
}

// =============================================================================
// ONRAMP INTEGRATION TYPES
// =============================================================================

export interface OnrampAddress {
  address: string;
  chainId?: number;
  blockchains?: string[];
}

export interface OnrampSessionTokenRequest {
  destinationWallets?: OnrampAddress[];
  addresses?: OnrampAddress[];
  assets?: string[];
}

export interface OnrampSessionTokenResponse {
  sessionToken?: string;
  onrampUrl?: string;
  token?: string;
  channel_id?: string;
}

export interface OnrampUrlOptions {
  destinationWallets?: OnrampAddress[];
  sessionToken?: string;
  purchaseAmount?: number;
  purchaseCurrency?: string;
  paymentMethod?: string;
  defaultExperience?: 'buy' | 'send';
  // Extended options
  defaultAsset?: string;
  defaultNetwork?: string;
  presetFiatAmount?: number;
  presetCryptoAmount?: number;
  fiatCurrency?: string;
  defaultPaymentMethod?: string;
  partnerUserId?: string;
  redirectUrl?: string;
}

// =============================================================================
// VERIFICATION AND PROOF TYPES
// =============================================================================

export interface ToolMetadata {
  name: string;
  description?: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ExecutionContext {
  toolName: string;
  arguments: Record<string, any>;
  userId: string;
  executionId: string;
  serverId: string;
  serverUrl: string;
  // Extended context
  tool?: ToolMetadata;
  params?: Record<string, unknown>;
  result?: unknown;
  timestamp?: number;
  url?: string;
  method?: 'GET' | 'POST';
  headers?: string[];
}

export interface WebProofRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string> | string[];
  body?: any;
  responseSelector?: string;
  // Extended properties
  data?: string;
  max_sent_data?: number;
  max_recv_data?: number;
  notary?: string;
}

export interface WebProofResponse {
  proofId?: string;
  verified?: boolean;
  data?: any;
  presentation?: string;
}

export interface VerificationResult {
  verified: boolean;
  data?: any;
  error?: string;
  // Extended verification
  isConsistent?: boolean;
  confidenceScore?: number; // 0-1
  inconsistencies?: {
    type: 'parameter_mismatch' | 'result_mismatch' | 'description_mismatch';
    details: string;
  }[];
  proof?: {
    originalExecution: ExecutionContext;
    replayExecution?: ExecutionContext;
    aiEvaluation: string;
    webProof?: WebProofResponse;
  };
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type PaymentRequirementsSelector = (
  paymentRequirements: ExtendedPaymentRequirements[], 
  network?: Network, 
  scheme?: "exact"
) => ExtendedPaymentRequirements;

export type CreateHeaders = () => Promise<{
  [key: string]: string;
}>;

export type TransactionType = any; // Will be properly typed based on database transaction operations

// =============================================================================
// SERIALIZATION TYPES
// =============================================================================

export type SerializeBigInts<T> = T extends bigint
  ? string
  : T extends Record<string, any>
  ? { [K in keyof T]: SerializeBigInts<T[K]> }
  : T extends Array<infer U>
  ? Array<SerializeBigInts<U>>
  : T;

// =============================================================================
// DATABASE TYPES
// =============================================================================

export type RevenueDetail = {
  currency: string;
  amount: string;
  network: string;
  count: number;
  // Extended DB fields
  decimals?: number;
  amount_raw?: string;
};

export type RevenueDetails = RevenueDetail[] | null;

// =============================================================================
// LEGACY GATEWAY TYPES
// =============================================================================

export type ChainConfig = {
  chainId: number;
  name: string;
  currency: string;
  blockExplorer?: string;
  rpcUrl: string;
};