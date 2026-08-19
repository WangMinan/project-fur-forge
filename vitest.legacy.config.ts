import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { legacyTestFiles } from './tests/test-groups'

Object.assign(process.env, {
  APP_ENV: 'test',
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL ?? 'https://public.test.invalid',
  ADMIN_BASE_URL: process.env.ADMIN_BASE_URL ?? 'https://admin.test.invalid',
  MEDIA_BASE_URL: process.env.MEDIA_BASE_URL ?? 'https://media.test.invalid',
  OSS_UPLOAD_BASE_URL: process.env.OSS_UPLOAD_BASE_URL ?? 'https://upload.test.invalid',
})

export default defineConfig({
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: [...legacyTestFiles],
    testTimeout: 120_000,
  },
})
