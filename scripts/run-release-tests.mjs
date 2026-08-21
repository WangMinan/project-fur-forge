import { spawnSync } from 'node:child_process'

const pnpmCli = process.env.npm_execpath
if (!pnpmCli) {
  throw new Error('pnpm did not provide npm_execpath to the release test runner.')
}
const steps = [
  { args: ['notices:check'] },
  { args: ['test:smoke'], env: { APP_ENV: 'test' } },
  { args: ['build'], env: { APP_ENV: 'production' } },
  { args: ['verify:production'] },
  { args: ['verify:esa-cache'] },
  { args: ['verify:observability'] },
]

for (const step of steps) {
  const result = spawnSync(process.execPath, [pnpmCli, ...step.args], {
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
