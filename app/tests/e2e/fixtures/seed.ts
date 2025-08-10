import { test as authTest, expect } from './auth';

type SeededServer = { id: string; serverId: string };

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
      mcpOrigin: `${origin}?random=${Math.random().toString(36).slice(2)}`,
      receiverAddress: '0x0000000000000000000000000000000000000001',
      requireAuth: false,
      name: 'Fake MCP',
      description: 'Test server',
      tools: [{ 
        name: 'myTool', 
        pricing: [{ 
          id: '1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          maxAmountRequiredRaw: '100', // 0.0001 USDC
          tokenDecimals: 6, 
          network: 'base-sepolia', 
          assetAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', 
          active: true 
        }] 
      }],
    };

    let server: SeededServer | undefined = undefined;

    // First: check if server already exists (idempotent)
    try {
      const byOrigin = await authed.get('/api/servers/find?mcpOrigin=' + encodeURIComponent(payload.mcpOrigin));
      if (byOrigin.ok()) {
        const s = await byOrigin.json();
        if (s?.serverId) {
          server = { id: s.id, serverId: s.serverId };
        }
      }
    } catch {}

    // If not found, attempt to create
    if (!server) {
      try {
        const res = await authed.post('/api/servers', { data: payload });
        if (res.ok()) {
          const created = await res.json();
          if (created?.serverId) {
            server = { id: created.id, serverId: created.serverId };
          }
        }
      } catch {}
    }

    // Final fallback: re-check by origin
    if (!server) {
      try {
        const byOrigin = await authed.get('/api/servers/find?mcpOrigin=' + encodeURIComponent(payload.mcpOrigin));
        if (byOrigin.ok()) {
          const s = await byOrigin.json();
          if (s?.serverId) {
            server = { id: s.id, serverId: s.serverId };
          }
        }
      } catch {}
    }

    if (!server) {
      throw new Error('Failed to ensure seeded server');
    }

    await use(server);

    // Delete using serverId (API currently deletes by serverId, not DB id)
    // await authed.delete(`/api/servers/${server.serverId}`);
  },
});

export { expect };


