import { spawnSync } from 'node:child_process'
import { pnpmInvocation } from './pnpm-invocation.mjs'

const verifyProductionOnHost
  = process.env.RELEASE_PRODUCTION_VERIFIED_BY_IMAGE !== '1'
const steps = [
  { args: ['notices:check'] },
  { args: ['test:smoke'], env: { APP_ENV: 'test' } },
  ...(verifyProductionOnHost
    ? [
        { args: ['build'], env: { APP_ENV: 'production' } },
        { args: ['verify:production'] },
      ]
    : []),
  { args: ['verify:esa-cache'] },
  { args: ['verify:observability'] },
]

for (const step of steps) {
  const invocation = pnpmInvocation(step.args)
  const result = spawnSync(invocation.command, invocation.args, {
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
