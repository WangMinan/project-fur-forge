import { defineConfig } from '@playwright/test'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const baseURL = 'http://127.0.0.1:3100'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  // dev 服务器按页编译 Vue chunk，并行 worker 会放大首次编译延迟；串行执行换取确定性。
  workers: 1,
  timeout: 30_000,
  expect: {
    // CSR 页面在 dev 下需要等待 chunk 编译与水合。
    timeout: 10_000,
  },
  use: {
    baseURL,
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev --host 0.0.0.0 --port 3100',
    env: {
      APP_ENV: 'test',
      DATABASE_FILE: resolve(
        tmpdir(),
        `fur-forge-e2e-${process.pid}.db`,
      ),
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
