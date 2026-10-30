import { defineConfig } from '@playwright/test';

const CHROMIUM = '/usr/bin/chromium';

export default defineConfig({
  testDir: 'tests/e2e',
  reporter: 'list',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4321',
    launchOptions: { executablePath: CHROMIUM },
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4321',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
