// @ts-nocheck
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: 'tests/e2e',
  fullyParallel: true,
  timeout: 90_000,
  // Store all run artifacts (per-test output, traces, etc.) in a stable folder
  outputDir: 'tests/e2e/artifacts',
  // Reduce noisy interleaved console output; keep HTML for deep dives
  reporter: [
    ['line'],
    [require.resolve('./tests/e2e/utils/per-test-logs-reporter')],
    ['html', { open: 'never' }],
  ],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'main', use: { baseURL: process.env.PW_BASE_URL || 'http://localhost:3001' } },
  ],
  globalSetup: './tests/e2e/setup/globalSetup.ts',
  globalTeardown: './tests/e2e/setup/globalTeardown.ts',
};

export default config;


