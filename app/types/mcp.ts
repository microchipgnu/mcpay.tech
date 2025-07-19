/**
 * MCP (Model Context Protocol) core types
 */

/** MCP tool call with payment info */
export type ToolCall = {
    name: string;
    args: Record<string, unknown>;
    isPaid: boolean;
    payment?: PaymentInfo;
    id?: string;
    toolId?: string;
    serverId?: string;
    pricingId?: string; // Include pricing ID for usage tracking
};

/** Database tool query result */
export interface DbToolResult {
    id: string;
    name: string;
    description: string;
    inputSchema: unknown;
    isMonetized: boolean;
    payment: unknown;
    status: string;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    serverId: string;
}

/** Payment information structure (canonical version with string amounts) */
export interface PaymentInfo {
    maxAmountRequired: string;
    network: string;
    asset: string;
    payTo?: string;
    resource: string;
    description: string;
    // Optional pricing metadata when using tool_pricing table
    _pricingInfo?: {
        humanReadableAmount: string;
        currency: string;
        network: string;
        tokenDecimals: number;
        assetAddress?: string;
        priceRaw: string; // Original base units from pricing table
        pricingId: string; // Pricing ID for usage tracking
    };
}

/** Tool payment info variant (used in API) */
export interface ToolPaymentInfo {
    maxAmountRequired: string; // Base units as string for precision
    asset: string;
    network: string;
    resource?: string;
    description?: string;
}

/** Execution headers stored in database */
export interface ExecutionHeaders {
    headers: string[];
}

// =============================================================================
// MCP TOOL SCHEMA TYPES
// =============================================================================

/** MCP input property schema */
export interface MCPInputPropertySchema {
    type: string;
    description?: string;
    [key: string]: unknown;
}

/** MCP tool definition */
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

/** API tool from backend */
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

/** MCP server definition */
export interface MCPServer {
    id: string;
    name: string;
    description: string;
    url: string;
    category: string;
    tools: MCPTool[];
    icon: React.ReactNode;
    verified?: boolean;
}

/** API server definition */
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

/** Analytics data structure */
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

/** Search state for MCP servers */
export interface SearchState {
    query: string;
    results: MCPServer[];
    isActive: boolean;
    isLoading: boolean;
    error: string | null;
}

// =============================================================================
// SERVER DETAIL PAGE TYPES
// =============================================================================

/** Complex server tool with relations (for server detail pages) */
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

/** Converted tool format for ToolExecutionModal */
export interface ConvertedTool extends Omit<ServerTool, 'pricing'> {
    pricing: Array<{
        id: string;
        price: string;
        currency: string;
        network: string;
        assetAddress: string;
        // Add other converted pricing fields as needed
    }>;
}

/** Server data with full relations for server detail page */
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
    creator: {
        id: string;
        walletAddress?: string;
        displayName?: string;
        name?: string;
        avatarUrl?: string;
        image?: string; // From better-auth
    };
    tools: ServerTool[];
    analytics: Array<{
        id: string;
        date: string;
        totalRequests: number;
        totalRevenueRaw: string; // Deprecated - base units as string
        revenueByCurrency?: Record<string, string>; // New multi-currency format: { "USDC-6": "1000000" }
        uniqueUsers: number;
        avgResponseTime?: string; // Decimal as string
        toolUsage?: Record<string, number>;
        errorCount: number;
    }>;
    ownership: Array<{
        id: string;
        role: string;
        createdAt: string;
        active: boolean;
        user: {
            id: string;
            walletAddress?: string;
            displayName?: string;
            name?: string;
            avatarUrl?: string;
            image?: string;
        };
        grantedByUser?: {
            id: string;
            walletAddress?: string;
            displayName?: string;
            name?: string;
            // Add other fields as needed
        };
    }>;
}