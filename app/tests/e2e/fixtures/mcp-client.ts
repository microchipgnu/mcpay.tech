import { test as base, expect } from '@playwright/test';
import { test as seedTest } from './seed';
import { experimental_createMCPClient } from 'ai';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createPaymentTransport} from "mcpay/client"
import { privateKeyToAccount } from "viem/accounts"

type MCPClient = Awaited<ReturnType<typeof experimental_createMCPClient>>;

export const test = seedTest.extend<{ noAuthMcpClient: MCPClient, privateKeyMcpClient: MCPClient }>({
  noAuthMcpClient: async ({ baseURL, seededServer }, use) => {
    if (!baseURL) {
      throw new Error('baseURL is not set. Ensure tests call test.use({ baseURL: process.env.PW_BASE_URL }).');
    }

    const origin = new URL(`/mcp/${seededServer.serverId}`, baseURL);
    const transport = new StreamableHTTPClientTransport(origin);
    const client = await experimental_createMCPClient({ transport });

    await use(client);
    // No explicit teardown required for StreamableHTTPClientTransport
  },
  privateKeyMcpClient: async ({ baseURL, seededServer }, use) => {
    if (!baseURL) {
      throw new Error('baseURL is not set. Ensure tests call test.use({ baseURL: process.env.PW_BASE_URL }).');
    }
    if (!process.env.TEST_ACCOUNT_PRIVATE_KEY) {
      throw new Error('TEST_ACCOUNT_PRIVATE_KEY is not set. Ensure globalSetup started the fake MCP server.');
    }

    const account = privateKeyToAccount(process.env.TEST_ACCOUNT_PRIVATE_KEY as `0x${string}`)
    const origin = new URL(`/mcp/${seededServer.serverId}`, baseURL);
    const transport = createPaymentTransport(origin, account)
    const client = await experimental_createMCPClient({ transport });

    await use(client);
    // No explicit teardown required for StreamableHTTPClientTransport
  },
});

export { expect };

export type { MCPClient };


