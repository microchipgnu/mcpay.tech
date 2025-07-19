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