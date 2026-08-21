import { defineConfig } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { basename, resolve } from 'node:path'

const inheritedPort = Number(process.env.E2E_PORT)
const inheritRun = Boolean(process.env.E2E_RUN_DIRECTORY)
  && Number.isInteger(inheritedPort)
  && inheritedPort > 0
  && inheritedPort < 65_536
const port = inheritRun
  ? inheritedPort
  : await new Promise<number>((resolvePort, reject) => {
      const server = createServer()
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        if (!address || typeof address === 'string') {
          server.close()
          reject(new Error('Playwright failed to allocate an E2E port.'))
          return
        }
        server.close(error => error ? reject(error) : resolvePort(address.port))
      })
    })
const runDirectory = inheritRun
  ? process.env.E2E_RUN_DIRECTORY!
  : mkdtempSync(resolve(tmpdir(), 'fur-forge-e2e-'))
const runName = basename(runDirectory)
const databaseFile = resolve(runDirectory, 'database.db')
const baseURL = `http://127.0.0.1:${port}`
const adminBaseURL = `http://localhost:${port}`
const mediaBaseURL = `http://127.0.0.2:${port}`
const smokeRun = process.env.E2E_SMOKE === '1'

Object.assign(process.env, {
  E2E_ADMIN_BASE_URL: adminBaseURL,
  E2E_DATABASE_FILE: databaseFile,
  E2E_PUBLIC_BASE_URL: baseURL,
  E2E_PORT: String(port),
  E2E_RUN_DIRECTORY: runDirectory,
})

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/setup/global-setup.ts',
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
    // 生产构建产物：dev 服务器按页/按路由编译，串行套件下首击抖动大；
    // 构建一次约 80s，换来 128 例的确定性页面加载。E2E_SKIP_BUILD=1 可跳过重建。
    command: smokeRun
      ? `pnpm dev --host 0.0.0.0 --port ${port}`
      : 'node scripts/e2e-server.mjs',
    env: {
      APP_ENV: 'test',
      DATABASE_FILE: databaseFile,
      E2E_BUILD_DIR: `.cache/e2e-build/${runName}`,
      E2E_OUTPUT_DIR: `.cache/e2e-output/${runName}`,
      PUBLIC_BASE_URL: baseURL,
      ADMIN_BASE_URL: adminBaseURL,
      MEDIA_BASE_URL: mediaBaseURL,
      OSS_UPLOAD_BASE_URL: 'https://upload.test.invalid',
      ICP_FILING_NUMBER: '浙ICP备2026062899号',
      ICP_FILING_URL: 'https://beian.miit.gov.cn/#/Integrated/index',
      POLICE_FILING_STATUS: 'filed',
      POLICE_FILING_NUMBER: '浙公网安备33010202006082号',
      POLICE_FILING_URL: 'https://beian.mps.gov.cn/#/query/webSearch?code=33010202006082',
      PORT: String(port),
      HOST: '0.0.0.0',
    },
    // 等的是"进程能响应"，不是"数据库就绪"：夹具库由 globalSetup 迁移，
    // 而 webServer 先于 globalSetup 启动。T34-F6 之后 /api/health 会诚实地在
    // 未就绪时返回 503，因此这里必须用 liveness 端点。
    url: `${baseURL}/api/health/live`,
    reuseExistingServer: false,
    // 含一次冷构建（约 80s）的启动预算。
    timeout: smokeRun ? 120_000 : 300_000,
  },
})
