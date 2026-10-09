import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  timeout: 120000,
  workers: 1,
  fullyParallel: false,
  use: { baseURL: 'http://localhost:3000', headless: true, trace: 'retain-on-failure' },
  reporter: 'list',
});
