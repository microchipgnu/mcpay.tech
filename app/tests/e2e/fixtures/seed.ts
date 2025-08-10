import { test as authTest, expect } from './auth';

type SeededServer = { id: string; serverId: string; mcpOrigin: string };

export const test = authTest.extend<{ seededServer: SeededServer }>({
  seededServer: async ({ authed, baseURL }, use) => {
    if (!baseURL) {
      throw new Error('baseURL is not set. Ensure tests call test.use({ baseURL: process.env.PW_BASE_URL }).');
    }

    const origin = process.env.MCP_FAKE_ORIGIN || '';
    if (!origin) {
      throw new Error('MCP_FAKE_ORIGIN is not set by globalSetup.');
    }

    const payload = {
      mcpOrigin: origin,
      receiverAddress: '0x0000000000000000000000000000000000000001',
      requireAuth: false,
      name: 'Fake MCP',
      description: 'Test server',
      tools: [{ name: 'myTool' }],
    };

    let server: SeededServer | undefined = undefined;

    try {
      const res = await authed.post('/api/servers', { data: payload });
      if (res.status() === 201) {
        const created = await res.json();
        if (created?.serverId) {
          server = { id: created.id, serverId: created.serverId, mcpOrigin: created.mcpOrigin };
        }
      }
    } catch {}

    if (!server) {
      const list = await authed.get('/api/servers?type=list&limit=50&offset=0');
      if (list.ok()) {
        try {
          const servers = await list.json();
          const match = Array.isArray(servers)
            ? servers.find((s: any) => s.mcpOrigin === origin)
            : undefined;
          if (match) {
            server = { id: match.id, serverId: match.serverId, mcpOrigin: match.mcpOrigin };
          }
        } catch {}
      }
    }

    if (!server) {
      throw new Error('Failed to ensure seeded server');
    }

    await use(server);
  },
});

export { expect };


