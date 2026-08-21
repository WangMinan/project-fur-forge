import { defineConfig } from '@playwright/test'

process.env.E2E_SMOKE = '1'
const { default: base } = await import('./playwright.config')

export default defineConfig({
  ...base,
  testDir: './tests/smoke',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    ...base.use,
    trace: 'retain-on-failure',
  },
})
