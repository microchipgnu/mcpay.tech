// @ts-nocheck
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: 'tests/e2e',
  fullyParallel: true,
  timeout: 90_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    { name: 'main', use: { baseURL: process.env.PW_BASE_URL || 'http://localhost:3001' } },
  ],
  globalSetup: './tests/e2e/setup/globalSetup.ts',
  globalTeardown: './tests/e2e/setup/globalTeardown.ts',
};

export default config;


