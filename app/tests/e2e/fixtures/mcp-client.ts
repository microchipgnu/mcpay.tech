import { test as base, expect } from '@playwright/test';
import { experimental_createMCPClient } from 'ai';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

type MCPClient = Awaited<ReturnType<typeof experimental_createMCPClient>>;

export const test = base.extend<{ mcp: MCPClient }>({
  mcp: async ({ baseURL }, use) => {
    if (!baseURL) {
      throw new Error('baseURL is not set. Ensure tests call test.use({ baseURL: process.env.PW_BASE_URL }).');
    }

    // Use the proxy origin exposed by the app under test, seeded with serverId "test-server"
    const origin = new URL('/mcp/test-server', baseURL);
    const transport = new StreamableHTTPClientTransport(origin);
    const client = await experimental_createMCPClient({ transport });

    await use(client);
    // No explicit teardown required for StreamableHTTPClientTransport
  },
});

export { expect };

export type { MCPClient };


