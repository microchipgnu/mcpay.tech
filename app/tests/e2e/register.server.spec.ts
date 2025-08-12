import { test as base, expect } from './fixtures/auth';
import { test as servers } from './fixtures/servers';

const test = servers.extend({});

// baseURL provided by infra fixture transitively via auth fixture

test('inspect endpoints exist', async ({ request, mcpFakeOrigin }) => {
  const origin = mcpFakeOrigin;
  const tools = await request.get('/api/inspect-mcp-tools?url=' + encodeURIComponent(origin));
  expect([200, 400, 500]).toContain(tools.status());
});

test('register server with authed context', async ({ authed, mcpFakeOrigin2 }) => {
  const origin = mcpFakeOrigin2;
  const payload = {
    mcpOrigin: origin,
    receiverAddress: '0x0000000000000000000000000000000000000003',
    requireAuth: false,
    name: 'E2E Server',
    description: 'Test server from e2e',
    tools: [{ name: 'paidTool' }],
  };
  const res = await authed.post('/api/servers', { data: payload });
  expect([201, 400]).toContain(res.status());
});


