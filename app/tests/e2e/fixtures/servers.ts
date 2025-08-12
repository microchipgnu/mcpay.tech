import { test as authTest, expect } from './auth';
import type { TestInfo } from '@playwright/test';
import getPort from 'get-port';
import { Hono } from 'hono';
import { createMcpHandler } from 'mcp-handler';
import { serve } from '@hono/node-server';

type ServersFixtures = {
  mcpFakeOrigin: string;
  mcpFakeOrigin2: string;
};

// Caches to emulate worker-scoped lifecycle while keeping fixture test-scoped
const workerOriginCache = new Map<number, string>();
const workerOrigin2Cache = new Map<number, string>();

// Spin up two lightweight MCP servers per worker and expose their origins
export const test = authTest.extend<ServersFixtures>({
  mcpFakeOrigin: async ({}, use, testInfo: TestInfo) => {
    const idx = testInfo.workerIndex;
    const cached = workerOriginCache.get(idx);
    if (cached) {
      await use(cached);
      return;
    }
    const port = await getPort();

    const app = new Hono();
    const handler = createMcpHandler(async (server) => {
      server.tool('paidTool', 'Test tool', async () => ({
        content: [{ type: 'text', text: 'Hello, world!' }],
      }));
    });

    // Friendly homepage
    app.get('/', (c) => c.html('<h1>🚀 Fake MCP Server is Live!</h1>'));
    app.use('*', async (c) => handler(c.req.raw));

    // Note: @hono/node-server's serve() does not expose a close handle in our setup,
    // but using a random free port per worker avoids conflicts.
    serve({ fetch: app.fetch, port });
    const origin = `http://localhost:${port}/mcp`;
    workerOriginCache.set(idx, origin);
    await use(origin);
    // No teardown hook available for serve(); process exit will clean up.
  },

  mcpFakeOrigin2: async ({}, use, testInfo: TestInfo) => {
    const idx = testInfo.workerIndex;
    const cached = workerOrigin2Cache.get(idx);
    if (cached) {
      await use(cached);
      return;
    }
    const port = await getPort();

    const app = new Hono();
    const handler = createMcpHandler(async (server) => {
      server.tool('paidTool', 'Test tool', async () => ({
        content: [{ type: 'text', text: 'Hello, world!' }],
      }));
    });

    app.get('/', (c) => c.html('<h1>🚀 Fake MCP Server 2 is Live!</h1>'));
    app.use('*', async (c) => handler(c.req.raw));
    serve({ fetch: app.fetch, port });
    const origin = `http://localhost:${port}/mcp`;
    workerOrigin2Cache.set(idx, origin);
    await use(origin);
  },
});

export { expect };


