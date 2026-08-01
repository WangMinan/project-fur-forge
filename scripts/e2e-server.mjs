// E2E webServer：以生产构建产物启动，避免 dev 服务器按路由编译的抖动与延迟。
// 默认每次重建，防止过期产物造成假绿；显式复用已有产物时才允许跳过。
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const serverEntry = resolve(
  process.env.E2E_OUTPUT_DIR ?? '.output',
  'server/index.mjs',
)

if (process.env.E2E_SKIP_BUILD !== '1' || !existsSync(serverEntry)) {
  const build = spawnSync('pnpm', ['exec', 'nuxi', 'build'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, APP_ENV: 'test' },
  })
  if (build.status !== 0) {
    process.exit(build.status ?? 1)
  }
}

// Nitro node-server 产物在 import 时监听 PORT/HOST。
await import(pathToFileURL(serverEntry).href)
