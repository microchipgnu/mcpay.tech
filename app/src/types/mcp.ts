/**
 * MCP (Model Context Protocol) Types
 * 
 * Centralized MCP server, tool, and execution type definitions for MCPay.tech
 * Includes server registration, tool definitions, and execution context types.
 */

import { mcpServers, mcpTools } from "@/lib/gateway/db/schema";
import type { Network } from "./blockchain";

// =============================================================================
// DB-INFERRED MCP TYPES
// =============================================================================

/** MCP Server record from database */
export type McpServer = typeof mcpServers.$inferSelect;

/** MCP Server insert data for database */
export type McpServerInsert = typeof mcpServers.$inferInsert;

/** MCP Tool record from database */
export type McpTool = typeof mcpTools.$inferSelect;

/** MCP Tool insert data for database */
export type McpToolInsert = typeof mcpTools.$inferInsert;

// =============================================================================
// CORE MCP SERVER TYPES
// =============================================================================

export interface MCPServer {
  id: string;
  name: string;
  description?: string;
  url: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  tools: MCPTool[];
  creator?: {
    id: string;
    name?: string;
    email: string;
  };
  // Additional UI fields
  category?: string;
  icon?: React.ReactNode;
  verified?: boolean;
}

export interface EnhancedServerRegistration {
  id: string;
  name: string;
  description?: string;
  url: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  tools: MCPTool[];
  creator?: {
    id: string;
    name?: string;
    email: string;
  };
  totalExecutions?: number;
  lastExecuted?: Date;
  revenue?: string;
  executionCount?: number;
  averageExecutionTime?: number;
  successRate?: number;
  // Legacy fields
  mcpOrigin?: string;
  receiverAddress?: string;
  requireAuth?: boolean;
  authHeaders?: Record<string, unknown>;
  walletInfo?: {
    blockchain: string;
    network: string;
    walletType: 'external' | 'managed' | 'custodial';
    provider?: string;
    primaryWallet: boolean;
  };
  metadata?: Record<string, unknown>;
}

// =============================================================================
// MCP TOOL TYPES
// =============================================================================

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: MCPToolInputSchema;
}

export interface MCPToolInputSchema {
  type: 'object';
  properties: Record<string, MCPInputPropertySchema>;
  required?: string[];
}

export interface MCPInputPropertySchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: any[];
  items?: MCPInputPropertySchema;
  properties?: Record<string, MCPInputPropertySchema>;
  required?: string[];
  default?: any;
  examples?: any[];
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

export interface MCPToolFromClient {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
  pricing?: {
    amount: string;
    currency: string;
    network: string;
  };
  // Extended properties for client-side tools
  parameters?: {
    jsonSchema?: {
      properties?: Record<string, InputProperty>;
      required?: string[];
    };
  };
  execute?: (params: Record<string, unknown>, options: { toolCallId: string; messages: unknown[] }) => Promise<unknown>;
}

// =============================================================================
// TOOL EXECUTION TYPES
// =============================================================================

export type ExecutionStatus = 'idle' | 'initializing' | 'executing' | 'success' | 'error';

export interface ToolExecution {
  id: string;
  status: ExecutionStatus;
  result?: any;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
}

// =============================================================================
// TOOL SCHEMA TYPES
// =============================================================================

export interface InputProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required?: boolean;
  default?: any;
  enum?: any[];
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
}

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, InputProperty>;
  required?: string[];
}

export interface Tool {
  name: string;
  description?: string;
  inputSchema: ToolInputSchema;
  pricing?: {
    amount: string;
    currency: string;
    network: string;
  };
  serverId: string;
  serverName: string;
  // Extended UI properties
  id?: string;
  isMonetized?: boolean;
  pricing?: Array<{
    id: string;
    price: string;
    currency: string;
    network: string;
    assetAddress: string;
    active: boolean;
  }>;
}

// =============================================================================
// TOOL EXECUTION MODAL TYPES
// =============================================================================

export interface ToolExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tool: Tool | null;
  onExecute: (toolName: string, args: Record<string, any>) => Promise<any>;
  execution: ToolExecution;
  serverId: string;
  serverUrl: string;
  serverName: string;
  paymentInfo?: PaymentInfo;
}

// TODO: This will be properly typed when experimental_createMCPClient is available
export type MCPClient = any;
export type MCPToolsCollection = Record<string, unknown>;

// =============================================================================
// TOOL CALL TYPES
// =============================================================================

export type ToolCall = {
  tool: string;
  arguments: Record<string, any>;
  payment?: {
    amount: string;
    currency: string;
    network: string;
  };
};

export type PaymentToolCall = {
  tool: string;
  arguments: Record<string, any>;
  payment: {
    amount: string;
    currency: string;
    network: string;
    recipient: string;
    token: string;
  };
  user: {
    id: string;
    address: string;
  };
};

// =============================================================================
// ANALYTICS TYPES
// =============================================================================

export interface AnalyticsData {
  totalServers: number;
  totalTools: number;
  totalExecutions: number;
  totalRevenue: string;
  topServers: Array<{
    id: string;
    name: string;
    executionCount: number;
    revenue: string;
  }>;
  topTools: Array<{
    name: string;
    serverId: string;
    serverName: string;
    executionCount: number;
    revenue: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: 'execution' | 'registration' | 'payment';
    description: string;
    timestamp: Date;
    userId?: string;
    serverId?: string;
  }>;
  // Extended analytics
  totalRequests?: number;
  successfulRequests?: number;
  failedRequests?: number;
  successRate?: number;
  averageExecutionTime?: number;
  totalPayments?: number;
  averagePaymentValue?: number;
  activeServers?: number;
  monetizedTools?: number;
  uniqueUsers?: number;
  totalProofs?: number;
  consistentProofs?: number;
  consistencyRate?: number;
  topToolsByRequests?: Array<{
    id: string;
    name: string;
    requests: number;
    revenue: number;
  }>;
  topToolsByRevenue?: Array<{
    id: string;
    name: string;
    requests: number;
    revenue: number;
  }>;
  dailyActivity?: Array<{
    date: string;
    requests: number;
    revenue: number;
  }>;
}

// =============================================================================
// SEARCH AND FILTERING TYPES
// =============================================================================

export interface SearchState {
  query: string;
  category: string;
  priceRange: [number, number];
  network: string;
  sortBy: 'name' | 'price' | 'popularity' | 'recent';
  sortOrder: 'asc' | 'desc';
}

// =============================================================================
// SERVER DATA TYPES
// =============================================================================

export interface ServerData {
  id: string;
  name: string;
  description?: string;
  url: string;
  createdAt: Date;
  tools: ServerTool[];
  creator: {
    name?: string;
    email: string;
  };
}

export interface ServerTool {
  name: string;
  description?: string;
  inputSchema: any;
  pricing?: {
    amount: string;
    currency: string;
    network: string;
  };
}

export interface ConvertedTool extends Omit<ServerTool, 'pricing'> {
  pricing?: {
    amount: string;
    currency: string;
    network: string;
    formattedAmount?: string;
    usdValue?: string;
  };
  serverId: string;
  serverName: string;
}

// =============================================================================
// API TYPES
// =============================================================================

export interface APIServer {
  id: string;
  name: string;
  description?: string;
  url: string;
  tools: APITool[];
  // Extended API server properties
  serverId?: string;
  receiverAddress?: string;
  metadata?: Record<string, unknown>;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface APITool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
  };
  pricing?: {
    amount: string;
    currency: string;
    network: string;
  };
}

// =============================================================================
// DATABASE RESULT TYPES
// =============================================================================

export interface DbToolResult {
  id: string;
  toolName: string;
  arguments: Record<string, any>;
  result: any;
  error?: string;
  executedAt: Date;
  duration?: number;
  userId: string;
  serverId: string;
  paymentId?: string;
  proofId?: string;
}

// =============================================================================
// TOOL CONFIGURATION TYPES
// =============================================================================

export interface McpToolConfig {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
  };
  pricing?: {
    amount: string;
    currency: string;
    network: string;
  };
}

// =============================================================================
// REGISTRATION TYPES
// =============================================================================

export interface RegistrationMetadata {
  userAgent?: string;
  ipAddress?: string;
  timestamp: Date;
  version?: string;
}

export interface RegistrationData {
  name: string;
  description?: string;
  url: string;
  tools: McpToolConfig[];
  metadata?: RegistrationMetadata;
}

// =============================================================================
// EXECUTION HEADERS TYPES
// =============================================================================

export interface ExecutionHeaders {
  authorization?: string;
  'x-user-id'?: string;
  'x-execution-id'?: string;
  'content-type'?: string;
}

export interface StoredExecutionHeaders {
  userId: string;
  executionId: string;
  authorization?: string;
  additionalHeaders?: Record<string, string>;
  createdAt: Date;
  expiresAt?: Date;
}

// =============================================================================
// LEGACY COMPATIBILITY TYPES
// =============================================================================

// TODO: These will be properly typed based on database operations
export type McpServerList = any; // Will be properly typed based on txOperations.listMcpServers result
export type McpServerWithRelations = any; // Will be properly typed based on database query result
export type McpServerWithActivity = any; // Will be properly typed based on txOperations.listMcpServersByActivity result

// =============================================================================
// PAYMENT INFO (referenced but defined in payments.ts)
// =============================================================================

// Forward declaration - actual definition is in payments.ts
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