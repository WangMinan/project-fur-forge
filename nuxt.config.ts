import { fileURLToPath } from 'node:url'

const includeRuntimeErrorFixtures = (
  process.env.APP_ENV === 'test'
  || (
    process.env.APP_ENV !== 'production'
    && process.env.VITEST === 'true'
  )
)
const runtimeApiErrorFixture = fileURLToPath(
  new URL('./tests/fixtures/runtime/api-error.ts', import.meta.url),
).replaceAll('\\', '/')
const runtimePageErrorFixture = fileURLToPath(
  new URL('./tests/fixtures/runtime/page-error.vue', import.meta.url),
).replaceAll('\\', '/')
const embeddedFfmpegRuntime = fileURLToPath(
  new URL('./scripts/embedded-ffmpeg.mjs', import.meta.url),
).replaceAll('\\', '/')

export default defineNuxtConfig({
  compatibilityDate: '2026-07-28',
  css: [
    '~/assets/css/public-base.css',
    '~/assets/css/admin-base.css',
  ],
  devtools: {
    enabled: false,
  },
  modules: [
    '@nuxt/eslint',
    'nuxt-auth-utils',
  ],
  auth: {
    loadStrategy: 'none',
  },
  runtimeConfig: {
    session: {
      name: '__Host-fur-forge-session',
      password: 'development-only-session-secret-32-chars',
      maxAge: 8 * 60 * 60,
      cookie: {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
      },
    },
  },
  nitro: {
    errorHandler: './server/error.ts',
    externals: {
      inline: [embeddedFfmpegRuntime],
    },
    handlers: includeRuntimeErrorFixtures
      ? [
          {
            route: '/api/__test__/error',
            handler: runtimeApiErrorFixture,
          },
          {
            route: '/api/auth/__test__/error',
            handler: runtimeApiErrorFixture,
          },
        ]
      : [],
    preset: 'node-server',
  },
  hooks: includeRuntimeErrorFixtures
    ? {
        'pages:extend': (pages) => {
          pages.push({
            name: 'runtime-page-error-fixture',
            path: '/__test__/page-error',
            file: runtimePageErrorFixture,
          })
        },
      }
    : {},
  routeRules: {
    '/admin/**': {
      ssr: false,
      headers: {
        'x-robots-tag': 'noindex, nofollow, noarchive',
      },
    },
  },
  typescript: {
    strict: true,
    typeCheck: true,
  },
})
