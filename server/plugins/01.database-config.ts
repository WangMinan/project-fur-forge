import { resolveDatabaseFile } from '../utils/database'
import { getRuntimeConfig } from '../utils/runtime-config'

export default defineNitroPlugin(() => {
  resolveDatabaseFile(getRuntimeConfig())
})
