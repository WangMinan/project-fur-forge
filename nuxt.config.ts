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
  ],
  nitro: {
    errorHandler: './server/error.ts',
    preset: 'node-server',
  },
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
