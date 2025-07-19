/**
 * MCPay Database Schema
 * 
 * IMPORTANT - Amount Handling:
 * All monetary amounts are stored as NUMERIC(38,0) containing base units (atomic units) 
 * to avoid floating point precision issues while still allowing database operations.
 * Each record includes token_decimals for self-sufficient amount reconstruction.
 * 
 * Examples:
 * - 0.1 USDC: amount_raw = 100000, token_decimals = 6
 * - 1.5 ETH: amount_raw = 1500000000000000000, token_decimals = 18
 * 
 * Use the utilities in @/lib/utils/amounts.ts for conversions:
 * - toBaseUnits(humanAmount, decimals) -> baseUnits
 * - fromBaseUnits(baseUnits, decimals) -> humanAmount
 * - formatAmount(baseUnits, decimals, options) -> displayString
 * 
 * Tables with amount_raw + token_decimals:
 * - toolPricing (price_raw, token_decimals)
 * - payments (amount_raw, token_decimals)
 * - analytics (total_revenue_raw, uses mixed currencies - handle in app layer)
 * 
 * Non-monetary decimals (avgResponseTime, confidenceScore) remain as DECIMAL.
 */

import { sql } from "drizzle-orm";
import { boolean, check, decimal, index, integer, jsonb, pgTable, pgView, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type { BlockchainArchitecture, RevenueDetail, RevenueDetails } from "@/types";

// Revenue types are now centralized in @/types

// Enhanced Users table - supporting both wallet and traditional auth
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Legacy wallet field (deprecated - keeping for backward compatibility)
  walletAddress: text('wallet_address').unique(),
  
  // Traditional auth fields (from better-auth)
  name: text('name'),
  email: text('email').unique(),
  emailVerified: boolean('email_verified').default(false),
  image: text('image'), // Profile picture URL
  
  // Additional profile fields
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'), // Keeping for backwards compatibility
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
}, (table) => [
  index('user_wallet_address_idx').on(table.walletAddress),
  index('user_email_idx').on(table.email),
  index('user_last_login_idx').on(table.lastLoginAt),
]);

// User Wallets table - supporting multiple wallets per user (blockchain-agnostic)
export const userWallets = pgTable('user_wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  walletAddress: text('wallet_address').notNull(), // Removed .unique() to allow same wallet for multiple users/configs
  walletType: text('wallet_type').notNull(), // 'external', 'managed', 'custodial'
  provider: text('provider'), // 'metamask', 'phantom', 'coinbase-cdp', 'privy', 'magic', 'near-wallet', etc.
  blockchain: text('blockchain'), // 'ethereum', 'solana', 'near', 'polygon', 'base', etc.
  architecture: text('architecture').$type<BlockchainArchitecture>(), // 'evm', 'solana', 'near', 'cosmos', 'bitcoin'
  isPrimary: boolean('is_primary').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  
  // Generic wallet metadata - blockchain-specific data goes here
  walletMetadata: jsonb('wallet_metadata'), // Store blockchain-specific info like chainId, ensName, solana program accounts, etc.
  
  // External service references (NO sensitive data stored)
  externalWalletId: text('external_wallet_id'), // Reference ID from external service (Coinbase CDP, Privy, etc.)
  externalUserId: text('external_user_id'), // User ID in external system if different
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at'),
}, (table) => [
  index('user_wallets_user_id_idx').on(table.userId),
  index('user_wallets_wallet_address_idx').on(table.walletAddress),
  index('user_wallets_type_idx').on(table.walletType),
  index('user_wallets_blockchain_idx').on(table.blockchain),
  index('user_wallets_architecture_idx').on(table.architecture),
  index('user_wallets_primary_idx').on(table.isPrimary),
  index('user_wallets_active_idx').on(table.isActive),
  index('user_wallets_provider_idx').on(table.provider),
  index('user_wallets_external_id_idx').on(table.externalWalletId),
  // Ensure only one primary wallet per user
  uniqueIndex('user_wallets_primary_unique').on(table.userId).where(sql`is_primary = true`),
  // Prevent exact duplicates: same user + wallet + provider + type
  uniqueIndex('user_wallets_unique_combination').on(table.userId, table.walletAddress, table.provider, table.walletType),
]);

// Better-auth session table
export const session = pgTable("session", {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' })
}, (table) => [
  index('session_user_id_idx').on(table.userId),
  index('session_token_idx').on(table.token),
]);

// Better-auth account table (for OAuth providers)
export const account = pgTable("account", {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull()
}, (table) => [
  index('account_user_id_idx').on(table.userId),
  index('account_provider_idx').on(table.providerId),
]);

// Better-auth verification table (for email verification, password reset, etc.)
export const verification = pgTable("verification", {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => [
  index('verification_identifier_idx').on(table.identifier),
  index('verification_expires_at_idx').on(table.expiresAt),
]);

// Merged MCP Servers table (combines mcps and mcpServers)
export const mcpServers = pgTable('mcp_servers', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: text('server_id').notNull().unique(),
  mcpOrigin: text('mcp_origin').notNull(),
  creatorId: uuid('creator_id').references(() => users.id, { onDelete: 'set null' }),
  receiverAddress: text('receiver_address').notNull(),
  requireAuth: boolean('require_auth').default(false).notNull(),
  authHeaders: jsonb('auth_headers'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  status: text('status').default('active').notNull(),
  name: text('name'),
  description: text('description'),
  metadata: jsonb('metadata'),
}, (table) => [
  index('mcp_server_status_idx').on(table.status),
  index('mcp_server_creator_idx').on(table.creatorId),
  index('mcp_server_created_at_idx').on(table.createdAt),
  index('mcp_server_status_created_idx').on(table.status, table.createdAt),
]);

// Merged MCP Tools table (combines tools and mcpTools)
export const mcpTools = pgTable('mcp_tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: uuid('server_id').references(() => mcpServers.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  inputSchema: jsonb('input_schema').notNull(),
  isMonetized: boolean('is_monetized').default(false).notNull(),
  payment: jsonb('payment'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  status: text('status').default('active').notNull(),
  metadata: jsonb('metadata'),
}, (table) => [
  index('mcp_tool_server_id_idx').on(table.serverId),
  index('mcp_tool_name_idx').on(table.name),
  index('mcp_tool_status_idx').on(table.status),
  index('mcp_tool_server_name_idx').on(table.serverId, table.name),
  index('mcp_tool_monetized_idx').on(table.isMonetized),
]);

export const toolPricing = pgTable('tool_pricing', {
  id: uuid('id').primaryKey().defaultRandom(),
  toolId: uuid('tool_id').references(() => mcpTools.id, { onDelete: 'cascade' }).notNull(),
  priceRaw: decimal('price_raw', { precision: 38, scale: 0 }).notNull(), // Base units as NUMERIC(38,0)
  tokenDecimals: integer('token_decimals').notNull(), // Token decimals for self-sufficient records
  currency: text('currency').notNull(), // Token symbol or contract address
  network: text('network').notNull(),
  assetAddress: text('asset_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  active: boolean('active').default(true).notNull(),
}, (table) => [
  index('tool_pricing_tool_id_idx').on(table.toolId),
  index('tool_pricing_active_idx').on(table.active),
  index('tool_pricing_network_idx').on(table.network),
  index('tool_pricing_tool_network_idx').on(table.toolId, table.network),
  check('price_raw_positive_check', sql`"price_raw" >= 0`), // Can validate numeric values
]);

export const toolUsage = pgTable('tool_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  toolId: uuid('tool_id').references(() => mcpTools.id).notNull(),
  pricingId: uuid('pricing_id').references(() => toolPricing.id, { onDelete: 'set null' }), // Direct reference to pricing used
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  requestData: jsonb('request_data'),
  responseStatus: text('response_status'),
  executionTimeMs: integer('execution_time_ms'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  result: jsonb('result'),
}, (table) => [
  index('tool_usage_tool_id_idx').on(table.toolId),
  index('tool_usage_pricing_id_idx').on(table.pricingId), // Add index for pricing lookup
  index('tool_usage_user_id_idx').on(table.userId),
  index('tool_usage_timestamp_idx').on(table.timestamp),
  index('tool_usage_status_idx').on(table.responseStatus),
  index('tool_usage_tool_timestamp_idx').on(table.toolId, table.timestamp),
  index('tool_usage_tool_pricing_idx').on(table.toolId, table.pricingId), // Composite index for queries
]);

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  toolId: uuid('tool_id').references(() => mcpTools.id).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  amountRaw: decimal('amount_raw', { precision: 38, scale: 0 }).notNull(), // Base units as NUMERIC(38,0)
  tokenDecimals: integer('token_decimals').notNull(), // Token decimals for self-sufficient records
  currency: text('currency').notNull(), // Token symbol or contract address
  network: text('network').notNull(),
  transactionHash: text('transaction_hash').unique(),
  status: text('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  settledAt: timestamp('settled_at'),
  signature: text('signature'),
  paymentData: jsonb('payment_data'),
}, (table) => [
  index('payment_tool_id_idx').on(table.toolId),
  index('payment_user_id_idx').on(table.userId),
  index('payment_status_idx').on(table.status),
  index('payment_created_at_idx').on(table.createdAt),
  index('payment_network_idx').on(table.network),
  index('payment_tool_user_idx').on(table.toolId, table.userId),
  check('amount_raw_positive_check', sql`"amount_raw" >= 0`), // Can validate numeric values
]);

export const serverOwnership = pgTable('server_ownership', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: uuid('server_id').references(() => mcpServers.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: text('role').default('viewer').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
  active: boolean('active').default(true).notNull(),
}, (table) => [
  uniqueIndex('server_ownership_server_user_idx').on(table.serverId, table.userId),
  index('server_ownership_server_id_idx').on(table.serverId),
  index('server_ownership_user_id_idx').on(table.userId),
  index('server_ownership_active_idx').on(table.active),
]);

export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  serverId: uuid('server_id').references(() => mcpServers.id, { onDelete: 'cascade' }).notNull(),
  url: text('url').notNull(),
  secret: text('secret'),
  events: text('events').array().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  active: boolean('active').default(true).notNull(),
  lastTriggeredAt: timestamp('last_triggered_at'),
  failureCount: integer('failure_count').default(0).notNull(),
}, (table) => [
  index('webhook_server_id_idx').on(table.serverId),
  index('webhook_active_idx').on(table.active),
  index('webhook_failure_count_idx').on(table.failureCount),
]);

// Analytics table removed - now computed from views in real-time

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  keyHash: text('key_hash').notNull().unique(),
  name: text('name').notNull(),
  permissions: text('permissions').array().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
  lastUsedAt: timestamp('last_used_at'),
  active: boolean('active').default(true).notNull(),
}, (table) => [
  index('api_key_user_id_idx').on(table.userId),
  index('api_key_active_idx').on(table.active),
  index('api_key_expires_at_idx').on(table.expiresAt),
]);

// VLayer Proofs table for storing verification results and web proofs
export const proofs = pgTable('proofs', {
  id: uuid('id').primaryKey().defaultRandom(),
  toolId: uuid('tool_id').references(() => mcpTools.id, { onDelete: 'cascade' }).notNull(),
  serverId: uuid('server_id').references(() => mcpServers.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  
  // Verification results
  isConsistent: boolean('is_consistent').notNull(),
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }).notNull(), // 0.00 to 1.00
  
  // Execution context
  executionUrl: text('execution_url'), // URL that was called
  executionMethod: text('execution_method'), // GET, POST, etc.
  executionHeaders: jsonb('execution_headers'), // Headers used
  executionParams: jsonb('execution_params').notNull(), // Tool parameters
  executionResult: jsonb('execution_result').notNull(), // Tool result
  executionTimestamp: timestamp('execution_timestamp').notNull(),
  
  // Verification metadata
  aiEvaluation: text('ai_evaluation').notNull(), // AI evaluation text
  inconsistencies: jsonb('inconsistencies'), // Array of inconsistency objects
  
  // Web proof data (from vlayer)
  webProofPresentation: text('web_proof_presentation'), // The cryptographic proof
  notaryUrl: text('notary_url'), // Notary used for web proof
  proofMetadata: jsonb('proof_metadata'), // Additional proof metadata
  
  // Replay execution data (if applicable)
  replayExecutionResult: jsonb('replay_execution_result'),
  replayExecutionTimestamp: timestamp('replay_execution_timestamp'),
  
  // Status and timestamps
  status: text('status').default('verified').notNull(), // verified, invalid, pending
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  
  // Verification type
  verificationType: text('verification_type').default('execution').notNull(), // execution, replay, comparison
}, (table) => [
  index('proof_tool_id_idx').on(table.toolId),
  index('proof_server_id_idx').on(table.serverId),
  index('proof_user_id_idx').on(table.userId),
  index('proof_status_idx').on(table.status),
  index('proof_created_at_idx').on(table.createdAt),
  index('proof_is_consistent_idx').on(table.isConsistent),
  index('proof_confidence_score_idx').on(table.confidenceScore),
  index('proof_verification_type_idx').on(table.verificationType),
  index('proof_tool_created_idx').on(table.toolId, table.createdAt),
  index('proof_server_consistent_idx').on(table.serverId, table.isConsistent),
  check('confidence_score_range_check', sql`"confidence_score" >= 0 AND "confidence_score" <= 1`),
]);

// Relations
export const mcpServersRelations = relations(mcpServers, ({ one, many }) => ({
  creator: one(users, {
    fields: [mcpServers.creatorId],
    references: [users.id],
  }),
  tools: many(mcpTools),
  // analytics removed - now computed from views
  ownership: many(serverOwnership),
  webhooks: many(webhooks),
  proofs: many(proofs),
}));

export const mcpToolsRelations = relations(mcpTools, ({ one, many }) => ({
  server: one(mcpServers, {
    fields: [mcpTools.serverId],
    references: [mcpServers.id],
  }),
  pricing: many(toolPricing),
  usage: many(toolUsage),
  payments: many(payments),
  proofs: many(proofs),
}));

export const usersRelations = relations(users, ({ many }) => ({
  createdServers: many(mcpServers),
  serverOwnerships: many(serverOwnership, {
    relationName: "userOwnerships"
  }),
  grantedOwnerships: many(serverOwnership, {
    relationName: "grantedOwnerships"
  }),
  payments: many(payments),
  toolUsage: many(toolUsage),
  apiKeys: many(apiKeys),
  proofs: many(proofs),
  // Auth relations
  sessions: many(session),
  accounts: many(account),
  // Wallet relations
  wallets: many(userWallets),
}));

export const userWalletsRelations = relations(userWallets, ({ one }) => ({
  user: one(users, {
    fields: [userWallets.userId],
    references: [users.id],
  }),
}));

// Auth table relations
export const sessionRelations = relations(session, ({ one }) => ({
  user: one(users, {
    fields: [session.userId],
    references: [users.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(users, {
    fields: [account.userId],
    references: [users.id],
  }),
}));

export const toolPricingRelations = relations(toolPricing, ({ one, many }) => ({
  tool: one(mcpTools, {
    fields: [toolPricing.toolId],
    references: [mcpTools.id],
  }),
  usage: many(toolUsage), // One pricing can be used by many tool usages
}));

export const toolUsageRelations = relations(toolUsage, ({ one }) => ({
  tool: one(mcpTools, {
    fields: [toolUsage.toolId],
    references: [mcpTools.id],
  }),
  pricing: one(toolPricing, {
    fields: [toolUsage.pricingId],
    references: [toolPricing.id],
  }),
  user: one(users, {
    fields: [toolUsage.userId],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  tool: one(mcpTools, {
    fields: [payments.toolId],
    references: [mcpTools.id],
  }),
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
}));

export const serverOwnershipRelations = relations(serverOwnership, ({ one }) => ({
  server: one(mcpServers, {
    fields: [serverOwnership.serverId],
    references: [mcpServers.id],
  }),
  user: one(users, {
    fields: [serverOwnership.userId],
    references: [users.id],
    relationName: "userOwnerships"
  }),
  grantedByUser: one(users, {
    fields: [serverOwnership.grantedBy],
    references: [users.id],
    relationName: "grantedOwnerships"
  }),
}));

export const webhooksRelations = relations(webhooks, ({ one }) => ({
  server: one(mcpServers, {
    fields: [webhooks.serverId],
    references: [mcpServers.id],
  }),
}));

// analyticsRelations removed - analytics table no longer exists

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const proofsRelations = relations(proofs, ({ one }) => ({
  tool: one(mcpTools, {
    fields: [proofs.toolId],
    references: [mcpTools.id],
  }),
  server: one(mcpServers, {
    fields: [proofs.serverId],
    references: [mcpServers.id],
  }),
  user: one(users, {
    fields: [proofs.userId],
    references: [users.id],
  }),
}));

// Database Views for Analytics
// These views replace the analytics table with real-time computed analytics

/**
 * Daily Server Analytics View
 * Computes daily analytics for each server by aggregating tool_usage and payments data
 */
export const dailyServerAnalyticsView = pgView("daily_server_analytics").as((qb) => 
  qb
    .select({
      serverId: sql<string>`mcp_servers.id`.as('server_id'),
      date: sql<string>`DATE(COALESCE(tool_usage.timestamp, payments.created_at))`.as('date'),
      totalRequests: sql<number>`COUNT(DISTINCT tool_usage.id)`.as('total_requests'),
      uniqueUsers: sql<number>`COUNT(DISTINCT COALESCE(tool_usage.user_id, payments.user_id))`.as('unique_users'),
      errorCount: sql<number>`COUNT(DISTINCT CASE WHEN tool_usage.response_status NOT IN ('success', '200') THEN tool_usage.id END)`.as('error_count'),
      avgResponseTime: sql<number>`AVG(tool_usage.execution_time_ms)`.as('avg_response_time'),
      // Multi-currency revenue tracking using JSON arrays (no nested aggregation)
      revenueDetails: sql<RevenueDetails>`
        JSON_AGG(
          JSONB_BUILD_OBJECT(
            'currency', payments.currency,
            'network', payments.network,
            'decimals', payments.token_decimals,
            'amount_raw', payments.amount_raw
          )
        ) FILTER (WHERE payments.status = 'completed' AND payments.amount_raw IS NOT NULL)
      `.as('revenue_details'),
      totalPayments: sql<number>`COUNT(DISTINCT CASE WHEN payments.status = 'completed' THEN payments.id END)`.as('total_payments'),
    })
    .from(mcpServers)
    .leftJoin(mcpTools, sql`mcp_tools.server_id = mcp_servers.id`)
    .leftJoin(toolUsage, sql`tool_usage.tool_id = mcp_tools.id`)
    .leftJoin(payments, sql`payments.tool_id = mcp_tools.id`)
    .where(sql`COALESCE(tool_usage.timestamp, payments.created_at) IS NOT NULL`)
    .groupBy(sql`mcp_servers.id, DATE(COALESCE(tool_usage.timestamp, payments.created_at))`)
);

/**
 * Server Summary Analytics View  
 * Provides aggregated analytics per server across all time
 */
export const serverSummaryAnalyticsView = pgView("server_summary_analytics").as((qb) =>
  qb
    .select({
      serverId: sql<string>`mcp_servers.id`.as('server_id'),
      serverName: sql<string>`mcp_servers.name`.as('server_name'),
      totalRequests: sql<number>`COUNT(DISTINCT tool_usage.id)`.as('total_requests'),
      totalTools: sql<number>`COUNT(DISTINCT mcp_tools.id)`.as('total_tools'),
      monetizedTools: sql<number>`COUNT(DISTINCT CASE WHEN mcp_tools.is_monetized THEN mcp_tools.id END)`.as('monetized_tools'),
      uniqueUsers: sql<number>`COUNT(DISTINCT COALESCE(tool_usage.user_id, payments.user_id))`.as('unique_users'),
      totalPayments: sql<number>`COUNT(DISTINCT CASE WHEN payments.status = 'completed' THEN payments.id END)`.as('total_payments'),
      errorCount: sql<number>`COUNT(DISTINCT CASE WHEN tool_usage.response_status NOT IN ('success', '200') THEN tool_usage.id END)`.as('error_count'),
      avgResponseTime: sql<number>`AVG(tool_usage.execution_time_ms)`.as('avg_response_time'),
      successRate: sql<number>`
        CASE 
          WHEN COUNT(DISTINCT tool_usage.id) > 0 THEN
            (COUNT(DISTINCT CASE WHEN tool_usage.response_status IN ('success', '200') THEN tool_usage.id END)::float / COUNT(DISTINCT tool_usage.id)) * 100
          ELSE 0
        END
      `.as('success_rate'),
      // Multi-currency revenue tracking using JSON arrays
      revenueDetails: sql<RevenueDetails>`
        JSON_AGG(
          JSONB_BUILD_OBJECT(
            'currency', payments.currency,
            'network', payments.network,
            'decimals', payments.token_decimals,
            'amount_raw', payments.amount_raw
          )
        ) FILTER (WHERE payments.status = 'completed' AND payments.amount_raw IS NOT NULL)
      `.as('revenue_details'),
      // Recent activity indicators (last 30 days)
      recentRequests: sql<number>`
        COUNT(DISTINCT CASE 
          WHEN tool_usage.timestamp > NOW() - INTERVAL '30 days' 
          THEN tool_usage.id 
        END)
      `.as('recent_requests'),
      recentPayments: sql<number>`
        COUNT(DISTINCT CASE 
          WHEN payments.created_at > NOW() - INTERVAL '30 days' AND payments.status = 'completed' 
          THEN payments.id 
        END)
      `.as('recent_payments'),
      lastActivity: sql<string>`
        GREATEST(
          MAX(tool_usage.timestamp),
          MAX(payments.created_at)
        )
      `.as('last_activity'),
    })
    .from(mcpServers)
    .leftJoin(mcpTools, sql`mcp_tools.server_id = mcp_servers.id`)
    .leftJoin(toolUsage, sql`tool_usage.tool_id = mcp_tools.id`)
    .leftJoin(payments, sql`payments.tool_id = mcp_tools.id`)
    .groupBy(sql`mcp_servers.id, mcp_servers.name`)
);

/**
 * Global Platform Analytics View
 * Provides platform-wide statistics for dashboard and landing page
 */
export const globalAnalyticsView = pgView("global_analytics").as((qb) =>
  qb
    .select({
      totalServers: sql<number>`COUNT(DISTINCT mcp_servers.id)`.as('total_servers'),
      activeServers: sql<number>`COUNT(DISTINCT CASE WHEN mcp_servers.status = 'active' THEN mcp_servers.id END)`.as('active_servers'),
      totalTools: sql<number>`COUNT(DISTINCT mcp_tools.id)`.as('total_tools'),
      monetizedTools: sql<number>`COUNT(DISTINCT CASE WHEN mcp_tools.is_monetized THEN mcp_tools.id END)`.as('monetized_tools'),
      totalRequests: sql<number>`COUNT(DISTINCT tool_usage.id)`.as('total_requests'),
      successfulRequests: sql<number>`COUNT(DISTINCT CASE WHEN tool_usage.response_status IN ('success', '200') THEN tool_usage.id END)`.as('successful_requests'),
      uniqueUsers: sql<number>`COUNT(DISTINCT COALESCE(tool_usage.user_id, payments.user_id))`.as('unique_users'),
      totalPayments: sql<number>`COUNT(DISTINCT CASE WHEN payments.status = 'completed' THEN payments.id END)`.as('total_payments'),
      avgResponseTime: sql<number>`AVG(tool_usage.execution_time_ms)`.as('avg_response_time'),
      // Multi-currency revenue tracking using JSON arrays
      revenueDetails: sql<RevenueDetails>`
        JSON_AGG(
          JSONB_BUILD_OBJECT(
            'currency', payments.currency,
            'network', payments.network,
            'decimals', payments.token_decimals,
            'amount_raw', payments.amount_raw
          )
        ) FILTER (WHERE payments.status = 'completed' AND payments.amount_raw IS NOT NULL)
      `.as('revenue_details'),
      // Proof verification stats
      totalProofs: sql<number>`COUNT(DISTINCT proofs.id)`.as('total_proofs'),
      consistentProofs: sql<number>`COUNT(DISTINCT CASE WHEN proofs.is_consistent THEN proofs.id END)`.as('consistent_proofs'),
    })
    .from(mcpServers)
    .leftJoin(mcpTools, sql`mcp_tools.server_id = mcp_servers.id`)
    .leftJoin(toolUsage, sql`tool_usage.tool_id = mcp_tools.id`)
    .leftJoin(payments, sql`payments.tool_id = mcp_tools.id`)
    .leftJoin(proofs, sql`proofs.server_id = mcp_servers.id`)
);

/**
 * Tool Performance Analytics View
 * Provides detailed analytics per tool for optimization insights
 */
export const toolAnalyticsView = pgView("tool_analytics").as((qb) =>
  qb
    .select({
      toolId: sql<string>`mcp_tools.id`.as('tool_id'),
      toolName: sql<string>`mcp_tools.name`.as('tool_name'),
      serverId: sql<string>`mcp_tools.server_id`.as('server_id'),
      isMonetized: sql<boolean>`mcp_tools.is_monetized`.as('is_monetized'),
      totalRequests: sql<number>`COUNT(DISTINCT tool_usage.id)`.as('total_requests'),
      successfulRequests: sql<number>`COUNT(DISTINCT CASE WHEN tool_usage.response_status IN ('success', '200') THEN tool_usage.id END)`.as('successful_requests'),
      uniqueUsers: sql<number>`COUNT(DISTINCT tool_usage.user_id)`.as('unique_users'),
      avgResponseTime: sql<number>`AVG(tool_usage.execution_time_ms)`.as('avg_response_time'),
      totalPayments: sql<number>`COUNT(DISTINCT CASE WHEN payments.status = 'completed' THEN payments.id END)`.as('total_payments'),
      // Multi-currency revenue tracking using JSON arrays
      revenueDetails: sql<RevenueDetails>`
        JSON_AGG(
          JSONB_BUILD_OBJECT(
            'currency', payments.currency,
            'network', payments.network,
            'decimals', payments.token_decimals,
            'amount_raw', payments.amount_raw
          )
        ) FILTER (WHERE payments.status = 'completed' AND payments.amount_raw IS NOT NULL)
      `.as('revenue_details'),
      lastUsed: sql<string>`MAX(tool_usage.timestamp)`.as('last_used'),
      // Recent activity (last 30 days)
      recentRequests: sql<number>`
        COUNT(DISTINCT CASE 
          WHEN tool_usage.timestamp > NOW() - INTERVAL '30 days' 
          THEN tool_usage.id 
        END)
      `.as('recent_requests'),
    })
    .from(mcpTools)
    .leftJoin(toolUsage, sql`tool_usage.tool_id = mcp_tools.id`)
    .leftJoin(payments, sql`payments.tool_id = mcp_tools.id`)
    .groupBy(sql`mcp_tools.id, mcp_tools.name, mcp_tools.server_id, mcp_tools.is_monetized`)
);

/**
 * Daily Activity Timeline View
 * Provides day-by-day activity metrics for charts and trends
 */
export const dailyActivityView = pgView("daily_activity").as((qb) =>
  qb
    .select({
      date: sql<string>`DATE(COALESCE(tool_usage.timestamp, payments.created_at))`.as('date'),
      totalRequests: sql<number>`COUNT(DISTINCT tool_usage.id)`.as('total_requests'),
      uniqueUsers: sql<number>`COUNT(DISTINCT COALESCE(tool_usage.user_id, payments.user_id))`.as('unique_users'),
      totalPayments: sql<number>`COUNT(DISTINCT CASE WHEN payments.status = 'completed' THEN payments.id END)`.as('total_payments'),
      avgResponseTime: sql<number>`AVG(tool_usage.execution_time_ms)`.as('avg_response_time'),
      // Multi-currency daily revenue tracking using JSON arrays
      revenueDetails: sql<RevenueDetails>`
        JSON_AGG(
          JSONB_BUILD_OBJECT(
            'currency', payments.currency,
            'network', payments.network,
            'decimals', payments.token_decimals,
            'amount_raw', payments.amount_raw
          )
        ) FILTER (WHERE payments.status = 'completed' AND payments.amount_raw IS NOT NULL)
      `.as('revenue_details'),
    })
    .from(toolUsage)
    .fullJoin(payments, sql`DATE(tool_usage.timestamp) = DATE(payments.created_at)`)
    .where(sql`COALESCE(tool_usage.timestamp, payments.created_at) IS NOT NULL`)
    .groupBy(sql`DATE(COALESCE(tool_usage.timestamp, payments.created_at))`)
    .orderBy(sql`DATE(COALESCE(tool_usage.timestamp, payments.created_at)) DESC`)
);
