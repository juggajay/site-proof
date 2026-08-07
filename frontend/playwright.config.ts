import { defineConfig, devices } from '@playwright/test';

// Avoid screenshot timeouts when browser font readiness stalls during QA evidence capture.
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY ??= '1';

// Overridable so parallel worktrees can run their own dev server instead of
// silently reusing (and testing) another checkout's server on 5174. CI and the
// default local flow are unchanged.
const PORT = process.env.CIVOS_E2E_PORT ? Number(process.env.CIVOS_E2E_PORT) : 5174;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.PLAYWRIGHT_WORKERS ? Number(process.env.PLAYWRIGHT_WORKERS) : 1,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
