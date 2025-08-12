// @ts-nocheck
import type { FullConfig } from '@playwright/test';
import { spawn, SpawnOptions } from 'node:child_process';
import path from 'node:path';
import dotenv from 'dotenv';

// No global servers; per-test servers are started in fixtures

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
    // Next.js is built once; per-test servers are started by fixtures

    const envCommon = {
        ...process.env,
        NODE_ENV: 'test',
        // DATABASE_URL and REDIS_URL are provided per-test by fixtures
        // Facilitator URLs are provided per-test by fixtures
        BASE_SEPOLIA_FACILITATOR_URL: `https://x402.org/facilitator`,
        SEI_TESTNET_FACILITATOR_URL: `https://6y3cdqj5s3.execute-api.us-west-2.amazonaws.com/prod`,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || 'test_secret',
        GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || 'fake',
        GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || 'fake',
        CDP_API_KEY: process.env.CDP_API_KEY || 'fake',
        CDP_API_SECRET: process.env.CDP_API_SECRET || 'fake',
        CDP_WALLET_SECRET: process.env.CDP_WALLET_SECRET || 'fake',
        KV_REST_API_URL: process.env.KV_REST_API_URL || 'https://kv.local',
        KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN || 'fake',
        FACILITATOR_URL: `https://x402.org/facilitator`,
        TEST_EVM_PRIVATE_KEY: process.env.TEST_EVM_PRIVATE_KEY || '0x9de0c4a9556763137ba1a6614569f9a12e3117801a909fe8f51c96596a54870a',
        TEST_EVM_ADDRESS: process.env.TEST_EVM_ADDRESS || '0x422F7928F15EBb4904d3A33775F2eBFc82B5f29A',
        TEST_SOLANA_SECRET_KEY: process.env.TEST_SOLANA_SECRET_KEY || '0x1234567890abcdef...',
        TEST_SOLANA_ADDRESS: process.env.TEST_SOLANA_ADDRESS || '0x1234567890abcdef...',
        TEST_NEAR_PRIVATE_KEY: process.env.TEST_NEAR_PRIVATE_KEY || '0x1234567890abcdef...',
        TEST_NEAR_ADDRESS: process.env.TEST_NEAR_ADDRESS || '0x1234567890abcdef...',
    } as NodeJS.ProcessEnv;

    const nextBin = path.join(process.cwd(), 'node_modules', '.bin', 'next');
    // Build once to ensure production servers (started by fixtures) can start
    await run(nextBin, ['build'], envCommon);

    process.env.BASE_SEPOLIA_FACILITATOR_URL = `https://x402.org/facilitator`;
    process.env.SEI_TESTNET_FACILITATOR_URL = `https://6y3cdqj5s3.execute-api.us-west-2.amazonaws.com/prod`;
    process.env.TEST_EVM_PRIVATE_KEY = process.env.TEST_EVM_PRIVATE_KEY || '0x9de0c4a9556763137ba1a6614569f9a12e3117801a909fe8f51c96596a54870a';
    process.env.TEST_EVM_ADDRESS = process.env.TEST_EVM_ADDRESS || '0x422F7928F15EBb4904d3A33775F2eBFc82B5f29A';
};

export async function teardown() {
    // DB/Redis are managed per-test by fixtures
}


