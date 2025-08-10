import { test, expect } from './fixtures/mcp-client';

// Use dynamic base URL provided by globalSetup
test.use({ baseURL: process.env.PW_BASE_URL });

test('get mcp tools via proxy', async ({ noAuthMcpClient }) => {
  const tools = await noAuthMcpClient.tools();
  expect(Object.keys(tools).length).toBeGreaterThan(0);
});

test('fail at executing mcp tool via proxy', async ({ noAuthMcpClient }) => {
  test.fail(true, 'Mock tool response is intentionally mismatched for this test');

  const tools = await noAuthMcpClient.tools();

  const tool = tools.myTool;
  const result = await tool.execute({}, {messages: [], toolCallId: "test"});

  expect(result.content).toBe("Expected failure - mock response won't match");
});

test('execute mcp tool via proxy with private key', async ({ privateKeyMcpClient }) => {
  const tools = await privateKeyMcpClient.tools();

  const tool = tools.myTool;
  const result = await tool.execute({}, {messages: [], toolCallId: "test"});

  expect(result.content).toEqual([{"text": "Hello, world!", "type": "text"}]);
});

test('execute mcp tool via proxy with authed client', async ({ authedMcpClient }) => {
  const tools = await authedMcpClient.tools();

  const tool = tools.myTool;
  const result = await tool.execute({}, {messages: [], toolCallId: "test"});

  expect(result.content).toEqual([{"text": "Hello, world!", "type": "text"}]);
});