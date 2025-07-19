/**
 * Payment and transaction-related types
 */

import type { 
  users, 
  userWallets, 
  mcpServers, 
  mcpTools, 
  toolPricing, 
  toolUsage, 
  payments, 
  serverOwnership, 
  apiKeys 
} from '@/lib/gateway/db/schema';

/** Legacy payment info with number amounts (used in registration) */
export interface PaymentInfoLegacy {
  maxAmountRequired: number
  asset: string
  network: string
  resource: string
  description: string
}

/** Tool with optional payment info */
export interface Tool {
  name: string
  description: string
  payment?: PaymentInfoLegacy
}

/** Registration metadata */
export interface RegistrationMetadata {
  timestamp: string
  toolsCount: number
  registeredFromUI: boolean
  monetizedToolsCount: number
}

/** Registration data structure */
export interface RegistrationData {
  id: string
  serverId: string
  mcpOrigin: string
  creatorId: string
  // Add other registration data fields as needed
}

// =============================================================================
// DATABASE-INFERRED TYPES
// =============================================================================

/** User from database */
export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

/** User wallet from database */
export type UserWallet = typeof userWallets.$inferSelect;
export type UserWalletInsert = typeof userWallets.$inferInsert;

/** MCP server from database */
export type McpServer = typeof mcpServers.$inferSelect;
export type McpServerInsert = typeof mcpServers.$inferInsert;

/** MCP tool from database */
export type McpTool = typeof mcpTools.$inferSelect;
export type McpToolInsert = typeof mcpTools.$inferInsert;

/** Tool pricing from database */
export type ToolPricing = typeof toolPricing.$inferSelect;
export type ToolPricingInsert = typeof toolPricing.$inferInsert;

/** Tool usage from database */
export type ToolUsage = typeof toolUsage.$inferSelect;
export type ToolUsageInsert = typeof toolUsage.$inferInsert;

/** Payment from database */
export type Payment = typeof payments.$inferSelect;
export type PaymentInsert = typeof payments.$inferInsert;

/** Server ownership from database */
export type ServerOwnership = typeof serverOwnership.$inferSelect;
export type ServerOwnershipInsert = typeof serverOwnership.$inferInsert;

/** API key from database */
export type ApiKey = typeof apiKeys.$inferSelect;
export type ApiKeyInsert = typeof apiKeys.$inferInsert;