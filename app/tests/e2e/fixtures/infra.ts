import { serve } from '@hono/node-server';
import { test as base, expect } from '@playwright/test';
import getPort from 'get-port';
import { Hono } from 'hono';
import { spawn, type SpawnOptions } from 'node:child_process';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

async function run(cmd: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const opts: SpawnOptions = { env, stdio: 'inherit', cwd: process.cwd() };
    const p = spawn(cmd, args, opts);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} -> ${code}`))));
  });
}

type InfraFixtures = {
  dbUrl: string;
  redisUrl: string;
  baseURL: string; // override Playwright option via fixture
  facilitator: string;
};

export const test = base.extend<InfraFixtures>({
  // Start a fresh Postgres per test and run migrations
  dbUrl: async ({}, use) => {
    const pg: StartedTestContainer = await new GenericContainer('postgres:16')
      .withEnvironment({
        POSTGRES_USER: 'test',
        POSTGRES_PASSWORD: 'test',
        POSTGRES_DB: 'mcp_test',
      })
      .withExposedPorts(5432)
      .start();

    const DB_URL = `postgres://test:test@${pg.getHost()}:${pg.getMappedPort(5432)}/mcp_test`;

    // Run migrations against this DB
    await run('node', ['scripts/drizzle-migrate.cjs'], { ...process.env, DATABASE_URL: DB_URL, NODE_ENV: 'test' });

    await use(DB_URL);

    try { await pg.stop(); } catch {}
  },

  // Start a fresh Redis per test
  redisUrl: async ({}, use) => {
    const redis: StartedTestContainer = await new GenericContainer('redis:7')
      .withExposedPorts(6379)
      .start();

    const REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;
    await use(REDIS_URL);
    try { await redis.stop(); } catch {}
  },

  facilitator: async ({}, use) => {
    const facilitatorPort = await getPort();
    async function startFakeFacilitator(port: number) {
      const app = new Hono();
    
      // In-memory replay protection across calls
      const seenNonces = new Set<string>();
      const toBigIntOrZero = (value: unknown): bigint => {
        try {
          if (typeof value === 'bigint') return value;
          if (typeof value === 'number') return BigInt(Math.floor(value));
          if (typeof value === 'string') return BigInt(value);
        } catch {}
        return 0n;
      };
    
      app.get('/verify', (c) =>
        c.json({
          endpoint: '/verify',
          description: 'POST to verify x402 payments',
          body: { paymentPayload: 'PaymentPayload', paymentRequirements: 'PaymentRequirements' },
        }),
      );
    
      app.post('/verify', async (c) => {
        try {
          const body: any = await c.req.json();
          const paymentPayload = body?.paymentPayload ?? {};
          const reqsRaw = body?.paymentRequirements;
          const reqs = Array.isArray(reqsRaw) ? reqsRaw : [reqsRaw];

          const maxAmount = toBigIntOrZero(reqs?.[0]?.maxAmountRequired);
          const sent = toBigIntOrZero(paymentPayload?.payload?.authorization?.value);
          const nonce = paymentPayload?.payload?.authorization?.nonce ?? '0x00';

          if (sent < maxAmount) {
            return c.json({ isValid: false, invalidReason: 'underpayment' });
          }
          if (seenNonces.has(nonce)) {
            return c.json({ isValid: false, invalidReason: 'replay' });
          }

          return c.json({ isValid: true });
        } catch {
          return c.json({ isValid: false, invalidReason: 'invalid_request' });
        }
      });
    
      app.get('/settle', (c) =>
        c.json({
          endpoint: '/settle',
          description: 'POST to settle x402 payments',
          body: { paymentPayload: 'PaymentPayload', paymentRequirements: 'PaymentRequirements' },
        }),
      );
    
      app.get('/supported', (c) =>
        c.json({
          kinds: [
            {
              x402Version: 1,
              scheme: 'exact',
              network: 'base-sepolia',
            },
          ],
        }),
      );
    
      app.post('/settle', async (c) => {
        try {
          const body: any = await c.req.json();
          const paymentPayload = body?.paymentPayload ?? {};
          const nonce = paymentPayload?.payload?.authorization?.nonce ?? '0x00';
          const network = body?.paymentRequirements?.network ?? 'base-sepolia';
          if (seenNonces.has(nonce)) {
            const txHash =
              '0x' + Buffer.from(String(nonce)).toString('hex').slice(0, 64).padEnd(64, '0');
            return c.json({ success: false, errorReason: 'replay', transaction: txHash, network });
          }
          seenNonces.add(nonce);

          const txHash =
            '0x' + Buffer.from(String(nonce)).toString('hex').slice(0, 64).padEnd(64, '0');
          return c.json({ success: true, transaction: txHash, network });
        } catch {
          return c.json({ success: false, errorReason: 'invalid_request', transaction: '0x0', network: 'base-sepolia' });
        }
      });
    
      serve({ fetch: app.fetch, port });
    
      return {
        close: async () => {
          /* no-op */
        },
      } as const;
    }

    const facilitator = await startFakeFacilitator(facilitatorPort);

    const localFacilitatorUrl = `http://localhost:${facilitatorPort}`;

    await use(localFacilitatorUrl);
    try { await facilitator.close(); } catch {}
  },

  // Start Next server bound to the test's DB/Redis and expose as baseURL
  baseURL: async ({ dbUrl, redisUrl, facilitator }, use) => {
    const port = await getPort();

    const envForApp: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: dbUrl,
      REDIS_URL: redisUrl,
      // Route all networks to the local fake facilitator
      BASE_SEPOLIA_FACILITATOR_URL: facilitator,
      SEI_TESTNET_FACILITATOR_URL: facilitator,
      FACILITATOR_URL: facilitator,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'test_secret',
      GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || 'fake',
      GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || 'fake',
      CDP_API_KEY: process.env.CDP_API_KEY || 'fake',
      CDP_API_SECRET: process.env.CDP_API_SECRET || 'fake',
      CDP_WALLET_SECRET: process.env.CDP_WALLET_SECRET || 'fake',
      KV_REST_API_URL: process.env.KV_REST_API_URL || 'https://kv.local',
      KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN || 'fake',
      TEST_EVM_PRIVATE_KEY: process.env.TEST_EVM_PRIVATE_KEY || '0x1234567890abcdef...',
      TEST_EVM_ADDRESS: process.env.TEST_EVM_ADDRESS || '0x1234567890abcdef...',
      TEST_SOLANA_SECRET_KEY: process.env.TEST_SOLANA_SECRET_KEY || '0x1234567890abcdef...',
      TEST_SOLANA_ADDRESS: process.env.TEST_SOLANA_ADDRESS || '0x1234567890abcdef...',
      TEST_NEAR_PRIVATE_KEY: process.env.TEST_NEAR_PRIVATE_KEY || '0x1234567890abcdef...',
      TEST_NEAR_ADDRESS: process.env.TEST_NEAR_ADDRESS || '0x1234567890abcdef...',
    };

    const nextBin = 'node_modules/.bin/next';
    const appProc = spawn(nextBin, ['start', '-p', String(port)], { env: envForApp, stdio: 'inherit' });

    // Simple readiness wait with retries
    const url = `http://localhost:${port}`;
    const ok = await (async () => {
      for (let i = 0; i < 60; i++) {
        try {
          const res = await fetch(url, { method: 'GET' });
          if (res.ok || res.status === 200) return true;
        } catch {}
        await new Promise((r) => setTimeout(r, 500));
      }
      return false;
    })();

    if (!ok) {
      try { appProc.kill(); } catch {}
      throw new Error('Next app did not become ready in time');
    }

    await use(url);

    try { appProc.kill(); } catch {}
  },
});

export { expect };


