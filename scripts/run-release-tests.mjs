import { spawnSync } from 'node:child_process'

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const steps = [
  { args: ['test:smoke'], env: { APP_ENV: 'test' } },
  { args: ['build'], env: { APP_ENV: 'production' } },
  { args: ['verify:production'] },
  { args: ['verify:esa-cache'] },
  { args: ['verify:observability'] },
]

for (const step of steps) {
  const result = spawnSync(pnpm, step.args, {
    env: { ...process.env, ...step.env },
    shell: false,
    stdio: 'inherit',
  })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const scan = spawnSync(process.execPath, ['scripts/ci-secret-scan.mjs'], {
  env: process.env,
  shell: false,
  stdio: 'inherit',
})
if (scan.error) {
  throw scan.error
}
process.exit(scan.status ?? 1)
