import { test as servers, expect } from './fixtures/servers';
import { experimental_createMCPClient } from "ai"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const test = servers.extend({});

// baseURL provided by infra fixture transitively

test("connect to mcp", async ({ mcpFakeOrigin }) => {
  const client = await experimental_createMCPClient({
    transport: new StreamableHTTPClientTransport(new URL(mcpFakeOrigin))
  })

  expect(client).toBeDefined();
});

// test("Paid tool without auth → 402 with {network, asset, amount} and facilitator URL by network (fallback works)", async ({ noAuthMcpClient }) => {
//   const tools = await noAuthMcpClient.tools();

//   const tool = tools.paidTool;
//   const result = await tool.execute({}, { messages: [], toolCallId: "test" });

//   expect(result.content).toEqual([{ "text": "Hello, world!", "type": "text" }]);
// });