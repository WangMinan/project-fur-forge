export default defineNuxtConfig({
  compatibilityDate: '2026-07-28',
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
