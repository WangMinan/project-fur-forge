import { getRuntimeConfig } from '../utils/runtime-config'

export default defineNitroPlugin(() => {
  const config = getRuntimeConfig()

  if (config.sessionSecret) {
    process.env.NUXT_SESSION_PASSWORD = config.sessionSecret
  }
})
