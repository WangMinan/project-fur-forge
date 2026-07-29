import { getRuntimeConfig } from '../utils/runtime-config'

export default defineNitroPlugin(() => {
  getRuntimeConfig()
})
