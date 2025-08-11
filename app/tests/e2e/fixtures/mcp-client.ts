import { test as base, expect } from '@playwright/test';
import { test as seedTest } from './seed';
import { experimental_createMCPClient } from 'ai';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createPaymentTransport} from "mcpay/client"
import { privateKeyToAccount } from "viem/accounts"

type MCPClient = Awaited<ReturnType<typeof experimental_createMCPClient>>;

export const test = seedTest.extend<{ noAuthMcpClient: MCPClient, privateKeyMcpClient: MCPClient, authedMcpClient: MCPClient }>({
  noAuthMcpClient: async ({ baseURL, seededServer }, use) => {
    if (!baseURL) {
      throw new Error('baseURL is not set. Ensure infra fixture is applied.');
    }

    const origin = new URL(`/mcp/${seededServer.serverId}`, baseURL);
    const transport = new StreamableHTTPClientTransport(origin);
    const client = await experimental_createMCPClient({ transport });

    await use(client);
    // No explicit teardown required for StreamableHTTPClientTransport
  },
  privateKeyMcpClient: async ({ baseURL, seededServer }, use) => {
    if (!baseURL) {
      throw new Error('baseURL is not set. Ensure infra fixture is applied.');
    }
    if (!process.env.TEST_EVM_PRIVATE_KEY) {
      throw new Error('TEST_EVM_PRIVATE_KEY is not set. Ensure test env is configured.');
    }

    const account = privateKeyToAccount(process.env.TEST_EVM_PRIVATE_KEY as `0x${string}`)
    const origin = new URL(`/mcp/${seededServer.serverId}`, baseURL);
    const transport = createPaymentTransport(origin, account)
    const client = await experimental_createMCPClient({ transport });

    await use(client);
    // No explicit teardown required for StreamableHTTPClientTransport
  },
  authedMcpClient: async ({ baseURL, authedWithApiKeyAndFunds, seededServer }, use) => {
    if (!baseURL) {
      throw new Error('baseURL is not set. Ensure infra fixture is applied.');
    }

    const origin = new URL(`/mcp/${seededServer.serverId}`, baseURL);
    // Pull the cookie header out of the authed context. Playwright does not expose headers directly,
    // so we read cookies for this origin and build a Cookie header string.
    // const cookies = await authedWithApiKeyAndFunds.request.storageState();
    // const cookieHeader = cookies.cookies
    //   .filter(c => {
    //     // Match cookies for our baseURL origin
    //     try {
    //       const u = new URL(baseURL);
    //       return c.domain === u.hostname || c.domain === '.' + u.hostname;
    //     } catch {
    //       return false;
    //     }
    //   })
    //   .map(c => `${c.name}=${c.value}`)
    //   .join('; ');

    const transport = new StreamableHTTPClientTransport(origin, {
      requestInit: {
        headers: {
          // ...(cookieHeader ? { cookie: cookieHeader } : {}),
          // 'x-wallet-provider': 'coinbase-cdp',
          // 'x-wallet-type': 'managed',
          'x-api-key': authedWithApiKeyAndFunds.apiKey,
        },
        credentials: 'include',
      },
    });
    const client = await experimental_createMCPClient({ transport });

    await use(client);
    // No explicit teardown required for StreamableHTTPClientTransport
  },

});

export { expect };

export type { MCPClient };


