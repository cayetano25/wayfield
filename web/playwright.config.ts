import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    actionTimeout: 8000,
  },
  projects: [
    { name: 'guest', use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/guest.json' } },
    { name: 'owner', use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/owner.json' } },
    { name: 'participant', use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/participant.json' } },
    { name: 'leader', use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/leader.json' } },
    { name: 'staff', use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/staff.json' } },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'], storageState: 'e2e/.auth/guest.json' },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], storageState: 'e2e/.auth/guest.json' },
    },
  ],
});
