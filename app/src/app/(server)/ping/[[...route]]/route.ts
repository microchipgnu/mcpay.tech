// Enhanced ping service that registers MCP servers automatically with payment information

import { extractApiKeyFromHeaders, hashApiKey } from "@/lib/gateway/auth-utils";
import { txOperations, withTransaction } from "@/lib/gateway/db/actions";
import { getMcpToolsWithPayments, validatePaymentInfo } from "@/lib/gateway/inspect-mcp";
import { Hono, type Context, type Next } from "hono";
import { cors } from 'hono/cors';
import { handle } from 'hono/vercel';
import { randomUUID } from "node:crypto";

export const runtime = 'nodejs'

// Define user type that matches what we get from API key validation
type ApiKeyUser = {
    id: string;
    name: string | null;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    image: string | null;
};

// Define extended context type for ping middleware with API key info
type PingAppContext = {
    Variables: {
        user: ApiKeyUser;
        apiKeyInfo?: {
            id: string;
            userId: string;
            keyHash: string;
            name: string;
            permissions: string[];
            createdAt: Date;
            expiresAt: Date | null;
            lastUsedAt: Date | null;
            active: boolean;
        };
    };
};

const app = new Hono<PingAppContext>({
    strict: false,
}).basePath('/ping')

// Add CORS middleware to handle cross-origin requests
app.use('*', cors({
    origin: '*', // You might want to restrict this to your domain in production
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
}))

// Add error handling middleware
app.onError((err, c) => {
    console.error('Ping route error:', err)
    return c.json({
        status: 'error',
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
        service: 'mcpay-ping'
    }, 500)
})

// API key authentication middleware for ping requests
const pingAuthMiddleware = async (c: Context<PingAppContext>, next: Next) => {
    try {
        // Extract API key from headers
        const apiKey = extractApiKeyFromHeaders(c.req.raw.headers);

        if (!apiKey) {
            return c.json({
                status: 'error',
                message: 'API key required. Please provide a valid API key in X-API-KEY header or Authorization: Bearer header.',
                timestamp: new Date().toISOString(),
                service: 'mcpay-ping'
            }, 401);
        }

        // Validate API key
        const keyHash = hashApiKey(apiKey);
        const apiKeyResult = await withTransaction(async (tx) => {
            return await txOperations.validateApiKey(keyHash)(tx);
        });

        if (!apiKeyResult?.user) {
            return c.json({
                status: 'error',
                message: 'Invalid or expired API key.',
                timestamp: new Date().toISOString(),
                service: 'mcpay-ping'
            }, 401);
        }

        console.log(`[${new Date().toISOString()}] User authenticated via API key: ${apiKeyResult.user.id}`);

        // Add user to context with proper typing
        c.set('user', apiKeyResult.user);
        // Store API key info in context
        c.set('apiKeyInfo', apiKeyResult.apiKey);

        await next();
    } catch (error) {
        console.error('Ping auth middleware error:', error);
        return c.json({
            status: 'error',
            message: 'Authentication failed',
            timestamp: new Date().toISOString(),
            service: 'mcpay-ping'
        }, 401);
    }
};

app.post('/', pingAuthMiddleware, async (c) => {
    try {
        console.log('Enhanced ping received');
        const user = c.get('user');
        if (!user) {
            return c.json({
                status: 'error',
                message: 'User not found in context',
                timestamp: new Date().toISOString(),
                service: 'mcpay-ping'
            }, 401);
        }
        const body = await c.req.json();

        console.log('Ping payload:', body);

        const {
            detectedUrls,
            receiverAddress,
            requireAuth = false,
            authHeaders
        } = body;

        if (!detectedUrls || !Array.isArray(detectedUrls) || detectedUrls.length === 0) {
            return c.json({
                status: 'error',
                message: 'No detected URLs provided',
                timestamp: new Date().toISOString(),
                service: 'mcpay-ping'
            }, 400);
        }

        // Set proper headers to prevent caching and ensure fresh responses
        c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
        c.header('Pragma', 'no-cache');
        c.header('Expires', '0');
        c.header('Content-Type', 'application/json');

        const mcpUrl = new URL(`${detectedUrls[0]}/mcp`);
        console.log('Connecting to MCP server at:', mcpUrl.toString());

        // Get user's primary wallet address for receiverAddress fallback
        let userWalletAddress: string | null = null;
        try {
            const userWallets = await withTransaction(async (tx) => {
                return await tx.query.userWallets.findMany({
                    where: (userWallets, { eq, and }) => and(
                        eq(userWallets.userId, user.id),
                        eq(userWallets.isActive, true)
                    ),
                    orderBy: (userWallets, { desc }) => [desc(userWallets.isPrimary), desc(userWallets.createdAt)],
                    limit: 1
                });
            });

            console.log('User wallets:', userWallets);

            userWalletAddress = userWallets[0]?.walletAddress || null;
        } catch (error) {
            console.warn('Failed to get user wallet address:', error);
        }

        // Extract tools with payment information
        let toolsWithPricing;
        try {
            // FIX THIS: receiverAddress is not always set
            toolsWithPricing = await getMcpToolsWithPayments(mcpUrl.toString(), userWalletAddress || receiverAddress || '0x0000000000000000000000000000000000000000');
            console.log(`Found ${toolsWithPricing.length} tools, ${toolsWithPricing.filter(t => t.pricing).length} with pricing info`);
        } catch (error) {
            console.error('Failed to connect to MCP server:', error);
            return c.json({
                status: 'error',
                message: 'Failed to connect to MCP server',
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
                service: 'mcpay-ping'
            }, 400);
        }

        // Log payment information for debugging
        toolsWithPricing.forEach(tool => {
            if (tool.pricing) {
                tool.pricing.forEach(pricing => {
                    console.log(`Tool ${tool.name} pricing info:`, pricing);
                    const isValid = validatePaymentInfo(pricing);
                    console.log(`Payment info valid: ${isValid}`);
                });
            }
        });

        // Auto-register or update server
        const serverResult = await withTransaction(async (tx) => {
            // Check if server already exists by origin
            const existingServer = await txOperations.getMcpServerByOrigin(mcpUrl.toString())(tx);

            if (existingServer) {
                console.log('Updating existing server:', existingServer.id);

                // Check if user owns this server
                if (existingServer.creatorId !== user.id) {
                    throw new Error('Server already exists and is owned by another user');
                }

                // Update existing server with new tool information
                const result = await txOperations.updateServerFromPing(existingServer.id, {
                    name: existingServer.name || 'Auto-registered Server',
                    description: existingServer.description || 'Server registered via ping',
                    metadata: {
                        ...(existingServer.metadata && typeof existingServer.metadata === 'object' ? existingServer.metadata : {}),
                        registeredFromPing: true,
                        lastPing: new Date().toISOString(),
                        toolsCount: toolsWithPricing.length,
                        monetizedToolsCount: toolsWithPricing.filter(t => t.pricing).length
                    },
                    toolsData: toolsWithPricing.map(tool => ({
                        name: tool.name,
                        description: tool.description || `Access to ${tool.name}`,
                        inputSchema: tool.inputSchema || {},
                        pricing: tool.pricing
                    }))
                })(tx);

                return {
                    server: result.server,
                    tools: result.tools,
                    isNew: false
                };
            } else {
                console.log('Creating new server for user:', user.id);

                // Create new server
                const result = await txOperations.createServerForAuthenticatedUser({
                    serverId: randomUUID(),
                    mcpOrigin: mcpUrl.toString(),
                    authenticatedUserId: user.id,
                    receiverAddress: receiverAddress || userWalletAddress || '0x0000000000000000000000000000000000000000',
                    requireAuth,
                    authHeaders,
                    name: 'Auto-registered Server',
                    description: 'Server registered via ping',
                    metadata: {
                        registeredFromPing: true,
                        timestamp: new Date().toISOString(),
                        toolsCount: toolsWithPricing.length,
                        monetizedToolsCount: toolsWithPricing.filter(t => t.pricing).length,
                    },
                    tools: toolsWithPricing.map(tool => ({
                        name: tool.name,
                        description: tool.description || `Access to ${tool.name}`,
                        inputSchema: tool.inputSchema || {},
                        pricing: tool.pricing
                    }))
                })(tx);

                return {
                    server: result.server,
                    tools: result.tools,
                    isNew: true
                };
            }
        });

        const toolSummary = toolsWithPricing.map(tool => ({
            name: tool.name,
            hasPricing: !!tool.pricing,
            pricingInfo: tool.pricing ? {
                asset: tool.pricing[0].assetAddress,
                network: tool.pricing[0].network,
                amount: tool.pricing[0].maxAmountRequiredRaw
            } : null
        }));

        return c.json({
            status: 'success',
            message: `Server ${serverResult.isNew ? 'registered' : 'updated'} successfully`,
            server: {
                id: serverResult.server.id,
                serverId: serverResult.server.serverId,
                name: serverResult.server.name,
                mcpOrigin: mcpUrl.toString(),
                toolsRegistered: toolsWithPricing.length,
                monetizedTools: toolsWithPricing.filter(t => t.pricing).length,
                registrationStatus: serverResult.isNew ? 'created' : 'updated'
            },
            tools: toolSummary,
            timestamp: new Date().toISOString(),
            service: 'mcpay-ping',
            requestId: Math.random().toString(36).substring(7)
        });
    } catch (error) {
        console.error('Error processing enhanced ping:', error);
        return c.json({
            status: 'error',
            message: 'Failed to process ping',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
            service: 'mcpay-ping'
        }, 500);
    }
});

// Add GET endpoint for health checks
app.get('/', async (c) => {
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    c.header('Content-Type', 'application/json');

    return c.json({
        status: 'ok',
        message: 'Enhanced ping service is running',
        features: [
            'Auto server registration',
            'Payment extraction from tool annotations',
            'Tool synchronization',
            'API key authentication'
        ],
        authentication: 'Requires valid API key in X-API-KEY header or Authorization: Bearer header',
        timestamp: new Date().toISOString(),
        service: 'mcpay-ping'
    });
});

export const GET = handle(app);
export const POST = handle(app);
export const OPTIONS = handle(app);