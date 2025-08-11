// @ts-nocheck
import type { FullConfig } from '@playwright/test';
import { spawn, SpawnOptions } from 'node:child_process';
import getPort from 'get-port';
import path from 'node:path';
import dotenv from 'dotenv';
import { startFakeFacilitator } from '../fixtures/fake-facilitator';

// No global Next server; per-test servers are started in fixtures
let facilitator: { close: () => Promise<void> } | undefined;

async function run(cmd: string, args: string[], env: NodeJS.ProcessEnv) {
    return new Promise<void>((resolve, reject) => {
        const opts: SpawnOptions = { env, stdio: 'inherit', cwd: process.cwd() };
        const p = spawn(cmd, args, opts);
        p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} -> ${code}`))));
    });
}

export default async (_cfg: FullConfig) => {
    // Load testing env vars from .env.test (if present)
    try {
        const envPath = path.join(process.cwd(), '.env.test');
        dotenv.config({ path: envPath });
    } catch {}
    const facilitatorPort = await getPort();
    // Next.js is built once; per-test servers are started by fixtures

    const envCommon = {
        ...process.env,
        NODE_ENV: 'test',
        // DATABASE_URL and REDIS_URL are provided per-test by fixtures
        // MCP origins are now provided by worker-scoped fixtures
        BASE_SEPOLIA_FACILITATOR_URL: `https://x402.org/facilitator`,
        SEI_TESTNET_FACILITATOR_URL: `http://localhost:${facilitatorPort}/sei-testnet`,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'test_secret',
        GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || 'fake',
        GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || 'fake',
        CDP_API_KEY: process.env.CDP_API_KEY || 'fake',
        CDP_API_SECRET: process.env.CDP_API_SECRET || 'fake',
        CDP_WALLET_SECRET: process.env.CDP_WALLET_SECRET || 'fake',
        KV_REST_API_URL: process.env.KV_REST_API_URL || 'https://kv.local',
        KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN || 'fake',
        FACILITATOR_URL: `http://localhost:${facilitatorPort}`,
        TEST_EVM_PRIVATE_KEY: process.env.TEST_EVM_PRIVATE_KEY || '0x1234567890abcdef...',
        TEST_EVM_ADDRESS: process.env.TEST_EVM_ADDRESS || '0x1234567890abcdef...',
        TEST_SOLANA_SECRET_KEY: process.env.TEST_SOLANA_SECRET_KEY || '0x1234567890abcdef...',
        TEST_SOLANA_ADDRESS: process.env.TEST_SOLANA_ADDRESS || '0x1234567890abcdef...',
        TEST_NEAR_PRIVATE_KEY: process.env.TEST_NEAR_PRIVATE_KEY || '0x1234567890abcdef...',
        TEST_NEAR_ADDRESS: process.env.TEST_NEAR_ADDRESS || '0x1234567890abcdef...',
    } as NodeJS.ProcessEnv;

    const nextBin = path.join(process.cwd(), 'node_modules', '.bin', 'next');
    // Build once to ensure production servers (started by fixtures) can start
    await run(nextBin, ['build'], envCommon);

    facilitator = await startFakeFacilitator(facilitatorPort);

    process.env.BASE_SEPOLIA_FACILITATOR_URL = `https://x402.org/facilitator`;
    process.env.SEI_TESTNET_FACILITATOR_URL = `http://localhost:${facilitatorPort}/sei-testnet`;
    process.env.TEST_EVM_PRIVATE_KEY = process.env.TEST_EVM_PRIVATE_KEY || '0x1234567890abcdef...';
    process.env.TEST_EVM_ADDRESS = process.env.TEST_EVM_ADDRESS || '0x1234567890abcdef...';
};

export async function teardown() {
    // Close fake servers
    try { await facilitator?.close?.(); } catch {}
    // DB/Redis are managed per-test by fixtures
}


