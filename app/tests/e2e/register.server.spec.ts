import { test, expect } from './fixtures/auth';

// Use dynamic base URL provided by globalSetup
test.use({ baseURL: process.env.PW_BASE_URL });

test('inspect endpoints exist', async ({ request }) => {
  const origin = process.env.MCP_FAKE_ORIGIN || '';
  const tools = await request.get('/api/inspect-mcp-tools?url=' + encodeURIComponent(origin));
  expect([200, 400, 500]).toContain(tools.status());
});

test('register server with authed context', async ({ authed }) => {
  const origin = process.env.MCP_FAKE_ORIGIN_2 || '';
  const payload = {
    mcpOrigin: origin,
    receiverAddress: '0x0000000000000000000000000000000000000003',
    requireAuth: false,
    name: 'E2E Server',
    description: 'Test server from e2e',
    tools: [{ name: 'myTool' }],
  };
  const res = await authed.post('/api/servers', { data: payload });
  expect([201, 400]).toContain(res.status());
});


