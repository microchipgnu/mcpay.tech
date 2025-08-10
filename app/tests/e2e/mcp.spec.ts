import { test, expect } from '@playwright/test';
import {experimental_createMCPClient} from "ai"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Use dynamic base URL provided by globalSetup
test.use({ baseURL: process.env.PW_BASE_URL });

test("connect to fake mcp", async ({ request }) => {
  const client = await experimental_createMCPClient({
    transport: new StreamableHTTPClientTransport(new URL(process.env.MCP_FAKE_ORIGIN || ''))
  })

  expect(client).toBeDefined();
});