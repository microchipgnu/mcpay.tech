/**
 * Database Actions for MCPay.fun
 * 
 * This module contains all database operations, including:
 * - User and wallet management (multi-blockchain support)
 * - MCP server and tool operations
 * - Payment and usage tracking  
 * - Analytics and proof verification
 * - CDP (Coinbase Developer Platform) managed wallet integration
 * 
 * ## CDP Auto-Creation:
 * - `userHasCDPWallets()` - Check if user has CDP wallets
 * - `autoCreateCDPWalletForUser()` - Auto-create CDP wallet with smart account
 * - `createCDPManagedWallet()` - Store CDP wallet in database
 * - `getCDPWalletsByUser()` - Get user's CDP wallets
 * - `getCDPWalletByAccountId()` - Find CDP wallet by account ID
 * - `updateCDPWalletMetadata()` - Update CDP wallet metadata
 * 
 * The auto-creation system ensures every user gets a managed wallet with:
 * - Regular account for general transactions
 * - Smart account with gas sponsorship on Base networks
 * - Secure key management via CDP's TEE infrastructure
 */

import {
    addRevenueToCurrency,
    formatRevenueByCurrency,
    fromBaseUnits, getBlockchainArchitecture
} from '@/lib/commons';
import { type BlockchainArchitecture, type RevenueByCurrency } from '@/types/blockchain';

import { createCDPAccount } from '@/lib/gateway/3rd-parties/cdp';
import db from "@/lib/gateway/db";
import {
    account,
    apiKeys,
    dailyActivityView,
    dailyServerAnalyticsView,
    globalAnalyticsView,
    mcpServers,
    mcpTools,
    payments,
    proofs,
    serverOwnership,
    serverSummaryAnalyticsView,
    session,
    toolAnalyticsView,
    // toolPricing table removed - using enhanced pricing operations instead
    toolUsage,
    users,
    userWallets,
    verification,
    webhooks,
    type RevenueDetails
} from "@/lib/gateway/db/schema";
import { PricingEntry } from '@/types/payments';
import { type CDPNetwork } from '@/types/wallet';
import { and, desc, eq, isNull } from "drizzle-orm";

// Define proper transaction type
export type TransactionType = Parameters<Parameters<typeof db['transaction']>[0]>[0];

// Helper function to process revenue details from views into RevenueByCurrency format
function processRevenueDetails(revenueDetails: RevenueDetails): { revenueByCurrency: RevenueByCurrency; totalRevenue: number } {
    if (!revenueDetails || !Array.isArray(revenueDetails)) {
        return { revenueByCurrency: {}, totalRevenue: 0 };
    }

    let revenueByCurrency: RevenueByCurrency = {};
    let totalRevenue = 0;

    revenueDetails.forEach((detail) => {
        if (detail && detail.currency && detail.decimals !== undefined && detail.amount_raw) {
            // Add to multi-currency tracking
            revenueByCurrency = addRevenueToCurrency(
                revenueByCurrency,
                detail.currency,
                detail.decimals,
                detail.amount_raw
            );

            // Add to simple total for backward compatibility (approximate)
            try {
                const humanAmount = parseFloat(fromBaseUnits(detail.amount_raw, detail.decimals));
                totalRevenue += humanAmount;
            } catch (error) {
                // If conversion fails, add raw amount (not ideal but prevents errors)
                totalRevenue += parseFloat(detail.amount_raw) || 0;
                console.error('Error converting revenue amount:', error);
            }
        }
    });

    return { revenueByCurrency, totalRevenue };
}



// Enhanced transaction helper with better typing
export const withTransaction = async <T>(callback: (tx: TransactionType) => Promise<T>): Promise<T> => {
    return await db.transaction(async (tx) => {
        return await callback(tx);
    });
};

// Reusable transaction operations
export const txOperations = {
    // MCP Servers
    createServer: (data: {
        serverId: string;
        mcpOrigin: string;
        creatorId?: string;
        receiverAddress: string;
        requireAuth?: boolean;
        authHeaders?: Record<string, unknown>;
        description?: string;
        name?: string;
        metadata?: Record<string, unknown>;
    }) => async (tx: TransactionType) => {
        const server = await tx.insert(mcpServers).values({
            serverId: data.serverId,
            name: data.name,
            mcpOrigin: data.mcpOrigin,
            creatorId: data.creatorId,
            receiverAddress: data.receiverAddress,
            requireAuth: data.requireAuth,
            authHeaders: data.authHeaders,
            description: data.description,
            metadata: data.metadata,
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning();

        if (!server[0]) throw new Error("Failed to create server");
        return server[0];
    },

    // Upsert server by origin - truly atomic operation using Drizzle's onConflictDoUpdate
    upsertServerByOrigin: (data: {
        serverId: string;
        mcpOrigin: string;
        creatorId: string;
        receiverAddress: string;
        requireAuth?: boolean;
        authHeaders?: Record<string, unknown>;
        description?: string;
        name?: string;
        metadata?: Record<string, unknown>;
    }) => async (tx: TransactionType) => {
        const now = new Date();
        
        // Atomic upsert: insert if not exists, update if exists (but only if same owner)
        const result = await tx.insert(mcpServers)
            .values({
                serverId: data.serverId,
                name: data.name,
                mcpOrigin: data.mcpOrigin,
                creatorId: data.creatorId,
                receiverAddress: data.receiverAddress,
                requireAuth: data.requireAuth,
                authHeaders: data.authHeaders,
                description: data.description,
                metadata: data.metadata,
                createdAt: now,
                updatedAt: now
            })
            .onConflictDoUpdate({
                target: mcpServers.mcpOrigin,
                // Only update if the creator is the same (ownership check)
                where: eq(mcpServers.creatorId, data.creatorId),
                set: {
                    name: data.name,
                    description: data.description,
                    receiverAddress: data.receiverAddress,
                    requireAuth: data.requireAuth,
                    authHeaders: data.authHeaders,
                    metadata: data.metadata,
                    updatedAt: now
                    // Note: we don't update serverId, mcpOrigin, creatorId, or createdAt
                }
            })
            .returning();

        // Check if the operation succeeded
        if (result.length === 0) {
            // This can happen if conflict occurred but ownership check failed
            // Fetch the existing server to provide a proper error message
            const existingServer = await tx.query.mcpServers.findFirst({
                where: eq(mcpServers.mcpOrigin, data.mcpOrigin),
                columns: { creatorId: true }
            });

            if (existingServer && existingServer.creatorId !== data.creatorId) {
                throw new Error('Server already exists and is owned by another user');
            }

            throw new Error('Failed to upsert server - unknown error');
        }

        // Determine if this was an insert (new) or update (existing)
        // If createdAt equals updatedAt, it was an insert; otherwise it was an update
        const server = result[0];
        const isNew = server.createdAt.getTime() === server.updatedAt.getTime();

        return {
            server,
            isNew
        };
    },

    updateServer: (serverId: string, data: {
        name?: string;
        description?: string;
        requireAuth?: boolean;
        authHeaders?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
        status?: string;
    }) => async (tx: TransactionType) => {
        const server = await tx.update(mcpServers)
            .set({
                ...data,
                updatedAt: new Date()
            })
            .where(eq(mcpServers.id, serverId))
            .returning();

        if (!server[0]) throw new Error(`Server with ID ${serverId} not found`);
        return server[0];
    },

    updateServerFromPing: (serverId: string, data: {
        name?: string;
        description?: string;
        metadata?: Record<string, unknown>;
        toolsData: Array<{
            name: string;
            description: string;
            inputSchema: Record<string, unknown>;
            pricing?: PricingEntry[];
        }>;
    }) => async (tx: TransactionType) => {
        // Update server metadata
        const server = await tx.update(mcpServers)
            .set({
                name: data.name,
                description: data.description,
                metadata: {
                    ...data.metadata,
                    lastPing: new Date().toISOString(),
                    toolsCount: data.toolsData.length,
                    monetizedToolsCount: data.toolsData.filter(t => t.pricing).length
                },
                updatedAt: new Date()
            })
            .where(eq(mcpServers.id, serverId))
            .returning();

        if (!server[0]) throw new Error(`Server with ID ${serverId} not found`);

        // Get existing tools for this server
        const existingTools = await tx.query.mcpTools.findMany({
            where: eq(mcpTools.serverId, serverId),
        });

        // Track which tools are still present on the server
        const currentToolNames = new Set(data.toolsData.map(tool => tool.name));
        const processedToolIds = new Set<string>();

        // Update or create tools
        const toolResults = [];
        for (const toolData of data.toolsData) {
            const existingTool = existingTools.find(t => t.name === toolData.name);
            
            if (existingTool) {
                // Mark this tool as processed
                processedToolIds.add(existingTool.id);
                
                const existingPricing = (existingTool.pricing as PricingEntry[]) || [];
                
                // Smart pricing merge: remove duplicate entries and keep only unique combinations
                let mergedPricing = [...existingPricing];
                
                if (toolData.pricing && toolData.pricing.length > 0) {
                    // For each new pricing entry, remove any existing duplicates
                    for (const newPricing of toolData.pricing) {
                        // Remove existing entries with same network, assetAddress, tokenDecimals, and maxAmountRequiredRaw
                        mergedPricing = mergedPricing.filter(existing => {
                            const isDuplicate = existing.network === newPricing.network && 
                                              existing.assetAddress === newPricing.assetAddress &&
                                              existing.tokenDecimals === newPricing.tokenDecimals &&
                                              existing.maxAmountRequiredRaw === newPricing.maxAmountRequiredRaw;
                            return !isDuplicate; // Keep only non-duplicates
                        });
                    }
                    
                    // Add new pricing entries (they should be active by default)
                    mergedPricing = [...mergedPricing, ...toolData.pricing];
                }
                
                const updatedTool = await tx.update(mcpTools)
                    .set({
                        description: toolData.description,
                        inputSchema: toolData.inputSchema,
                        isMonetized: !!(mergedPricing && mergedPricing.some((p: PricingEntry) => p.active === true)),
                        pricing: mergedPricing,
                        updatedAt: new Date()
                    })
                    .where(eq(mcpTools.id, existingTool.id))
                    .returning();
                
                toolResults.push(updatedTool[0]);
            } else {
                // Create new tool
                const newTool = await tx.insert(mcpTools).values({
                    serverId: serverId,
                    name: toolData.name,
                    description: toolData.description,
                    inputSchema: toolData.inputSchema,
                    isMonetized: !!toolData.pricing && toolData.pricing.some((p: PricingEntry) => p.active === true),
                    pricing: toolData.pricing,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }).returning();
                toolResults.push(newTool[0]);
            }
        }

        // Remove tools that no longer exist on the server
        const toolsToRemove = existingTools.filter(tool => !currentToolNames.has(tool.name));
        if (toolsToRemove.length > 0) {
            console.log(`Removing ${toolsToRemove.length} tools that no longer exist on server:`, toolsToRemove.map(t => t.name));
            
            for (const toolToRemove of toolsToRemove) {
                await tx.delete(mcpTools)
                    .where(eq(mcpTools.id, toolToRemove.id));
            }
        }

        return {
            server: server[0],
            tools: toolResults
        };
    },

    getMcpServer: (id: string) => async (tx: TransactionType) => {
        return await tx.query.mcpServers.findFirst({
            where: eq(mcpServers.id, id),
            columns: {
                id: true,
                serverId: true,
                name: true,
                receiverAddress: true,
                description: true,
                metadata: true,
                status: true,
                createdAt: true,
                updatedAt: true
            }
        });
    },

    internal_getMcpServerByServerId: (serverId: string) => async (tx: TransactionType) => {
        return await tx.query.mcpServers.findFirst({
            where: eq(mcpServers.serverId, serverId),
            columns: {
                id: true,
                serverId: true,
                mcpOrigin: true,
                creatorId: true,
                receiverAddress: true,
                requireAuth: true,
                authHeaders: true,
                description: true,
                name: true,
                metadata: true,
                status: true,
                createdAt: true,
                updatedAt: true
            }
        });
    },

    getMcpServerByOrigin: (mcpOrigin: string) => async (tx: TransactionType) => {
        return await tx.query.mcpServers.findFirst({
            where: eq(mcpServers.mcpOrigin, mcpOrigin),
            columns: {
                id: true,
                serverId: true,
                mcpOrigin: true,
                creatorId: true,
                receiverAddress: true,
                requireAuth: true,
                authHeaders: true,
                description: true,
                name: true,
                metadata: true,
                status: true,
                createdAt: true,
                updatedAt: true
            },
            with: {
                creator: {
                    columns: {
                        id: true,
                        walletAddress: true,
                        displayName: true,
                        avatarUrl: true
                    }
                },
                tools: {
                    columns: {
                        id: true,
                        name: true,
                        description: true,
                        inputSchema: true,
                        isMonetized: true,
                        pricing: true,
                        status: true,
                        metadata: true,
                        createdAt: true,
                        updatedAt: true
                    }
                }
            }
        });
    },

    getMcpServerByServerId: (serverId: string) => async (tx: TransactionType) => {
        return await tx.query.mcpServers.findFirst({
            where: eq(mcpServers.serverId, serverId),
            columns: {
                id: true,
                serverId: true,
                name: true,
                mcpOrigin: false,
                receiverAddress: true,
                description: true,
                metadata: true,
                status: true,
                createdAt: true,
                updatedAt: true
            },
            with: {
                creator: {
                    columns: {
                        id: true,
                        walletAddress: true,
                        displayName: true,
                        avatarUrl: true
                    }
                },
                tools: {
                    columns: {
                        id: true,
                        name: true,
                        description: true,
                        inputSchema: true,
                        isMonetized: true,
                        pricing: true,
                        status: true,
                        metadata: true,
                        createdAt: true,
                        updatedAt: true
                    },
                    with: {
                        // pricing relation removed - pricing data now in payment jsonb field
                        payments: {
                            columns: {
                                id: true,
                                amountRaw: true,
                                tokenDecimals: true,
                                currency: true,
                                network: true,
                                status: true,
                                createdAt: true,
                                settledAt: true
                            },
                            with: {
                                user: {
                                    columns: {
                                        id: true,
                                        walletAddress: true,
                                        displayName: true
                                    }
                                }
                            },
                            orderBy: [desc(payments.createdAt)],
                            limit: 10
                        },
                        usage: {
                            columns: {
                                id: true,
                                timestamp: true,
                                responseStatus: true,
                                executionTimeMs: true,
                                result: false
                            },
                            with: {
                                user: {
                                    columns: {
                                        id: true,
                                        walletAddress: true,
                                        displayName: true
                                    }
                                }
                            },
                            orderBy: [desc(toolUsage.timestamp)],
                            limit: 10
                        },
                        proofs: {
                            columns: {
                                id: true,
                                isConsistent: true,
                                confidenceScore: true,
                                status: true,
                                verificationType: true,
                                createdAt: true,
                                webProofPresentation: true
                            },
                            with: {
                                user: {
                                    columns: {
                                        id: true,
                                        walletAddress: true,
                                        displayName: true
                                    }
                                }
                            },
                            orderBy: [desc(proofs.createdAt)],
                            limit: 10
                        }
                    },
                    orderBy: [mcpTools.name]
                },
                // Analytics will be computed from views, not included in main query
                ownership: {
                    where: eq(serverOwnership.active, true),
                    columns: {
                        id: true,
                        role: true,
                        createdAt: true,
                        active: true
                    },
                    with: {
                        user: {
                            columns: {
                                id: true,
                                walletAddress: true,
                                displayName: true,
                                avatarUrl: true
                            }
                        },
                        grantedByUser: {
                            columns: {
                                id: true,
                                walletAddress: true,
                                displayName: true
                            }
                        }
                    }
                },
                webhooks: {
                    where: eq(webhooks.active, true),
                    columns: {
                        id: true,
                        url: true,
                        events: true,
                        active: true,
                        lastTriggeredAt: true,
                        failureCount: true,
                        createdAt: true,
                        updatedAt: true
                    }
                },
                proofs: {
                    columns: {
                        id: true,
                        isConsistent: true,
                        confidenceScore: true,
                        status: true,
                        verificationType: true,
                        createdAt: true,
                        webProofPresentation: true
                    },
                    with: {
                        tool: {
                            columns: {
                                id: true,
                                name: true
                            }
                        },
                        user: {
                            columns: {
                                id: true,
                                walletAddress: true,
                                displayName: true
                            }
                        }
                    },
                    orderBy: [desc(proofs.createdAt)],
                    limit: 20
                }
            }
        });
    },

    listMcpServers: (limit = 10, offset = 0) => async (tx: TransactionType) => {
        return await tx.query.mcpServers.findMany({
            limit,
            offset,
            orderBy: [desc(mcpServers.createdAt)],
            columns: {
                id: true,
                serverId: true,
                name: true,
                receiverAddress: true,
                description: true,
                metadata: true,
                status: true,
                createdAt: true,
                updatedAt: true
            },
            with: {
                tools: {
                    columns: {
                        id: true,
                        name: true,
                        description: true,
                        inputSchema: true,
                        isMonetized: true,
                        pricing: true,
                        status: true,
                        createdAt: true,
                        updatedAt: true
                    },
                    orderBy: [mcpTools.name]
                }
            }
        });
    },

    listMcpServersByActivity: (limit = 10, offset = 0) => async (tx: TransactionType) => {
        // Get all servers with their related activity data
        const servers = await tx.query.mcpServers.findMany({
            columns: {
                id: true,
                serverId: true,
                name: true,
                receiverAddress: true,
                description: true,
                metadata: true,
                status: true,
                createdAt: true,
                updatedAt: true
            },
            with: {
                creator: {
                    columns: {
                        id: true,
                        walletAddress: true,
                        displayName: true,
                        avatarUrl: true
                    }
                },
                tools: {
                    columns: {
                        id: true,
                        name: true,
                        description: true,
                        inputSchema: true,
                        isMonetized: true,
                        pricing: true,
                        status: true,
                        createdAt: true,
                        updatedAt: true
                    },
                    with: {
                        payments: {
                            where: eq(payments.status, 'completed'),
                            columns: {
                                id: true,
                                amountRaw: true,
                                tokenDecimals: true,
                                currency: true,
                                userId: true,
                                createdAt: true
                            }
                        },
                        usage: {
                            columns: {
                                id: true,
                                userId: true,
                                timestamp: true,
                                responseStatus: true
                            }
                        }
                    },
                    orderBy: [mcpTools.name]
                }
            }
        });

        // Calculate activity metrics for each server
        const serversWithActivity = servers.map(server => {
            const allPayments = server.tools.flatMap(tool => tool.payments);
            const allUsage = server.tools.flatMap(tool => tool.usage);
            
            // Calculate metrics
            const totalPayments = allPayments.length;
            const totalRevenue = allPayments.reduce((sum, payment) => 
                sum + parseFloat(payment.amountRaw), 0
            );
            const totalUsage = allUsage.length;
            const successfulUsage = allUsage.filter(usage => 
                usage.responseStatus === 'success' || usage.responseStatus === '200'
            ).length;
            
            // Get unique users from both payments and usage
            const paymentUserIds = allPayments
                .map(p => p.userId)
                .filter(Boolean);
            const usageUserIds = allUsage
                .map(u => u.userId)
                .filter(Boolean);
            const uniqueUsers = new Set([...paymentUserIds, ...usageUserIds]).size;
            
            // Calculate recent activity (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const recentPayments = allPayments.filter(p => 
                new Date(p.createdAt) > thirtyDaysAgo
            ).length;
            const recentUsage = allUsage.filter(u => 
                new Date(u.timestamp) > thirtyDaysAgo
            ).length;
            
            // Calculate activity score (weighted combination of metrics)
            const activityScore = (
                totalPayments * 10 +        // High weight for payments
                totalRevenue * 0.1 +        // Revenue impact (assuming small amounts)
                totalUsage * 2 +            // Medium weight for usage
                uniqueUsers * 15 +          // High weight for unique users
                recentPayments * 20 +       // Higher weight for recent payments
                recentUsage * 5 +           // Medium weight for recent usage
                successfulUsage * 1         // Small bonus for successful usage
            );

            return {
                ...server,
                activityMetrics: {
                    totalPayments,
                    totalRevenue,
                    totalUsage,
                    uniqueUsers,
                    recentPayments,
                    recentUsage,
                    successfulUsage,
                    activityScore
                }
            };
        });

        // Sort by activity score (descending) and apply pagination
        const sortedServers = serversWithActivity
            .sort((a, b) => b.activityMetrics.activityScore - a.activityMetrics.activityScore)
            .slice(offset, offset + limit);

        return sortedServers;
    },

    updateMcpServer: (id: string, data: {
        url?: string;
        mcpOrigin?: string;
        receiverAddress?: string;
        requireAuth?: boolean;
        authHeaders?: Record<string, unknown>;
        status?: string;
        description?: string;
        name?: string;
        metadata?: Record<string, unknown>;
    }) => async (tx: TransactionType) => {
        const result = await tx.update(mcpServers)
            .set({
                ...data,
                updatedAt: new Date()
            })
            .where(eq(mcpServers.id, id))
            .returning();

        if (!result[0]) throw new Error(`MCP Server with ID ${id} not found`);
        return result[0];
    },

    deleteMcpServer: (id: string) => async (tx: TransactionType) => {
        const result = await tx.delete(mcpServers)
            .where(eq(mcpServers.id, id))
            .returning();

        if (!result[0]) throw new Error(`MCP Server with ID ${id} not found`);
        return result[0];
    },

    // MCP Tools
    createTool: (data: {
        serverId: string;
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
        outputSchema: Record<string, unknown>;
        isMonetized?: boolean;
        pricing?: PricingEntry[];
        status?: string;
        metadata?: Record<string, unknown>;
    }) => async (tx: TransactionType) => {
        const tool = await tx.insert(mcpTools).values({
            serverId: data.serverId,
            name: data.name,
            description: data.description,
            inputSchema: data.inputSchema,
            outputSchema: data.outputSchema,
            isMonetized: data.isMonetized,
            pricing: data.pricing,
            status: data.status,
            metadata: data.metadata,
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning();

        if (!tool[0]) throw new Error("Failed to create tool");
        return tool[0];
    },

    getMcpTool: (id: string) => async (tx: TransactionType) => {
        return await tx.query.mcpTools.findFirst({
            where: eq(mcpTools.id, id)
        });
    },

    listMcpToolsByServer: (serverId: string) => async (tx: TransactionType) => {
        return await tx.query.mcpTools.findMany({
            where: eq(mcpTools.serverId, serverId),
            orderBy: [mcpTools.name]
        });
    },

    updateTool: (toolId: string, data: {
        name?: string;
        description?: string;
        inputSchema?: Record<string, unknown>;
        isMonetized?: boolean;
        pricing?: PricingEntry[];
        status?: string;
        metadata?: Record<string, unknown>;
    }) => async (tx: TransactionType) => {
        // Get existing tool to preserve pricing data
        const existingTool = await tx.query.mcpTools.findFirst({
            where: eq(mcpTools.id, toolId)
        });

        if (!existingTool) {
            throw new Error(`Tool with ID ${toolId} not found`);
        }

        // Preserve existing pricing data when updating pricing field
        const existingPricing = (existingTool.pricing as PricingEntry[]) || [];
        const mergedPricing = data.pricing !== undefined ? data.pricing : existingPricing;
        const isMonetized = data.isMonetized !== undefined ? data.isMonetized : !!(existingPricing.filter((p: PricingEntry) => p.active === true).length > 0);

        const tool = await tx.update(mcpTools)
            .set({
                name: data.name,
                description: data.description,
                inputSchema: data.inputSchema,
                isMonetized: isMonetized,
                pricing: mergedPricing,
                status: data.status,
                metadata: data.metadata,
                updatedAt: new Date()
            })
            .where(eq(mcpTools.id, toolId))
            .returning();

        if (!tool[0]) throw new Error(`Tool with ID ${toolId} not found`);
        return tool[0];
    },

    deleteMcpTool: (id: string) => async (tx: TransactionType) => {
        const result = await tx.delete(mcpTools)
            .where(eq(mcpTools.id, id))
            .returning();

        if (!result[0]) throw new Error(`Tool with ID ${id} not found`);
        return result[0];
    },

    // Users
    getUserByWalletAddress: (walletAddress: string) => async (tx: TransactionType) => {
        return await tx.query.users.findFirst({
            where: eq(users.walletAddress, walletAddress)
        });
    },

    getUserById: (id: string) => async (tx: TransactionType) => {
        return await tx.query.users.findFirst({
            where: eq(users.id, id)
        });
    },

    createUser: (data: {
        walletAddress?: string;
        name?: string;
        email?: string;
        emailVerified?: boolean;
        image?: string;
        displayName?: string;
        avatarUrl?: string;
        // New wallet-specific options (for initial wallet)
        walletType?: 'external' | 'managed' | 'custodial';
        walletProvider?: string;
        blockchain?: string; // 'ethereum', 'solana', 'near', etc.
        architecture?: BlockchainArchitecture; // 'evm', 'solana', 'near', 'cosmos', 'bitcoin'
        walletMetadata?: Record<string, unknown>; // Blockchain-specific data
        externalWalletId?: string; // For managed services
        externalUserId?: string; // User ID in external system
    }) => async (tx: TransactionType) => {
        // Ensure user has at least one identifier (wallet or email)
        if (!data.walletAddress && !data.email) {
            throw new Error("User must have either a wallet address or email address");
        }

        // Create user first
        const result = await tx.insert(users).values({
            walletAddress: data.walletAddress, // Keep for legacy compatibility
            name: data.name,
            email: data.email,
            emailVerified: data.emailVerified,
            image: data.image,
            displayName: data.displayName,
            avatarUrl: data.avatarUrl,
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning();

        if (!result[0]) throw new Error("Failed to create user");
        
        const user = result[0];

        // If wallet address provided, add it to the new wallet system
        if (data.walletAddress) {
            // Determine architecture if not provided
            const architecture = data.architecture || getBlockchainArchitecture(data.blockchain);
            
            await txOperations.addWalletToUser({
                userId: user.id,
                walletAddress: data.walletAddress,
                walletType: data.walletType || 'external',
                provider: data.walletProvider || 'unknown',
                blockchain: data.blockchain,
                architecture,
                isPrimary: true, // First wallet is always primary
                walletMetadata: data.walletMetadata,
                externalWalletId: data.externalWalletId,
                externalUserId: data.externalUserId
            })(tx);
        }

        return user;
    },

    updateUserLastLogin: (id: string) => async (tx: TransactionType) => {
        const now = new Date();

        const result = await tx.update(users)
            .set({
                lastLoginAt: now,
                updatedAt: now
            })
            .where(eq(users.id, id))
            .returning();

        if (!result[0]) throw new Error(`User with ID ${id} not found`);
        return result[0];
    },

    getUserByEmail: (email: string) => async (tx: TransactionType) => {
        return await tx.query.users.findFirst({
            where: eq(users.email, email)
        });
    },

    getUserByEmailOrWallet: (identifier: string) => async (tx: TransactionType) => {
        // Try to find user by email first, then by wallet address (including both legacy and new wallet tables)
        const userByEmail = await tx.query.users.findFirst({
            where: eq(users.email, identifier)
        });
        
        if (userByEmail) return userByEmail;

        // Check legacy wallet field
        const userByLegacyWallet = await tx.query.users.findFirst({
            where: eq(users.walletAddress, identifier)
        });
        
        if (userByLegacyWallet) return userByLegacyWallet;

        // Check new user_wallets table
        const walletRecord = await tx.query.userWallets.findFirst({
            where: eq(userWallets.walletAddress, identifier),
            with: {
                user: true
            }
        });
        
        return walletRecord?.user || null;
    },

    // Multi-Wallet Management Operations
    addWalletToUser: (data: {
        userId: string;
        walletAddress: string;
        walletType: 'external' | 'managed' | 'custodial';
        provider?: string;
        blockchain?: string; // 'ethereum', 'solana', 'near', 'polygon', 'base', etc.
        architecture?: BlockchainArchitecture; // 'evm', 'solana', 'near', 'cosmos', 'bitcoin'
        isPrimary?: boolean;
        walletMetadata?: Record<string, unknown>; // Blockchain-specific data like chainId, ensName, etc.
        externalWalletId?: string; // For managed services like Coinbase CDP, Privy
        externalUserId?: string; // User ID in external system
    }) => async (tx: TransactionType) => {
        // Check if this exact combination already exists
        const existingWallet = await tx.query.userWallets.findFirst({
            where: and(
                eq(userWallets.userId, data.userId),
                eq(userWallets.walletAddress, data.walletAddress),
                data.provider ? eq(userWallets.provider, data.provider) : isNull(userWallets.provider),
                eq(userWallets.walletType, data.walletType)
            )
        });

        if (existingWallet) {
            // If wallet exists but is inactive, reactivate it
            if (!existingWallet.isActive) {
                const updatedWallet = await tx.update(userWallets)
                    .set({
                        isActive: true,
                        isPrimary: data.isPrimary || existingWallet.isPrimary,
                        blockchain: data.blockchain || existingWallet.blockchain,
                        architecture: data.architecture || existingWallet.architecture,
                        walletMetadata: data.walletMetadata || existingWallet.walletMetadata,
                        externalWalletId: data.externalWalletId || existingWallet.externalWalletId,
                        externalUserId: data.externalUserId || existingWallet.externalUserId,
                        updatedAt: new Date(),
                        lastUsedAt: new Date()
                    })
                    .where(eq(userWallets.id, existingWallet.id))
                    .returning();
                
                return updatedWallet[0];
            }
            
            // If wallet is active, update it with new data and return it
            const updatedWallet = await tx.update(userWallets)
                .set({
                    isPrimary: data.isPrimary !== undefined ? data.isPrimary : existingWallet.isPrimary,
                    blockchain: data.blockchain || existingWallet.blockchain,
                    architecture: data.architecture || existingWallet.architecture,
                    walletMetadata: data.walletMetadata || existingWallet.walletMetadata,
                    externalWalletId: data.externalWalletId || existingWallet.externalWalletId,
                    externalUserId: data.externalUserId || existingWallet.externalUserId,
                    updatedAt: new Date(),
                    lastUsedAt: new Date()
                })
                .where(eq(userWallets.id, existingWallet.id))
                .returning();
            
            return updatedWallet[0];
        }

        // If this is set as primary, unset any existing primary wallet
        if (data.isPrimary) {
            await tx.update(userWallets)
                .set({ isPrimary: false, updatedAt: new Date() })
                .where(and(
                    eq(userWallets.userId, data.userId),
                    eq(userWallets.isPrimary, true)
                ));
        }

        // Determine architecture if not provided
        const architecture = data.architecture || getBlockchainArchitecture(data.blockchain);

        // Create new wallet record (race-safe on primary uniqueness)
        try {
            const result = await tx.insert(userWallets).values({
                userId: data.userId,
                walletAddress: data.walletAddress,
                walletType: data.walletType,
                provider: data.provider,
                blockchain: data.blockchain,
                architecture,
                isPrimary: data.isPrimary || false,
                walletMetadata: data.walletMetadata,
                externalWalletId: data.externalWalletId,
                externalUserId: data.externalUserId,
                createdAt: new Date(),
                updatedAt: new Date()
            }).returning();

            if (!result[0]) throw new Error("Failed to add wallet to user");
            return result[0];
        } catch (e: unknown) {
            const err = e as { code?: string; constraint?: string; message?: string };
            const isPrimaryUnique = err?.code === '23505' && (err?.constraint?.includes('user_wallets_primary_unique') || err?.message?.includes('user_wallets_primary_unique'));
            if (!isPrimaryUnique) throw e;

            // Another concurrent insert won the primary race. Retry insert as non-primary.
            const retry = await tx.insert(userWallets).values({
                userId: data.userId,
                walletAddress: data.walletAddress,
                walletType: data.walletType,
                provider: data.provider,
                blockchain: data.blockchain,
                architecture,
                isPrimary: false,
                walletMetadata: data.walletMetadata,
                externalWalletId: data.externalWalletId,
                externalUserId: data.externalUserId,
                createdAt: new Date(),
                updatedAt: new Date()
            }).returning();

            if (!retry[0]) throw new Error("Failed to add wallet to user after primary conflict");
            return retry[0];
        }
    },

    getUserWallets: (userId: string, activeOnly = true) => async (tx: TransactionType) => {
        const conditions = [eq(userWallets.userId, userId)];
        if (activeOnly) {
            conditions.push(eq(userWallets.isActive, true));
        }

        return await tx.query.userWallets.findMany({
            where: and(...conditions),
            orderBy: [desc(userWallets.isPrimary), desc(userWallets.createdAt)]
        });
    },

    getUserPrimaryWallet: (userId: string) => async (tx: TransactionType) => {
        return await tx.query.userWallets.findFirst({
            where: and(
                eq(userWallets.userId, userId),
                eq(userWallets.isPrimary, true),
                eq(userWallets.isActive, true)
            )
        });
    },

    getWalletByAddress: (walletAddress: string) => async (tx: TransactionType) => {
        return await tx.query.userWallets.findFirst({
            where: eq(userWallets.walletAddress, walletAddress),
            with: {
                user: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                        displayName: true,
                        avatarUrl: true,
                        image: true
                    }
                }
            }
        });
    },

    setPrimaryWallet: (userId: string, walletId: string) => async (tx: TransactionType) => {
        // First, verify the wallet belongs to the user
        const wallet = await tx.query.userWallets.findFirst({
            where: and(
                eq(userWallets.id, walletId),
                eq(userWallets.userId, userId),
                eq(userWallets.isActive, true)
            )
        });

        if (!wallet) {
            throw new Error("Wallet not found or doesn't belong to user");
        }

        // Unset existing primary wallet
        await tx.update(userWallets)
            .set({ isPrimary: false, updatedAt: new Date() })
            .where(and(
                eq(userWallets.userId, userId),
                eq(userWallets.isPrimary, true)
            ));

        // Set new primary wallet
        const result = await tx.update(userWallets)
            .set({ isPrimary: true, updatedAt: new Date() })
            .where(eq(userWallets.id, walletId))
            .returning();

        return result[0];
    },

    removeWallet: (userId: string, walletId: string) => async (tx: TransactionType) => {
        // Verify wallet belongs to user
        const wallet = await tx.query.userWallets.findFirst({
            where: and(
                eq(userWallets.id, walletId),
                eq(userWallets.userId, userId)
            )
        });

        if (!wallet) {
            throw new Error("Wallet not found or doesn't belong to user");
        }

        // Don't allow removing the last wallet
        const userWalletCount = await tx.query.userWallets.findMany({
            where: and(
                eq(userWallets.userId, userId),
                eq(userWallets.isActive, true)
            )
        });

        if (userWalletCount.length <= 1) {
            throw new Error("Cannot remove the last wallet from a user");
        }

        // Mark as inactive instead of deleting (for audit trail)
        const result = await tx.update(userWallets)
            .set({ 
                isActive: false, 
                isPrimary: false,
                updatedAt: new Date() 
            })
            .where(eq(userWallets.id, walletId))
            .returning();

        // If this was the primary wallet, set another one as primary
        if (wallet.isPrimary) {
            const remainingWallets = await tx.query.userWallets.findMany({
                where: and(
                    eq(userWallets.userId, userId),
                    eq(userWallets.isActive, true)
                ),
                orderBy: [desc(userWallets.createdAt)],
                limit: 1
            });

            if (remainingWallets[0]) {
                await tx.update(userWallets)
                    .set({ isPrimary: true, updatedAt: new Date() })
                    .where(eq(userWallets.id, remainingWallets[0].id));
            }
        }

        return result[0];
    },

    updateWalletMetadata: (walletId: string, metadata: {
        walletMetadata?: Record<string, unknown>; // All blockchain-specific data goes here
        lastUsedAt?: Date;
    }) => async (tx: TransactionType) => {
        const result = await tx.update(userWallets)
            .set({
                ...metadata,
                updatedAt: new Date()
            })
            .where(eq(userWallets.id, walletId))
            .returning();

        if (!result[0]) throw new Error(`Wallet with ID ${walletId} not found`);
        return result[0];
    },

    // Create managed wallet for user (via external services like Coinbase CDP, Privy)
    createManagedWallet: (userId: string, data: {
        walletAddress: string;
        provider: string; // 'coinbase-cdp', 'privy', 'magic', etc.
        blockchain?: string; // 'ethereum', 'solana', 'near', etc.
        architecture?: BlockchainArchitecture; // 'evm', 'solana', 'near', 'cosmos', 'bitcoin'
        externalWalletId: string; // Reference ID from external service
        externalUserId?: string; // User ID in external system
        isPrimary?: boolean;
        walletMetadata?: Record<string, unknown>;
    }) => async (tx: TransactionType) => {
        // Determine architecture if not provided
        const architecture = data.architecture || getBlockchainArchitecture(data.blockchain);
        
        return await txOperations.addWalletToUser({
            userId,
            walletAddress: data.walletAddress,
            walletType: 'managed',
            provider: data.provider,
            blockchain: data.blockchain,
            architecture,
            isPrimary: data.isPrimary,
            externalWalletId: data.externalWalletId,
            externalUserId: data.externalUserId,
            walletMetadata: {
                ...data.walletMetadata,
                type: 'managed',
                createdByService: true,
                provider: data.provider
            }
        })(tx);
    },

    // CDP-specific operations
    createCDPManagedWallet: (userId: string, data: {
        walletAddress: string;
        accountId: string; // CDP account ID/name
        accountName: string;
        network: string; // CDP network (base, base-sepolia, etc.)
        isSmartAccount?: boolean;
        ownerAccountId?: string; // For smart accounts
        isPrimary?: boolean;
    }) => async (tx: TransactionType) => {
        // Determine blockchain and architecture for CDP wallets
        const blockchain = data.network.includes('base') ? 'base' : 'ethereum';
        const architecture = getBlockchainArchitecture(blockchain);
        
        return await txOperations.addWalletToUser({
            userId,
            walletAddress: data.walletAddress,
            walletType: 'managed',
            provider: 'coinbase-cdp',
            blockchain,
            architecture,
            isPrimary: data.isPrimary,
            externalWalletId: data.accountId,
            externalUserId: userId,
            walletMetadata: {
                cdpAccountId: data.accountId,
                cdpAccountName: data.accountName,
                cdpNetwork: data.network,
                isSmartAccount: data.isSmartAccount || false,
                ownerAccountId: data.ownerAccountId,
                provider: 'coinbase-cdp',
                type: 'managed',
                createdByService: true,
                managedBy: 'coinbase-cdp',
                gasSponsored: data.isSmartAccount && (data.network === 'base' || data.network === 'base-sepolia'),
            }
        })(tx);
    },

    getCDPWalletsByUser: (userId: string) => async (tx: TransactionType) => {
        return await tx.query.userWallets.findMany({
            where: and(
                eq(userWallets.userId, userId),
                eq(userWallets.provider, 'coinbase-cdp'),
                eq(userWallets.isActive, true)
            ),
            orderBy: [desc(userWallets.isPrimary), desc(userWallets.createdAt)]
        });
    },

    getCDPWalletByAccountId: (accountId: string) => async (tx: TransactionType) => {
        return await tx.query.userWallets.findFirst({
            where: and(
                eq(userWallets.externalWalletId, accountId),
                eq(userWallets.provider, 'coinbase-cdp'),
                eq(userWallets.isActive, true)
            ),
            with: {
                user: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                        displayName: true,
                        avatarUrl: true,
                        image: true
                    }
                }
            }
        });
    },

    updateCDPWalletMetadata: (walletId: string, metadata: {
        cdpAccountName?: string;
        cdpNetwork?: string;
        lastUsedAt?: Date;
        balanceCache?: Record<string, unknown>;
        transactionHistory?: Record<string, unknown>[];
    }) => async (tx: TransactionType) => {
        const wallet = await tx.query.userWallets.findFirst({
            where: eq(userWallets.id, walletId)
        });

        if (!wallet || wallet.provider !== 'coinbase-cdp') {
            throw new Error('CDP wallet not found');
        }

        const updatedMetadata = {
            ...wallet.walletMetadata as Record<string, unknown>,
            ...metadata,
            lastUpdated: new Date().toISOString()
        };

        return await tx.update(userWallets)
            .set({
                walletMetadata: updatedMetadata,
                updatedAt: new Date(),
                ...(metadata.lastUsedAt && { lastUsedAt: metadata.lastUsedAt })
            })
            .where(eq(userWallets.id, walletId))
            .returning();
    },

    // Helper to check if user has any CDP wallets
    userHasCDPWallets: (userId: string) => async (tx: TransactionType) => {
        const cdpWallets = await tx.query.userWallets.findMany({
            where: and(
                eq(userWallets.userId, userId),
                eq(userWallets.provider, 'coinbase-cdp'),
                eq(userWallets.isActive, true)
            ),
            limit: 1 // Just need to know if any exist
        });

        return cdpWallets.length > 0;
    },

    // Auto-create CDP wallet for new users
    autoCreateCDPWalletForUser: (userId: string, userInfo: {
        email?: string;
        name?: string;
        displayName?: string;
    }, options?: {
        createSmartAccount?: boolean;
        network?: CDPNetwork;
    }) => async (tx: TransactionType) => {
        console.log(`[DEBUG] Starting CDP wallet auto-creation for user ${userId}`);
        
        // Extract options with defaults
        const createSmartAccount = options?.createSmartAccount ?? false; // Default to true for backward compatibility
        const network = options?.network ?? 'base-sepolia';
        
        console.log(`[DEBUG] Options - createSmartAccount: ${createSmartAccount}, network: ${network}`);
        
        try {
            // Check if user already has CDP wallets
            console.log(`[DEBUG] Checking if user ${userId} already has CDP wallets`);
            const hasCDPWallets = await txOperations.userHasCDPWallets(userId)(tx);
            console.log(`[DEBUG] User ${userId} has CDP wallets:`, hasCDPWallets);
            
            if (hasCDPWallets) {
                console.log(`User ${userId} already has CDP wallets, skipping auto-creation`);
                return null;
            }

            // Generate account name based on user info (max 28 chars to allow for "-smart" suffix)
            // CDP requires names to be 2-36 characters, alphanumeric + hyphens only
            const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
            const accountName = userInfo.displayName 
                ? `mcpay-${userInfo.displayName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 10)}-${timestamp}`
                : `mcpay-${userId.slice(0, 8)}-${timestamp}`;

            console.log(`[DEBUG] Auto-creating CDP wallet for user ${userId} with account name: ${accountName}`);

            // Double-check if user already has CDP wallets (race condition protection)
            const hasCDPWalletsAgain = await txOperations.userHasCDPWallets(userId)(tx);
            if (hasCDPWalletsAgain) {
                console.log(`User ${userId} already has CDP wallets (race condition detected), skipping auto-creation`);
                return null;
            }

            // Create CDP account with optional smart account
            console.log(`[DEBUG] Calling createCDPAccount...`);
            const cdpResult = await createCDPAccount({
                accountName,
                network, // Use configured network
                createSmartAccount, // Use configured smart account option
            });
            console.log(`[DEBUG] CDP account creation result:`, cdpResult);

            const wallets = [];

            // Store main account
            console.log(`[DEBUG] Storing main account in database...`);
            
            // Check if user already has a primary wallet to avoid constraint violations
            const existingPrimaryWallet = await tx.query.userWallets.findFirst({
                where: and(
                    eq(userWallets.userId, userId),
                    eq(userWallets.isPrimary, true),
                    eq(userWallets.isActive, true)
                )
            });
            
            const mainWallet = await txOperations.createCDPManagedWallet(userId, {
                walletAddress: cdpResult.account.walletAddress,
                accountId: cdpResult.account.accountId,
                accountName: cdpResult.account.accountName || cdpResult.account.accountId,
                network: cdpResult.account.network,
                isSmartAccount: false,
                isPrimary: !existingPrimaryWallet, // Only set as primary if no existing primary wallet
            })(tx);
            
            if (mainWallet) {
                wallets.push(mainWallet);
                console.log(`[DEBUG] Main wallet stored:`, mainWallet.walletAddress);
            }

            // Store smart account if created
            if (cdpResult.smartAccount) {
                console.log(`[DEBUG] Storing smart account in database...`);
                const smartWallet = await txOperations.createCDPManagedWallet(userId, {
                    walletAddress: cdpResult.smartAccount.walletAddress,
                    accountId: cdpResult.smartAccount.accountId,
                    accountName: cdpResult.smartAccount.accountName || cdpResult.smartAccount.accountId,
                    network: cdpResult.smartAccount.network,
                    isSmartAccount: true,
                    ownerAccountId: cdpResult.account.accountId,
                    isPrimary: false, // Smart accounts are not primary by default
                })(tx);
                if (smartWallet) {
                    wallets.push(smartWallet);
                    console.log(`[DEBUG] Smart wallet stored:`, smartWallet.walletAddress);
                }
            }

            console.log(`[DEBUG] Successfully created ${wallets.length} CDP wallets for user ${userId}`);
            
            return {
                cdpResult,
                wallets,
                accountName
            };
        } catch (error) {
            console.error(`[ERROR] Failed to auto-create CDP wallet for user ${userId}:`, error);
            console.error(`[ERROR] Error details:`, {
                name: error instanceof Error ? error.name : 'Unknown',
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            // Don't throw error - this is a best-effort auto-creation
            // The user can always create wallets manually later
            return null;
        }
    },

    // Legacy compatibility - migrate legacy wallet to new system
    migrateLegacyWallet: (userId: string) => async (tx: TransactionType) => {
        const user = await tx.query.users.findFirst({
            where: eq(users.id, userId)
        });

        if (!user?.walletAddress) {
            return null; // No legacy wallet to migrate
        }

        // Check if wallet already exists in new system
        const existingWallet = await tx.query.userWallets.findFirst({
            where: and(
                eq(userWallets.userId, userId),
                eq(userWallets.walletAddress, user.walletAddress)
            )
        });

        if (existingWallet) {
            return existingWallet; // Already migrated
        }

        // Migrate legacy wallet - assume EVM architecture as default for legacy wallets
        const migratedWallet = await txOperations.addWalletToUser({
            userId,
            walletAddress: user.walletAddress,
            walletType: 'external',
            provider: 'legacy',
            blockchain: 'ethereum', // Default to ethereum for legacy wallets
            architecture: 'evm', // Default to EVM for legacy wallets
            isPrimary: true,
            walletMetadata: {
                migratedFromLegacy: true,
                migratedAt: new Date().toISOString()
            }
        })(tx);

        return migratedWallet;
    },

    // Session operations
    createSession: (data: {
        id: string;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string;
        userAgent?: string;
    }) => async (tx: TransactionType) => {
        const result = await tx.insert(session).values({
            id: data.id,
            userId: data.userId,
            expiresAt: data.expiresAt,
            token: data.token,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning();

        if (!result[0]) throw new Error("Failed to create session");
        return result[0];
    },

    getSessionByToken: (token: string) => async (tx: TransactionType) => {
        return await tx.query.session.findFirst({
            where: eq(session.token, token),
            with: {
                user: true
            }
        });
    },

    deleteSession: (id: string) => async (tx: TransactionType) => {
        const result = await tx.delete(session)
            .where(eq(session.id, id))
            .returning();

        if (!result[0]) throw new Error(`Session with ID ${id} not found`);
        return result[0];
    },

    // Account operations (for OAuth providers)
    createAccount: (data: {
        id: string;
        accountId: string;
        providerId: string;
        userId: string;
        accessToken?: string;
        refreshToken?: string;
        idToken?: string;
        accessTokenExpiresAt?: Date;
        refreshTokenExpiresAt?: Date;
        scope?: string;
        password?: string;
    }) => async (tx: TransactionType) => {
        const result = await tx.insert(account).values({
            id: data.id,
            accountId: data.accountId,
            providerId: data.providerId,
            userId: data.userId,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            idToken: data.idToken,
            accessTokenExpiresAt: data.accessTokenExpiresAt,
            refreshTokenExpiresAt: data.refreshTokenExpiresAt,
            scope: data.scope,
            password: data.password,
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning();

        if (!result[0]) throw new Error("Failed to create account");
        return result[0];
    },

    getAccountByProvider: (userId: string, providerId: string) => async (tx: TransactionType) => {
        return await tx.query.account.findFirst({
            where: and(
                eq(account.userId, userId),
                eq(account.providerId, providerId)
            )
        });
    },

    // Verification operations
    createVerification: (data: {
        id: string;
        identifier: string;
        value: string;
        expiresAt: Date;
    }) => async (tx: TransactionType) => {
        const result = await tx.insert(verification).values({
            id: data.id,
            identifier: data.identifier,
            value: data.value,
            expiresAt: data.expiresAt,
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning();

        if (!result[0]) throw new Error("Failed to create verification");
        return result[0];
    },

    getVerification: (identifier: string, value: string) => async (tx: TransactionType) => {
        return await tx.query.verification.findFirst({
            where: and(
                eq(verification.identifier, identifier),
                eq(verification.value, value)
            )
        });
    },

    deleteVerification: (id: string) => async (tx: TransactionType) => {
        const result = await tx.delete(verification)
            .where(eq(verification.id, id))
            .returning();

        if (!result[0]) throw new Error(`Verification with ID ${id} not found`);
        return result[0];
    },

    // Enhanced Tool Pricing (now stored in mcpTools.payment field)
    createToolPricing: (toolId: string, pricing: PricingEntry) => async (tx: TransactionType) => {
        // Get current tool data
        const tool = await tx.query.mcpTools.findFirst({
            where: eq(mcpTools.id, toolId)
        });
        
        if (!tool) {
            throw new Error(`Tool with ID ${toolId} not found`);
        }

        const currentPricing = (tool.pricing as PricingEntry[]) || [];
        
        // Deactivate existing pricing entries
        const updatedPricing = currentPricing.map((p: PricingEntry) => ({ ...p, active: false, updatedAt: new Date().toISOString() }));
        
        // Create new pricing entry
        const newPricing = {
            id: crypto.randomUUID(),
            maxAmountRequiredRaw: pricing.maxAmountRequiredRaw,
            tokenDecimals: pricing.tokenDecimals,
            network: pricing.network,
            assetAddress: pricing.assetAddress,
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Add new pricing to the array
        updatedPricing.push(newPricing);

        const result = await tx
            .update(mcpTools)
            .set({ 
                pricing: updatedPricing as PricingEntry[],
                isMonetized: true,
                updatedAt: new Date()
            })
            .where(eq(mcpTools.id, toolId))
            .returning();

        if (!result[0]) {
            throw new Error("Failed to update tool with pricing");
        }

        // Return pricing in the same format as the old table
        return {
            id: newPricing.id,
            toolId,
            amountRaw: newPricing.maxAmountRequiredRaw,
            tokenDecimals: newPricing.tokenDecimals,
            network: newPricing.network,
            assetAddress: newPricing.assetAddress,
            active: newPricing.active,
            createdAt: new Date(newPricing.createdAt),
            updatedAt: new Date(newPricing.updatedAt)
        };
    },

    getActiveToolPricing: (toolId: string) => async (tx: TransactionType) => {
        const tool = await tx.query.mcpTools.findFirst({
            where: eq(mcpTools.id, toolId)
        });
        
        if (!tool?.pricing) {
            return null;
        }
        
        const pricing = tool.pricing as PricingEntry[];
        
        if (!pricing.length) {
            return null;
        }

        // Return only active pricing entries
        const activePricing = pricing.filter(p => p.active === true);
        
        return activePricing.length > 0 ? activePricing : null;
    },

    deactivateToolPricing: (toolId: string) => async (tx: TransactionType) => {
        const tool = await tx.query.mcpTools.findFirst({
            where: eq(mcpTools.id, toolId)
        });
        
        if (!tool?.pricing) {
            return null;
        }
        
        const pricing = tool.pricing as PricingEntry[];
        
        if (!pricing) {
            return null;
        }
        
        const currentActive = pricing.find((p: PricingEntry) => p.active === true);
        
        if (!currentActive) {
            return null;
        }
        
        // Deactivate current pricing
        const updatedPricing = pricing.map((p: PricingEntry) => 
            p.createdAt === currentActive.createdAt 
                ? { ...p, active: false, updatedAt: new Date().toISOString() }
                : p
        );

        await tx
            .update(mcpTools)
            .set({ 
                pricing: updatedPricing as PricingEntry[],
                isMonetized: false,
                updatedAt: new Date()
            })
            .where(eq(mcpTools.id, toolId));

        // Return the deactivated pricing in the same format
        return {
            id: currentActive.id,
            toolId,
            amountRaw: currentActive.maxAmountRequiredRaw,
            tokenDecimals: currentActive.tokenDecimals,
            network: currentActive.network,
            assetAddress: currentActive.assetAddress,
            active: false,
            createdAt: new Date(currentActive.createdAt),
            updatedAt: new Date()
        };
    },

    // Payments
    createPayment: (data: {
        toolId: string;
        userId?: string;
        amountRaw: string; // Base units as string (e.g., "100000" for 0.1 USDC)
        tokenDecimals: number; // Token decimals (e.g., 6 for USDC)
        currency: string;
        network: string;
        transactionHash?: string;
        status?: string;
        signature?: string;
        paymentData?: Record<string, unknown>;
    }) => async (tx: TransactionType) => {
        const result = await tx.insert(payments).values({
            toolId: data.toolId,
            userId: data.userId,
            amountRaw: data.amountRaw,
            tokenDecimals: data.tokenDecimals,
            currency: data.currency,
            network: data.network,
            transactionHash: data.transactionHash,
            status: data.status || 'pending',
            signature: data.signature,
            paymentData: data.paymentData,
            createdAt: new Date()
        }).returning();

        if (!result[0]) throw new Error("Failed to create payment");
        return result[0];
    },

    updatePaymentStatus: (id: string, status: string, transactionHash?: string) => async (tx: TransactionType) => {
        const updated = await tx.update(payments)
            .set({
                status,
                ...(transactionHash ? { transactionHash } : {}),
                ...(status === 'completed' ? { settledAt: new Date() } : {})
            })
            .where(eq(payments.id, id))
            .returning();

        if (!updated[0]) throw new Error(`Payment with ID ${id} not found`);
        return updated[0];
    },

    getPaymentByTransactionHash: (transactionHash: string) => async (tx: TransactionType) => {
        return await tx.query.payments.findFirst({
            where: eq(payments.transactionHash, transactionHash)
        });
    },

    // API Keys
    validateApiKey: (keyHash: string) => async (tx: TransactionType) => {
        const apiKey = await tx.query.apiKeys.findFirst({
            where: and(
                eq(apiKeys.keyHash, keyHash),
                eq(apiKeys.active, true)
            ),
            with: {
                user: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                        displayName: true,
                        avatarUrl: true,
                        image: true
                    }
                }
            }
        });

        if (!apiKey) {
            return null;
        }

        // Check if key is expired
        if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
            return null;
        }

        // Update last used timestamp
        await tx.update(apiKeys)
            .set({ lastUsedAt: new Date() })
            .where(eq(apiKeys.id, apiKey.id));

        return {
            apiKey,
            user: apiKey.user
        };
    },

    createApiKey: (data: {
        userId: string;
        keyHash: string;
        name: string;
        permissions: string[];
        expiresAt?: Date;
    }) => async (tx: TransactionType) => {
        const result = await tx.insert(apiKeys).values({
            userId: data.userId,
            keyHash: data.keyHash,
            name: data.name,
            permissions: data.permissions,
            expiresAt: data.expiresAt,
            active: true,
            createdAt: new Date()
        }).returning();

        if (!result[0]) throw new Error("Failed to create API key");
        return result[0];
    },

    getUserApiKeys: (userId: string) => async (tx: TransactionType) => {
        return await tx.query.apiKeys.findMany({
            where: and(
                eq(apiKeys.userId, userId),
                eq(apiKeys.active, true)
            ),
            columns: {
                id: true,
                name: true,
                permissions: true,
                lastUsedAt: true,
                createdAt: true,
                expiresAt: true,
                keyHash: false // Never return the hash
            },
            orderBy: [desc(apiKeys.createdAt)]
        });
    },

    revokeApiKey: (keyId: string, userId: string) => async (tx: TransactionType) => {
        // Verify ownership before revoking
        const apiKey = await tx.query.apiKeys.findFirst({
            where: and(
                eq(apiKeys.id, keyId),
                eq(apiKeys.userId, userId),
                eq(apiKeys.active, true)
            )
        });

        if (!apiKey) {
            throw new Error("API key not found or access denied");
        }

        const result = await tx.update(apiKeys)
            .set({
                active: false,
                lastUsedAt: new Date() // Mark revocation time
            })
            .where(eq(apiKeys.id, keyId))
            .returning();

        if (!result[0]) throw new Error(`API key with ID ${keyId} not found`);
        return result[0];
    },

    // Tool Usage
    recordToolUsage: (data: {
        toolId: string;
        userId?: string;
        responseStatus: string;
        executionTimeMs?: number;
        ipAddress?: string;
        userAgent?: string;
        requestData?: Record<string, unknown>;
        result?: Record<string, unknown>;
    }) => async (tx: TransactionType) => {
        const executionTime = data.executionTimeMs !== undefined ? data.executionTimeMs : undefined;

        const result = await tx.insert(toolUsage).values({
            toolId: data.toolId,
            userId: data.userId,
            responseStatus: data.responseStatus,
            executionTimeMs: executionTime,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            requestData: data.requestData,
            result: data.result,
            timestamp: new Date()
        }).returning();

        if (!result[0]) throw new Error("Failed to record tool usage");
        return result[0];
    },

    // Get user's tool usage history
    getUserToolUsageHistory: (userId: string, limit = 50, offset = 0) => async (tx: TransactionType) => {
        return await tx.query.toolUsage.findMany({
            where: eq(toolUsage.userId, userId),
            limit,
            offset,
            orderBy: [desc(toolUsage.timestamp)],
            with: {
                tool: {
                    columns: {
                        id: true,
                        name: true,
                        description: true
                    },
                    with: {
                        server: {
                            columns: {
                                id: true,
                                serverId: true,
                                name: true
                            }
                        }
                    }
                }
                // pricing relation removed - pricing data now in payment jsonb field
            }
        });
    },

    // Get user's payment history
    getUserPaymentHistory: (userId: string, limit = 50, offset = 0) => async (tx: TransactionType) => {
        return await tx.query.payments.findMany({
            where: eq(payments.userId, userId),
            limit,
            offset,
            orderBy: [desc(payments.createdAt)],
            with: {
                tool: {
                    columns: {
                        id: true,
                        name: true,
                        description: true
                    },
                    with: {
                        server: {
                            columns: {
                                id: true,
                                serverId: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });
    },

    // Analytics (Now computed from views - these are helper functions for compatibility)
    getDailyServerAnalytics: (serverId: string) => async (tx: TransactionType) => {
        const result = await tx.select()
            .from(dailyServerAnalyticsView)
            .where(and(
                eq(dailyServerAnalyticsView.serverId, serverId),
            ))
            .limit(100);

        return result || null;
    },

    getServerSummaryAnalytics: (serverId: string) => async (tx: TransactionType) => {
        const result = await tx.select()
            .from(serverSummaryAnalyticsView)
            .where(eq(serverSummaryAnalyticsView.serverId, serverId))
            .limit(1);

        return result[0] || null;
    },

    getGlobalAnalytics: () => async (tx: TransactionType) => {
        const result = await tx.select()
            .from(globalAnalyticsView)
            .limit(1);

        return result[0] || null;
    },

    getToolAnalytics: (toolId?: string) => async (tx: TransactionType) => {
        const query = tx.select().from(toolAnalyticsView);
        
        if (toolId) {
            query.where(eq(toolAnalyticsView.toolId, toolId));
        }
        
        return await query;
    },

    getDailyActivity: (days = 30) => async (tx: TransactionType) => {
        const result = await tx.select()
            .from(dailyActivityView)
            .limit(days);

        return result;
    },

    // Legacy compatibility function - now does nothing but prevents errors
    updateOrCreateDailyAnalytics: (
        serverId: string,
        date: Date,
        data: {
            totalRequests?: number;
            totalRevenue?: number;
            revenueByCurrency?: RevenueByCurrency;
            currency?: string;
            decimals?: number;
            uniqueUsers?: number;
            avgResponseTime?: number;
            toolUsage?: Record<string, unknown>;
            errorCount?: number;
            userId?: string;
        }
    ) => async (tx: TransactionType) => {
        // Analytics are now computed from views, so this is a no-op
        // Keep for backward compatibility but log that it's deprecated
        console.warn('updateOrCreateDailyAnalytics is deprecated - analytics are now computed from views');
        return null;
    },

    // Server Ownership
    assignOwnership: (serverId: string, userId: string, role = 'owner') => async (tx: TransactionType) => {
        const ownership = await tx.insert(serverOwnership).values({
            serverId,
            userId,
            role,
            active: true,
            createdAt: new Date()
        }).returning();

        if (!ownership[0]) throw new Error("Failed to assign ownership");
        return ownership[0];
    },

    getServerOwnership: (serverId: string, userId: string) => async (tx: TransactionType) => {
        return await tx.query.serverOwnership.findFirst({
            where: and(
                eq(serverOwnership.serverId, serverId),
                eq(serverOwnership.userId, userId),
                eq(serverOwnership.active, true)
            )
        });
    },

    listServerOwners: (serverId: string) => async (tx: TransactionType) => {
        return await tx.query.serverOwnership.findMany({
            where: and(
                eq(serverOwnership.serverId, serverId),
                eq(serverOwnership.active, true)
            )
        });
    },

    getApiKeyByHash: (keyHash: string) => async (tx: TransactionType) => {
        return await tx.query.apiKeys.findFirst({
            where: and(
                eq(apiKeys.keyHash, keyHash),
                eq(apiKeys.active, true)
            )
        });
    },

    updateApiKeyLastUsed: (id: string) => async (tx: TransactionType) => {
        const result = await tx.update(apiKeys)
            .set({
                lastUsedAt: new Date()
            })
            .where(eq(apiKeys.id, id))
            .returning();

        if (!result[0]) throw new Error(`API key with ID ${id} not found`);
        return result[0];
    },

    // Webhooks
    createWebhook: (data: {
        serverId: string;
        url: string;
        secret?: string;
        events: string[];
    }) => async (tx: TransactionType) => {
        const result = await tx.insert(webhooks).values({
            serverId: data.serverId,
            url: data.url,
            secret: data.secret,
            events: data.events,
            active: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            failureCount: 0
        }).returning();

        if (!result[0]) throw new Error("Failed to create webhook");
        return result[0];
    },

    listWebhooks: (serverId: string) => async (tx: TransactionType) => {
        return await tx.query.webhooks.findMany({
            where: and(
                eq(webhooks.serverId, serverId),
                eq(webhooks.active, true)
            )
        });
    },

    // Proofs operations
    createProof: (data: {
        toolId: string;
        serverId: string;
        userId?: string;
        isConsistent: boolean;
        confidenceScore: number;
        executionUrl?: string;
        executionMethod?: string;
        executionHeaders?: Record<string, unknown>;
        executionParams: Record<string, unknown>;
        executionResult: Record<string, unknown>;
        executionTimestamp: Date;
        aiEvaluation: string;
        inconsistencies?: Array<{
            type: 'parameter_mismatch' | 'result_mismatch' | 'description_mismatch';
            details: string;
        }>;
        webProofPresentation?: string;
        notaryUrl?: string;
        proofMetadata?: Record<string, unknown>;
        replayExecutionResult?: Record<string, unknown>;
        replayExecutionTimestamp?: Date;
        status?: string;
        verificationType?: string;
    }) => async (tx: TransactionType) => {
        const result = await tx.insert(proofs).values({
            toolId: data.toolId,
            serverId: data.serverId,
            userId: data.userId,
            isConsistent: data.isConsistent,
            confidenceScore: data.confidenceScore.toString(),
            executionUrl: data.executionUrl,
            executionMethod: data.executionMethod,
            executionHeaders: data.executionHeaders,
            executionParams: data.executionParams,
            executionResult: data.executionResult,
            executionTimestamp: data.executionTimestamp,
            aiEvaluation: data.aiEvaluation,
            inconsistencies: data.inconsistencies,
            webProofPresentation: data.webProofPresentation,
            notaryUrl: data.notaryUrl,
            proofMetadata: data.proofMetadata,
            replayExecutionResult: data.replayExecutionResult,
            replayExecutionTimestamp: data.replayExecutionTimestamp,
            status: data.status || 'verified',
            verificationType: data.verificationType || 'execution',
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning();

        if (!result[0]) throw new Error("Failed to create proof");
        return result[0];
    },

    getProofById: (id: string) => async (tx: TransactionType) => {
        return await tx.query.proofs.findFirst({
            where: eq(proofs.id, id),
            with: {
                tool: {
                    columns: {
                        id: true,
                        name: true,
                        description: true
                    }
                },
                server: {
                    columns: {
                        id: true,
                        serverId: true,
                        name: true
                    }
                },
                user: {
                    columns: {
                        id: true,
                        walletAddress: true,
                        displayName: true
                    }
                }
            }
        });
    },

    listProofsByTool: (toolId: string, limit = 10, offset = 0) => async (tx: TransactionType) => {
        return await tx.query.proofs.findMany({
            where: eq(proofs.toolId, toolId),
            limit,
            offset,
            orderBy: [desc(proofs.createdAt)],
            with: {
                user: {
                    columns: {
                        id: true,
                        walletAddress: true,
                        displayName: true
                    }
                }
            }
        });
    },

    listProofsByServer: (serverId: string, limit = 10, offset = 0) => async (tx: TransactionType) => {
        return await tx.query.proofs.findMany({
            where: eq(proofs.serverId, serverId),
            limit,
            offset,
            orderBy: [desc(proofs.createdAt)],
            with: {
                tool: {
                    columns: {
                        id: true,
                        name: true,
                        description: true
                    }
                },
                user: {
                    columns: {
                        id: true,
                        walletAddress: true,
                        displayName: true
                    }
                }
            }
        });
    },

    listProofsByUser: (userId: string, limit = 10, offset = 0) => async (tx: TransactionType) => {
        return await tx.query.proofs.findMany({
            where: eq(proofs.userId, userId),
            limit,
            offset,
            orderBy: [desc(proofs.createdAt)],
            with: {
                tool: {
                    columns: {
                        id: true,
                        name: true,
                        description: true
                    }
                },
                server: {
                    columns: {
                        id: true,
                        serverId: true,
                        name: true
                    }
                }
            }
        });
    },

    listProofs: (filters?: {
        isConsistent?: boolean;
        verificationType?: string;
        status?: string;
        minConfidenceScore?: number;
    }, limit = 10, offset = 0) => async (tx: TransactionType) => {
        const conditions = [];
        
        if (filters?.isConsistent !== undefined) {
            conditions.push(eq(proofs.isConsistent, filters.isConsistent));
        }
        
        if (filters?.verificationType) {
            conditions.push(eq(proofs.verificationType, filters.verificationType));
        }
        
        if (filters?.status) {
            conditions.push(eq(proofs.status, filters.status));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        return await tx.query.proofs.findMany({
            where: whereClause,
            limit,
            offset,
            orderBy: [desc(proofs.createdAt)],
            with: {
                tool: {
                    columns: {
                        id: true,
                        name: true,
                        description: true
                    }
                },
                server: {
                    columns: {
                        id: true,
                        serverId: true,
                        name: true
                    }
                },
                user: {
                    columns: {
                        id: true,
                        walletAddress: true,
                        displayName: true
                    }
                }
            }
        });
    },

    updateProofStatus: (id: string, status: string) => async (tx: TransactionType) => {
        const result = await tx.update(proofs)
            .set({
                status,
                updatedAt: new Date()
            })
            .where(eq(proofs.id, id))
            .returning();

        if (!result[0]) throw new Error(`Proof with ID ${id} not found`);
        return result[0];
    },

    getProofStats: (filters?: {
        toolId?: string;
        serverId?: string;
        userId?: string;
        startDate?: Date;
        endDate?: Date;
    }) => async (tx: TransactionType) => {
        // This would be a more complex query in practice
        // For now, return a simple count-based implementation
        const conditions = [];
        
        if (filters?.toolId) {
            conditions.push(eq(proofs.toolId, filters.toolId));
        }
        
        if (filters?.serverId) {
            conditions.push(eq(proofs.serverId, filters.serverId));
        }
        
        if (filters?.userId) {
            conditions.push(eq(proofs.userId, filters.userId));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const allProofs = await tx.query.proofs.findMany({
            where: whereClause,
            columns: {
                isConsistent: true,
                confidenceScore: true,
                verificationType: true,
                webProofPresentation: true
            }
        });

        const totalProofs = allProofs.length;
        const consistentProofs = allProofs.filter(p => p.isConsistent).length;
        const inconsistentProofs = totalProofs - consistentProofs;
        const proofsWithWebProof = allProofs.filter(p => p.webProofPresentation).length;
        
        const avgConfidenceScore = totalProofs > 0 
            ? allProofs.reduce((sum, p) => sum + parseFloat(p.confidenceScore), 0) / totalProofs
            : 0;

        const verificationTypeStats = allProofs.reduce((stats, proof) => {
            stats[proof.verificationType] = (stats[proof.verificationType] || 0) + 1;
            return stats;
        }, {} as Record<string, number>);

        return {
            totalProofs,
            consistentProofs,
            inconsistentProofs,
            consistencyRate: totalProofs > 0 ? consistentProofs / totalProofs : 0,
            avgConfidenceScore,
            proofsWithWebProof,
            webProofRate: totalProofs > 0 ? proofsWithWebProof / totalProofs : 0,
            verificationTypeStats
        };
    },

    // Get recent proofs for a server (for reputation scoring)
    getRecentServerProofs: (serverId: string, days = 30) => async (tx: TransactionType) => {
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);

        return await tx.query.proofs.findMany({
            where: and(
                eq(proofs.serverId, serverId),
                // Note: For date comparison, you'd need to use a proper date comparison function
                // This is a simplified version
            ),
            columns: {
                isConsistent: true,
                confidenceScore: true,
                webProofPresentation: true,
                createdAt: true
            },
            orderBy: [desc(proofs.createdAt)]
        });
    },

    // Comprehensive Analytics for Landing Page (Now using views)
    getComprehensiveAnalytics: (filters?: {
        startDate?: Date;
        endDate?: Date; 
        toolId?: string;
        userId?: string;
        serverId?: string;
    }) => async (tx: TransactionType) => {
        const startDate = filters?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = filters?.endDate || new Date();

        // Get analytics from views
        const [globalAnalytics, dailyActivity, toolAnalytics] = await Promise.all([
            tx.select().from(globalAnalyticsView).limit(1),
            tx.select().from(dailyActivityView).limit(30),
            tx.select().from(toolAnalyticsView).orderBy(desc(toolAnalyticsView.totalRequests)).limit(10)
        ]);

        // Extract analytics from views
        const analytics = globalAnalytics[0];
        
        if (!analytics) {
            // Return empty analytics if no data
            return {
                totalRequests: 0,
                successfulRequests: 0,
                failedRequests: 0,
                successRate: 0,
                averageExecutionTime: 0,
                totalRevenue: 0,
                revenueByCurrency: {},
                formattedRevenue: [],
                totalPayments: 0,
                averagePaymentValue: 0,
                totalServers: 0,
                activeServers: 0,
                totalTools: 0,
                monetizedTools: 0,
                uniqueUsers: 0,
                totalProofs: 0,
                consistentProofs: 0,
                consistencyRate: 0,
                topToolsByRequests: [],
                topToolsByRevenue: [],
                topServersByActivity: [],
                dailyActivity: [],
                periodStart: startDate.toISOString(),
                periodEnd: endDate.toISOString(),
                periodDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
            };
        }

        // Process tool analytics for top performers
        const topToolsByRequests = toolAnalytics.map(tool => {
            const { totalRevenue } = processRevenueDetails(tool.revenueDetails);
            return {
                id: tool.toolId,
                name: tool.toolName,
                requests: tool.totalRequests || 0,
                revenue: totalRevenue
            };
        });

        const topToolsByRevenue = [...toolAnalytics]
            .map(tool => ({
                ...tool,
                calculatedRevenue: processRevenueDetails(tool.revenueDetails).totalRevenue
            }))
            .sort((a, b) => (b.calculatedRevenue || 0) - (a.calculatedRevenue || 0))
            .slice(0, 10)
            .map(tool => ({
                id: tool.toolId,
                name: tool.toolName,
                requests: tool.totalRequests || 0,
                revenue: tool.calculatedRevenue
            }));

        // Calculate derived metrics from analytics view
        const failedRequests = (analytics.totalRequests || 0) - (analytics.successfulRequests || 0);
        const successRate = analytics.totalRequests > 0 
            ? ((analytics.successfulRequests || 0) / analytics.totalRequests) * 100 
            : 0;

        const consistencyRate = analytics.totalProofs > 0 
            ? ((analytics.consistentProofs || 0) / analytics.totalProofs) * 100 
            : 0;

        // Process revenue details from the global analytics view
        const { revenueByCurrency, totalRevenue } = processRevenueDetails(analytics.revenueDetails);

        return {
            // Core metrics
            totalRequests: analytics.totalRequests || 0,
            successfulRequests: analytics.successfulRequests || 0,
            failedRequests,
            successRate: Math.round(successRate * 100) / 100,
            averageExecutionTime: Math.round(analytics.avgResponseTime || 0),
            
            // Financial metrics (multi-currency support restored)
            totalRevenue: Math.round(totalRevenue * 100) / 100,
            revenueByCurrency,
            formattedRevenue: formatRevenueByCurrency(revenueByCurrency),
            totalPayments: analytics.totalPayments || 0,
            averagePaymentValue: 0, // DEPRECATED: Not meaningful across currencies
            
            // Platform metrics
            totalServers: analytics.totalServers || 0,
            activeServers: analytics.activeServers || 0,
            totalTools: analytics.totalTools || 0,
            monetizedTools: analytics.monetizedTools || 0,
            uniqueUsers: analytics.uniqueUsers || 0,
            
            // Proof/verification metrics
            totalProofs: analytics.totalProofs || 0,
            consistentProofs: analytics.consistentProofs || 0,
            consistencyRate: Math.round(consistencyRate * 100) / 100,
            
            // Top performers
            topToolsByRequests,
            topToolsByRevenue,
            topServersByActivity: [], // Could be enhanced with server summary view
            
            // Time series data for charts
            dailyActivity: dailyActivity.map(day => {
                const { revenueByCurrency: dayRevenueByCurrency, totalRevenue: dayTotalRevenue } = processRevenueDetails(day.revenueDetails);
                return {
                    date: day.date,
                    requests: day.totalRequests || 0,
                    users: day.uniqueUsers || 0,
                    payments: day.totalPayments || 0,
                    revenue: dayTotalRevenue,
                    revenueByCurrency: dayRevenueByCurrency,
                    avgResponseTime: Math.round(day.avgResponseTime || 0)
                };
            }),
            
            // Period info
            periodStart: startDate.toISOString(),
            periodEnd: endDate.toISOString(),
            periodDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        };
    },

    getServerRegistrationData: (serverId: string) => async (tx: TransactionType) => {
        // Get the server with its related data for registration details
        const server = await tx.query.mcpServers.findFirst({
            where: eq(mcpServers.serverId, serverId),
            columns: {
                id: true,
                serverId: true,
                name: true,
                description: true,
                mcpOrigin: true,
                receiverAddress: true,
                requireAuth: true,
                authHeaders: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                metadata: true
            },
            with: {
                creator: {
                    columns: {
                        id: true,
                        displayName: true,
                        walletAddress: true
                    }
                },
                tools: {
                    columns: {
                        id: true,
                        name: true,
                        description: true,
                        inputSchema: true,
                        pricing: true,
                        isMonetized: true
                    }
                }
            }
        });

        if (!server) {
            return null;
        }

        // Transform tools data to include payment information formatted properly
        const toolsWithPaymentInfo = server.tools.map(tool => {
            const baseToolData = {
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema
            };

            // Add payment info if tool is monetized and has payment data
            if (tool.isMonetized && tool.pricing) {
                return {
                    ...baseToolData,
                    pricing: tool.pricing
                };
            }

            return baseToolData;
        });

        // Create registration metadata including counts
        const registrationMetadata: Record<string, unknown> = {
            timestamp: server.createdAt.toISOString(),
            toolsCount: server.tools.length,
            monetizedToolsCount: server.tools.filter(tool => tool.isMonetized).length,
            registeredFromUI: (server.metadata as Record<string, unknown>)?.registeredFromUI || false
        };

        // Safely merge additional metadata if it exists and is an object
        if (server.metadata && typeof server.metadata === 'object') {
            Object.assign(registrationMetadata, server.metadata);
        }

        return {
            id: server.id,
            serverId: server.serverId,
            mcpOrigin: server.mcpOrigin,
            creatorId: server.creator?.id,
            receiverAddress: server.receiverAddress,
            requireAuth: server.requireAuth,
            authHeaders: server.authHeaders,
            createdAt: server.createdAt.toISOString(),
            updatedAt: server.updatedAt.toISOString(),
            status: server.status,
            name: server.name,
            description: server.description,
            tools: toolsWithPaymentInfo,
            metadata: registrationMetadata
        };
    },

    getMcpServerWithStats: (serverId: string) => async (tx: TransactionType) => {
        const server = await tx.query.mcpServers.findFirst({
            where: eq(mcpServers.serverId, serverId),
            columns: {
                id: true,
                serverId: true,
                name: true,
                mcpOrigin: false,
                receiverAddress: true,
                description: true,
                metadata: true,
                status: true,
                createdAt: true,
                updatedAt: true
            },
            with: {
                creator: {
                    columns: {
                        id: true,
                        walletAddress: true,
                        displayName: true,
                        name: true,
                        avatarUrl: true,
                        image: true
                    },
                    with: {
                        wallets: {
                            columns: {
                                id: true,
                                walletAddress: true,
                                walletType: true
                            }
                        }
                    }
                },
                tools: {
                    columns: {
                        id: true,
                        name: true,
                        description: true,
                        inputSchema: true,
                        isMonetized: true,
                        pricing: true,
                        status: true,
                        metadata: true,
                        createdAt: true,
                        updatedAt: true
                    },
                    with: {
                        payments: {
                            columns: {
                                id: true,
                                amountRaw: true,
                                tokenDecimals: true,
                                currency: true,
                                network: true,
                                status: true,
                                createdAt: true,
                                settledAt: true,
                                transactionHash: true
                            },
                            with: {
                                user: {
                                    columns: {
                                        id: true,
                                        walletAddress: true,
                                        displayName: true,
                                        name: true,
                                        avatarUrl: true,
                                        image: true
                                    }
                                }
                            },
                            orderBy: [desc(payments.createdAt)],
                            limit: 50
                        },
                        usage: {
                            columns: {
                                id: true,
                                timestamp: true,
                                responseStatus: true,
                                executionTimeMs: true,
                                result: false
                            },
                            with: {
                                user: {
                                    columns: {
                                        id: true,
                                        walletAddress: true,
                                        displayName: true,
                                        name: true,
                                        avatarUrl: true,
                                        image: true
                                    }
                                }
                            },
                            orderBy: [desc(toolUsage.timestamp)],
                            limit: 100
                        },
                        proofs: {
                            columns: {
                                id: true,
                                isConsistent: true,
                                confidenceScore: true,
                                status: true,
                                verificationType: true,
                                createdAt: true,
                                webProofPresentation: true
                            },
                            with: {
                                user: {
                                    columns: {
                                        id: true,
                                        walletAddress: true,
                                        displayName: true
                                    }
                                }
                            },
                            orderBy: [desc(proofs.createdAt)],
                            limit: 50
                        }
                    },
                    orderBy: [mcpTools.name]
                },
                // Analytics will be computed from views
                ownership: {
                    where: eq(serverOwnership.active, true),
                    columns: {
                        id: true,
                        role: true,
                        createdAt: true,
                        active: true
                    },
                    with: {
                        user: {
                            columns: {
                                id: true,
                                walletAddress: true,
                                displayName: true,
                                avatarUrl: true
                            }
                        },
                        grantedByUser: {
                            columns: {
                                id: true,
                                walletAddress: true,
                                displayName: true
                            }
                        }
                    }
                },
                webhooks: {
                    where: eq(webhooks.active, true),
                    columns: {
                        id: true,
                        url: true,
                        events: true,
                        active: true,
                        lastTriggeredAt: true,
                        failureCount: true,
                        createdAt: true,
                        updatedAt: true
                    }
                },
                proofs: {
                    columns: {
                        id: true,
                        isConsistent: true,
                        confidenceScore: true,
                        status: true,
                        verificationType: true,
                        createdAt: true,
                        webProofPresentation: true
                    },
                    with: {
                        tool: {
                            columns: {
                                id: true,
                                name: true
                            }
                        },
                        user: {
                            columns: {
                                id: true,
                                walletAddress: true,
                                displayName: true
                            }
                        }
                    },
                    orderBy: [desc(proofs.createdAt)],
                    limit: 50
                }, 
            }
        });

        if (!server) return null;

        // Calculate aggregate statistics
        const stats = {
            totalTools: server.tools.length,
            monetizedTools: server.tools.filter(t => t.isMonetized).length,
            totalPayments: server.tools.reduce((sum, tool) => sum + tool.payments.length, 0),
            totalRevenue: server.tools.reduce((sum, tool) => 
                sum + tool.payments
                    .filter(p => p.status === 'completed')
                    .reduce((toolSum, payment) => toolSum + parseFloat(payment.amountRaw), 0), 0
            ),
            totalUsage: server.tools.reduce((sum, tool) => sum + tool.usage.length, 0),
            totalProofs: server.proofs.length,
            consistentProofs: server.proofs.filter(p => p.isConsistent).length,
            proofsWithWebProof: server.proofs.filter(p => p.webProofPresentation).length,
            uniqueUsers: new Set([
                ...server.tools.flatMap(t => t.payments.map(p => p.user?.id).filter(Boolean)),
                ...server.tools.flatMap(t => t.usage.map(u => u.user?.id).filter(Boolean)),
                ...server.proofs.map(p => p.user?.id).filter(Boolean)
            ]).size,
            avgResponseTime: (() => {
                const allUsage = server.tools.flatMap(t => t.usage);
                const timesWithExecution = allUsage.filter(u => u.executionTimeMs !== null);
                return timesWithExecution.length > 0 
                    ? timesWithExecution.reduce((sum, u) => sum + (u.executionTimeMs || 0), 0) / timesWithExecution.length
                    : 0;
            })(),
            reputationScore: (() => {
                if (server.proofs.length === 0) return 0;
                const consistencyRate = server.proofs.filter(p => p.isConsistent).length / server.proofs.length;
                const avgConfidence = server.proofs.reduce((sum, p) => sum + parseFloat(p.confidenceScore), 0) / server.proofs.length;
                const webProofBonus = server.proofs.filter(p => p.webProofPresentation).length / server.proofs.length * 0.2;
                return Math.min(1, consistencyRate * 0.6 + avgConfidence * 0.3 + webProofBonus);
            })(),
            lastActivity: (() => {
                const dates = [
                    ...server.tools.flatMap(t => t.payments.map(p => p.createdAt)),
                    ...server.tools.flatMap(t => t.usage.map(u => u.timestamp)),
                    ...server.proofs.map(p => p.createdAt)
                ];
                return dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
            })()
        };

        return {
            ...server,
            stats
        };
    },

    // Server Creation with Authenticated User
    createServerForAuthenticatedUser: (data: {
        serverId: string;
        mcpOrigin: string;
        authenticatedUserId: string;
        receiverAddress: string;
        requireAuth?: boolean;
        authHeaders?: Record<string, unknown>;
        description?: string;
        name?: string;
        metadata?: Record<string, unknown>;
        walletInfo?: {
            blockchain?: string;
            walletType?: 'external' | 'managed' | 'custodial';
            provider?: string;
            network?: string;
        };
        tools: Array<{
            name: string;
            description?: string;
            inputSchema?: Record<string, unknown>;
            outputSchema?: Record<string, unknown>;
            pricing: PricingEntry[] | undefined;
        }>;
    }) => async (tx: TransactionType) => {
        console.log('Creating server for authenticated user:', data.authenticatedUserId);
        
        // Use the authenticated user - no need to lookup by wallet
        const user = await txOperations.getUserById(data.authenticatedUserId)(tx);
        if (!user) {
            throw new Error('Authenticated user not found');
        }

        // Check if the user already has this wallet address
        const existingWallet = await tx.query.userWallets.findFirst({
            where: and(
                eq(userWallets.userId, user.id),
                eq(userWallets.walletAddress, data.receiverAddress),
                eq(userWallets.isActive, true)
            )
        });

        // Add wallet to user if they don't have it
        if (!existingWallet) {
            console.log('Adding new wallet to authenticated user:', data.receiverAddress);
            const walletInfo = data.walletInfo;
            
            await txOperations.addWalletToUser({
                userId: user.id,
                walletAddress: data.receiverAddress,
                walletType: (walletInfo?.walletType as 'external' | 'managed' | 'custodial') || 'external',
                provider: walletInfo?.provider || 'unknown',
                blockchain: walletInfo?.blockchain || 'ethereum',
                architecture: getBlockchainArchitecture(walletInfo?.blockchain),
                isPrimary: false, // Don't make it primary automatically
                walletMetadata: {
                    registrationNetwork: walletInfo?.network || 'base-sepolia',
                    addedViaServerCreation: true,
                    ...(walletInfo || {})
                }
            })(tx);
        }

        // Create the server under the authenticated user
        console.log('Creating server record for user:', user.id);
        const serverRecord = await txOperations.createServer({
            serverId: data.serverId,
            creatorId: user.id,
            mcpOrigin: data.mcpOrigin,
            receiverAddress: data.receiverAddress,
            requireAuth: data.requireAuth,
            authHeaders: data.authHeaders,
            name: data.name || 'No name available',
            description: data.description || 'No description available',
            metadata: data.metadata
        })(tx);

        // Create tools
        console.log('Creating tools:', data.tools.length);
        const createdTools = [];
        
        for (const tool of data.tools) {
            const createdTool = await txOperations.createTool({
                serverId: serverRecord.id,
                name: tool.name,
                description: tool.description || `Access to ${tool.name}`,
                inputSchema: tool.inputSchema || {},
                outputSchema: tool.outputSchema || {},
                isMonetized: !!tool.pricing,
                pricing: tool.pricing as PricingEntry[] | undefined
            })(tx);

            createdTools.push(createdTool);
        }

        // Assign ownership to the authenticated user
        console.log('Assigning server ownership to authenticated user:', user.id);
        await txOperations.assignOwnership(serverRecord.id, user.id, 'owner')(tx);

        console.log('Server creation completed successfully');
        return {
            server: serverRecord,
            tools: createdTools,
            user: user
        };
    }
};
