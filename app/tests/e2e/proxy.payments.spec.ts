import { test, expect } from '@playwright/test';
// import {experimental_createMCPClient} from "ai"
// import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Use dynamic base URL provided by globalSetup
test.use({ baseURL: process.env.PW_BASE_URL });

test('proxy returns 200 from fake upstream for GET (no payment enforcement on GET)', async ({ request }) => {
  // This assumes a server record exists for id "test-server" pointing to fake MCP.
  // In the seed we will create one; if not present, expect 404.
  const res = await request.get('/mcp/test-server/tools/myTool');
  if (res.status() === 404) {
    test.fixme(true, 'Seed not present yet');
    return;
  }
  // Our proxy currently enforces x402 only when a paid tool call is detected (POST tools/call).
  // For simple GET, upstream should succeed.
  expect(res.status()).toBe(200);
});


// test("connect to fake mcp", async ({ request }) => {
//   const client = await experimental_createMCPClient({
//     transport: new StreamableHTTPClientTransport(new URL(process.env.MCP_FAKE_ORIGIN || ''))
//   })

//   expect(client).toBeDefined();
// });