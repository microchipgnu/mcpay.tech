/**
 * API-Specific Type Definitions
 * 
 * This file contains type definitions specifically for API routes, server operations,
 * and client-server communication types that don't fit into other domain-specific type files.
 */

// =============================================================================
// API ROUTE TYPES
// =============================================================================

// Type definitions for MCP Server objects using inferred types from database operations
export type McpServerList = any; // Will be properly typed when txOperations types are available
export type McpServerWithRelations = any; // McpServerList[number]
export type McpServerWithActivity = any; // Awaited<ReturnType<ReturnType<typeof txOperations.listMcpServersByActivity>>>[number]

// Interface for payment information from tools (API route specific)
export interface ToolPaymentInfo {
  maxAmountRequired: string; // Base units as string for precision
  asset: string;
  network: string;
  resource?: string;
  description?: string;
}

// Interface for execution headers stored in database
export interface ExecutionHeaders {
  headers: string[];
}

// Better-auth session type (inferred from auth instance)
export type AuthSession = any; // typeof auth.$Infer.Session - will be properly typed when available

// Extend Hono context with proper typing
export type AppContext = {
  Variables: {
    // Optional session and user - will be undefined if not authenticated
    session?: any; // AuthSession['session']
    user?: any; // AuthSession['user']
    // Helper method to get authenticated user (throws if not authenticated)
    requireUser(): any; // AuthSession['user']
  };
};

// Type helper to recursively convert BigInt values to strings in type definitions
export type SerializeBigInts<T> = T extends bigint
  ? string
  : T extends Array<infer U>
  ? Array<SerializeBigInts<U>>
  : T extends Record<string, unknown>
  ? { [K in keyof T]: SerializeBigInts<T[K]> }
  : T;

// =============================================================================
// PAGE DATA TYPES
// =============================================================================

// API response types for tools
export interface APITool {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  isMonetized: boolean;
  payment: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// MCP tool interface for client usage
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties: Record<string, MCPInputPropertySchema>;
  };
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

// MCP input property schema
export interface MCPInputPropertySchema {
  type: string;
  description?: string;
  [key: string]: unknown;
}

// API server interface
export interface APIServer {
  id: string;
  serverId: string;
  name: string;
  receiverAddress: string;
  description: string;
  metadata?: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
  tools: APITool[];
}

// Analytics data interface for dashboard
export interface AnalyticsData {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  averageExecutionTime: number;
  totalRevenue: number;
  totalPayments: number;
  averagePaymentValue: number;
  totalServers: number;
  activeServers: number;
  totalTools: number;
  monetizedTools: number;
  uniqueUsers: number;
  totalProofs: number;
  consistentProofs: number;
  consistencyRate: number;
  topToolsByRequests: Array<{
    id: string;
    name: string;
    requests: number;
    revenue: number;
  }>;
  topToolsByRevenue: Array<{
    id: string;
    name: string;
    requests: number;
    revenue: number;
  }>;
  dailyActivity: Array<{
    date: string;
    requests: number;
    revenue: number;
    uniqueUsers: number;
  }>;
}

// Search state type for UI
export interface SearchState {
  query: string;
  results: any[]; // Will be typed as MCPServer[] when available
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
}

// =============================================================================
// SERVER DETAIL PAGE TYPES
// =============================================================================

// Types based on the database schema - matching the actual schema.ts structure
export interface ServerTool {
  id: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  isMonetized: boolean;
  payment?: Record<string, unknown>;
  status: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  pricing: Array<{
    id: string;
    priceRaw: string; // Base units as string (from NUMERIC(38,0))
    tokenDecimals: number; // Decimals for the token
    currency: string; // Token symbol or contract address
    network: string;
    assetAddress?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  payments: Array<{
    id: string;
    amountRaw: string; // Base units as string (from NUMERIC(38,0))
    tokenDecimals: number; // Decimals for the token
    currency: string; // Token symbol or contract address
    network: string;
    status: string;
    createdAt: string;
    settledAt?: string;
    transactionHash?: string;
    user: {
      id: string;
      walletAddress?: string;
      displayName?: string;
      name?: string;
    };
  }>;
  usage: Array<{
    id: string;
    timestamp: string;
    responseStatus?: string;
    executionTimeMs?: number;
    user: {
      id: string;
      walletAddress?: string;
      displayName?: string;
      name?: string;
    };
  }>;
  proofs: Array<{
    id: string;
    isConsistent: boolean;
    confidenceScore: string; // Decimal as string
    status: string;
    verificationType: string;
    createdAt: string;
    webProofPresentation?: string;
    user: {
      id: string;
      walletAddress?: string;
      displayName?: string;
      name?: string;
    };
  }>;
}

// Type for the converted tool format used by ToolExecutionModal
export interface ConvertedTool extends Omit<ServerTool, 'pricing'> {
  pricing: Array<{
    id: string;
    price: string;
    currency: string;
    network: string;
    assetAddress: string;
    active: boolean;
  }>;
}

// Server data interface
export interface ServerData {
  id: string;
  serverId: string;
  name?: string;
  mcpOrigin: string;
  receiverAddress: string;
  description?: string;
  metadata?: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
  tools: ServerTool[];
}

// =============================================================================
// REGISTRATION PAGE TYPES
// =============================================================================

// MCP tool interface for registration
export interface MCPRegistrationTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

// Payment info for registration success page
export interface PaymentInfo {
  maxAmountRequired: string;
  asset: string;
  network: string;
  resource?: string;
  description?: string;
}

// Tool interface for registration success page
export interface Tool {
  name: string;
  description?: string;
  payment?: PaymentInfo;
}

// Registration metadata interface
export interface RegistrationMetadata {
  mcpOrigin: string;
  receiverAddress: string;
  name?: string;
  description?: string;
  tools?: Tool[];
}

// Registration data interface
export interface RegistrationData {
  serverId: string;
  metadata: RegistrationMetadata;
}

// =============================================================================
// ACCOUNT MODAL TYPES
// =============================================================================

// Account modal props
export interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: string;
}

// Chain balance interface
export interface ChainBalance {
  balance: string;
  formattedBalance: string;
  usdValue?: string;
}

// Balances by chain interface
export interface BalancesByChain {
  [chainName: string]: {
    [tokenSymbol: string]: ChainBalance;
  };
}

// =============================================================================
// TOOL EXECUTION MODAL TYPES
// =============================================================================

// Input property interface for tool execution
export interface InputProperty {
  type: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  items?: {
    type: string;
    properties?: Record<string, InputProperty>;
  };
  properties?: Record<string, InputProperty>;
  required?: string[];
}

// Tool input schema interface
export interface ToolInputSchema {
  type: string;
  properties: Record<string, InputProperty>;
  required?: string[];
}

// Tool interface for execution modal
export interface ToolForExecution {
  id: string;
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  payment?: {
    maxAmountRequired: string;
    asset: string;
    network: string;
    description?: string;
  };
  pricing?: Array<{
    id: string;
    price: string;
    currency: string;
    network: string;
    assetAddress: string;
    active: boolean;
  }>;
}

// Tool execution modal props
export interface ToolExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tool: ToolForExecution | null;
  serverId: string;
  serverUrl: string;
}

// Tool execution interface
export interface ToolExecution {
  toolName: string;
  inputs: Record<string, unknown>;
  serverId: string;
}

// MCP tool input schema interface
export interface MCPToolInputSchema {
  type: string;
  properties?: Record<string, InputProperty>;
  required?: string[];
}

// MCP tool from client interface
export interface MCPToolFromClient {
  name: string;
  description?: string;
  inputSchema?: MCPToolInputSchema;
}