import 'dotenv/config';
import db from '@/lib/gateway/db';
import { mcpServers, mcpTools, users, userWallets } from '@/lib/gateway/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

async function main() {
  const serverId = 'test-server';
  const origin = process.env.MCP_FAKE_ORIGIN || 'http://localhost:4000';

  // Ensure a dummy user for API-key-less ops (not used yet)
  let [user] = await db.select().from(users).where(eq(users.email, 'e2e@example.com'));
  if (!user) {
    [user] = await db.insert(users).values({
      id: randomUUID(),
      email: 'e2e@example.com',
      name: 'E2E',
      displayName: 'E2E',
    }).returning();
  }

  // Ensure a server pointing at fake MCP
  const existing = await db.select().from(mcpServers).where(eq(mcpServers.serverId, serverId));
  if (existing.length === 0) {
    const [server] = await db.insert(mcpServers).values({
      serverId,
      mcpOrigin: origin,
      receiverAddress: '0x0000000000000000000000000000000000000001',
      creatorId: user.id,
      name: 'Fake MCP',
      description: 'Test server',
      requireAuth: false,
    }).returning();

    await db.insert(mcpTools).values({
      serverId: server.id,
      name: 'myTool',
      description: 'Test tool',
      inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
      isMonetized: true,
      pricing: [
        {
          id: randomUUID(),
          maxAmountRequiredRaw: '50000',
          tokenDecimals: 6,
          network: 'base-sepolia',
          assetAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
  }

  // // Ensure a wallet row for the user so auto-sign can pick it later if needed
  // const wallets = await db.select().from(userWallets).where(eq(userWallets.userId, user.id));
  // if (wallets.length === 0) {
  //   await db.insert(userWallets).values({
  //     userId: user.id,
  //     walletAddress: '0x0000000000000000000000000000000000000002',
  //     walletType: 'external',
  //     provider: 'unknown',
  //     blockchain: 'ethereum',
  //     architecture: 'evm' as any,
  //     isPrimary: true,
  //   });
  // }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});


