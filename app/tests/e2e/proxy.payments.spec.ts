import { test, expect } from './fixtures/mcp-client';

// Use dynamic base URL provided by globalSetup
test.use({ baseURL: process.env.PW_BASE_URL });

test('get mcp tools via proxy', async ({ mcp }) => {
  const tools = await mcp.tools();
  expect(Object.keys(tools).length).toBeGreaterThan(0);
});

test('execute mcp tool via proxy', async ({ mcp }) => {
  const tools = await mcp.tools();

  const tool = tools.myTool;
  const result = await tool.execute({}, {messages: [], toolCallId: "test"});
  
  expect(result.content).toBe("Hello, world!");
});
