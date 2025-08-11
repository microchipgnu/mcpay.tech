import { test as servers, expect } from './fixtures/servers';
import {experimental_createMCPClient} from "ai"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const test = servers.extend({});

// baseURL provided by infra fixture transitively

test("connect to mcp", async ({ request, mcpFakeOrigin }) => {
  const client = await experimental_createMCPClient({
    transport: new StreamableHTTPClientTransport(new URL(mcpFakeOrigin))
  })

  expect(client).toBeDefined();
});