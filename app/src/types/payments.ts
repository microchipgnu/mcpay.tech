
// Enhanced payment information structure with embedded pricing
export interface PaymentInfo {
    maxAmountRequired: string;
    network: string;
    asset: string;
    payTo?: string;
    resource: string;
    description: string;
    // Optional pricing metadata when using tool_pricing table (legacy)
    _pricingInfo?: {
        humanReadableAmount: string;
        currency: string;
        network: string;
        tokenDecimals: number;
        assetAddress?: string;
        amountRaw: string; // Original base units from pricing table
        pricingId: string; // Pricing ID for usage tracking
    };
    // Enhanced pricing data (replaces toolPricing table)
    pricing?: PricingEntry[];
}

// Individual pricing entry within the payment data
export interface PricingEntry {
    id: string;               // UUID for identification
    amountRaw: string;         // Base units as string
    tokenDecimals: number;    // Token decimals
    currency: string;         // Token symbol or contract address
    network: string;          // Network identifier
    assetAddress?: string | null; // Contract address if applicable
    active: boolean;          // Whether this pricing is active
    createdAt: string;        // ISO timestamp
    updatedAt: string;        // ISO timestamp
}

// Define tool call type for better type safety
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

// Helper functions for working with enhanced pricing structure

/**
 * Extract active pricing from payment data
 */
export function getActivePricing(payment: PaymentInfo | null): PricingEntry | null {
    if (!payment?.pricing || !Array.isArray(payment.pricing)) {
        return null;
    }
    return payment.pricing.find(p => p.active === true) || null;
}

/**
 * Check if payment has active pricing
 */
export function hasActivePricing(payment: PaymentInfo | null): boolean {
    return getActivePricing(payment) !== null;
}

/**
 * Convert pricing entry to compatible format (same as old toolPricing table)
 */
export function toCompatiblePricing(toolId: string, pricing: PricingEntry): CompatiblePricingData {
    return {
        id: pricing.id,
        toolId,
        amountRaw: pricing.amountRaw,
        tokenDecimals: pricing.tokenDecimals,
        currency: pricing.currency,
        network: pricing.network,
        assetAddress: pricing.assetAddress,
        active: pricing.active,
        createdAt: new Date(pricing.createdAt),
        updatedAt: new Date(pricing.updatedAt)
    };
}

// Backward compatible pricing data format
export interface CompatiblePricingData {
    id: string;
    toolId: string;
    amountRaw: string;
    tokenDecimals: number;
    currency: string;
    network: string;
    assetAddress?: string | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}