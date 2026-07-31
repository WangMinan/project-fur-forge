import {
  closeDatabase,
  resolveDatabaseFile,
} from '../utils/database'
import { getRuntimeConfig } from '../utils/runtime-config'

export default defineNitroPlugin((nitroApp) => {
  resolveDatabaseFile(getRuntimeConfig())
  nitroApp.hooks.hook('close', closeDatabase)
})
