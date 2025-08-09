import { test, expect } from '@playwright/test';

// Use dynamic base URL provided by globalSetup
test.use({ baseURL: process.env.PW_BASE_URL });

test('inspect endpoints exist', async ({ request }) => {
  const origin = process.env.MCP_FAKE_ORIGIN || '';
  const tools = await request.get('/api/inspect-mcp-tools?url=' + encodeURIComponent(origin + '/mcp'));
  expect([200, 400, 500]).toContain(tools.status());
});


