import { defineConfig } from '@playwright/test'

const baseURL = 'http://127.0.0.1:3100'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 30_000,
  use: {
    baseURL,
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev --host 0.0.0.0 --port 3100',
    env: {
      APP_ENV: 'test',
      PUBLIC_BASE_URL: baseURL,
      ADMIN_BASE_URL: 'http://localhost:3100',
      MEDIA_BASE_URL: 'https://media.test.invalid',
      OSS_UPLOAD_BASE_URL: 'https://upload.test.invalid',
    },
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
