import { fileURLToPath } from 'node:url'
import {
  $fetch,
  setup,
} from '@nuxt/test-utils/e2e'
import {
  describe,
  expect,
  it,
} from 'vitest'

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  browser: false,
  server: true,
})

describe('health endpoint', () => {
  it('returns the service readiness payload', async () => {
    await expect($fetch('/api/health')).resolves.toEqual({
      status: 'ok',
      service: 'project-fur-paws',
    })
  })
})
