import { expect } from './auth';
import { test as serversTest } from './servers';

type SeededServer = { id: string; serverId: string };

export const test = serversTest.extend<{ seededServer: SeededServer }>({
  seededServer: async ({ authed, baseURL, mcpFakeOrigin }, use) => {
    if (!baseURL) {
      throw new Error('baseURL is not set. Ensure infra fixture is applied.');
    }

    const origin = mcpFakeOrigin;

    const payload = {
      mcpOrigin: `${origin}?random=${Math.random().toString(36).slice(2)}`,
      receiverAddress: '0x0000000000000000000000000000000000000001',
      requireAuth: false,
      name: 'Fake MCP',
      description: 'Test server',
      tools: [{ 
        name: 'paidTool', 
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


