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
const e2eFakeOssPutFixture = fileURLToPath(
  new URL('./tests/fixtures/runtime/e2e-fake-oss-put.ts', import.meta.url),
).replaceAll('\\', '/')
const e2eFakeMediaControlFixture = fileURLToPath(
  new URL('./tests/fixtures/runtime/e2e-fake-media-control.ts', import.meta.url),
).replaceAll('\\', '/')
const e2eFakeMediaPlugin = fileURLToPath(
  new URL('./tests/fixtures/runtime/e2e-fake-media-plugin.ts', import.meta.url),
).replaceAll('\\', '/')
const e2eBuildDir = process.env.E2E_BUILD_DIR
const e2eOutputDir = process.env.E2E_OUTPUT_DIR

export default defineNuxtConfig({
  ...(e2eBuildDir ? { buildDir: e2eBuildDir } : {}),
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
  app: {
    head: {
      link: [
        {
          rel: 'icon',
          type: 'image/png',
          href: '/brand/logo-full-dark.png',
        },
      ],
    },
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
    ...(e2eOutputDir ? { output: { dir: e2eOutputDir } } : {}),
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
          {
            route: '/api/e2e-fake-oss/**',
            handler: e2eFakeOssPutFixture,
          },
          {
            route: '/api/e2e-fake-media-control',
            handler: e2eFakeMediaControlFixture,
          },
        ]
      : [],
    plugins: includeRuntimeErrorFixtures
      ? [e2eFakeMediaPlugin]
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
