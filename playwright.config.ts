import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // E2E test directory
  testDir: './tests/e2e',

  // Run against the static export served locally
  webServer: {
    command: 'npx serve out -p 3000',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  use: {
    baseURL: 'http://localhost:3000',
    // Collect trace on retry for debugging
    trace: 'on-first-retry',
  },

  // Run on Chromium as the minimum; Firefox and WebKit are optional
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // HTML reporter for CI artefact upload
  reporter: [['html', { open: 'never' }], ['list']],

  // Retry failed tests once in CI
  retries: process.env.CI ? 1 : 0,

  // Parallel test execution
  fullyParallel: true,

  // Fail the build on CI if tests are accidentally left in .only mode
  forbidOnly: !!process.env.CI,
});
