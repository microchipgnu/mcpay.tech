import { Hono } from 'hono';
import { createPaidMcpHandler } from 'mcpay/handler';
import { serve } from "@hono/node-server"

export async function startFakeMcp(port: number, mcpayApiUrl: string) {
  const app = new Hono();

  // Create paid MCP handler with ping disabled for tests
  const handler = createPaidMcpHandler(async (server) => {
    // Match seed: serverId "test-server" has tool "myTool"
    server.paidTool(
      "myTool",
      "Test tool",
      { price: 0.05, currency: 'USD' },
      async () => {
        return {
          content: [{ type: 'text', text: `ok` }],
        };
      }
    );
  }, {
    mcpay: {
      mcpayApiUrl: mcpayApiUrl,
    },
    ping: { enabled: false },
  });

  // Friendly homepage for browser visitors
  app.get('/', (c) => c.html('<h1>🚀 Fake MCP Server is Live!</h1>'));

  app.use("*", async (c) => {
    return handler(c.req.raw);
  });

  serve({
    fetch: app.fetch,
    port: port,
  })
}


