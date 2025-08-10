// @ts-nocheck
import type { FullConfig } from '@playwright/test';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { spawn, SpawnOptions } from 'node:child_process';
import getPort from 'get-port';
import path from 'node:path';
import dotenv from 'dotenv';
import { startFakeMcp } from '../servers/minimal-fake-mcp';
import { startFakeFacilitator } from '../servers/minimal-fake-facilitator';

let pg: StartedTestContainer, redis: StartedTestContainer;
let appProc1: any;
let mcpServer: { close: () => Promise<void> } | undefined;
let mcpServer2: { close: () => Promise<void> } | undefined;
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
    // Start disposable Postgres and Redis
    pg = await new GenericContainer('postgres:16')
        .withEnvironment({
            POSTGRES_USER: 'test',
            POSTGRES_PASSWORD: 'test',
            POSTGRES_DB: 'mcp_test',
        })
        .withExposedPorts(5432)
        .start();

    redis = await new GenericContainer('redis:7')
        .withExposedPorts(6379)
        .start();

    const DB_URL = `postgres://test:test@${pg.getHost()}:${pg.getMappedPort(5432)}/mcp_test`;
    const REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;

    const mcpPort = await getPort();
    const mcpPort2 = await getPort();
    const facilitatorPort = await getPort();
    const mcpayPort = await getPort();

    // Prepare common env first
    const useRealCDP = !!(
        process.env.CDP_API_KEY &&
        process.env.CDP_API_SECRET &&
        process.env.CDP_WALLET_SECRET
    );

    const envCommon = {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_URL: DB_URL,
        REDIS_URL,
        MCP_FAKE_ORIGIN: `http://localhost:${mcpPort}/mcp`,
        MCP_FAKE_ORIGIN_2: `http://localhost:${mcpPort2}/mcp`,
        BASE_SEPOLIA_FACILITATOR_URL: `http://localhost:${facilitatorPort}/base-sepolia`,
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
    } as NodeJS.ProcessEnv;

    console.log("ENV", envCommon);

    // Migrate + seed using the same env
    await run('node', ['scripts/drizzle-migrate.cjs'], envCommon);
    await run('tsx', ['scripts/seed.ts'], envCommon);

    const port1 = mcpayPort;
    const nextBin = path.join(process.cwd(), 'node_modules', '.bin', 'next');
    // Build once to ensure production server can start
    await run(nextBin, ['build'], envCommon);
    appProc1 = spawn(nextBin, ['start', '-p', String(port1)], { env: { ...envCommon }, stdio: 'inherit' });


    console.log("MCP PORT", mcpPort);
    console.log("FACILITATOR PORT", facilitatorPort);
    mcpServer = await startFakeMcp(mcpPort, `http://localhost:${mcpayPort}`);
    mcpServer2 = await startFakeMcp(mcpPort2, `http://localhost:${mcpayPort}`);
    facilitator = await startFakeFacilitator(facilitatorPort);

    // Share in process env for tests
    process.env.PW_DB_URL = DB_URL;
    process.env.PW_REDIS_URL = REDIS_URL;
    process.env.PW_BASE_URL = `http://localhost:${mcpayPort}`;
    process.env.MCP_FAKE_ORIGIN = `http://localhost:${mcpPort}/mcp`;
    process.env.MCP_FAKE_ORIGIN_2 = `http://localhost:${mcpPort2}/mcp`;
    process.env.BASE_SEPOLIA_FACILITATOR_URL = `http://localhost:${facilitatorPort}/base-sepolia`;
    process.env.SEI_TESTNET_FACILITATOR_URL = `http://localhost:${facilitatorPort}/sei-testnet`;
};

export async function teardown() {
    // Stop Next app first to avoid in-flight DB queries hitting closed Postgres
    try { appProc1?.kill(); } catch {}
    // Close fake servers
    try { await mcpServer?.close?.(); } catch {}
    try { await mcpServer2?.close?.(); } catch {}
    try { await facilitator?.close?.(); } catch {}
    // Stop infra containers last
    try { await pg?.stop(); } catch {}
    try { await redis?.stop(); } catch {}
}


